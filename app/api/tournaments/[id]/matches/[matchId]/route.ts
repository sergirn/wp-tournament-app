import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { z } from "zod"
import { syncPendingGroupStages } from "@/lib/group-stage-sync"
import { syncBracketTemplate } from "@/lib/bracket-template-sync"

const updateSchema = z.object({
  teamAScore: z.number().int().nonnegative().max(999),
  teamBScore: z.number().int().nonnegative().max(999),
  matchDate: z.string().datetime(),
  location: z.string().trim().max(200),
  comments: z.string().trim().max(2000),
  status: z.enum(["scheduled", "in_progress", "finished"]),
  events: z.array(z.object({ playerId: z.string().uuid(), eventType: z.enum(["goal", "exclusion"]) })).max(500),
})

async function authorize(tournamentId: string, matchId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) }

  const admin = createAdminClient()
  if (!admin) return { error: NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 }) }
  const { data: match } = await admin
    .from("matches")
    .select("id, created_by")
    .eq("id", matchId)
    .eq("tournament_id", tournamentId)
    .maybeSingle()
  if (!match) return { error: NextResponse.json({ error: "Partido no encontrado" }, { status: 404 }) }

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin" && match.created_by !== user.id) {
    const { data: membershipById } = await admin
      .from("tournament_users")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("id", user.id)
      .maybeSingle()
    const { data: membershipByEmail } = user.email
      ? await admin.from("tournament_users").select("id").eq("tournament_id", tournamentId).eq("email", user.email.toLowerCase()).maybeSingle()
      : { data: null }
    if (!membershipById && !membershipByEmail) {
      return { error: NextResponse.json({ error: "No tienes permiso para modificar este partido" }, { status: 403 }) }
    }
  }
  return { admin, user }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; matchId: string }> }) {
  const { id, matchId } = await params
  const auth = await authorize(id, matchId)
  if (auth.error) return auth.error

  const { data: match, error } = await auth.admin.from("matches").select(`
    id, team_a_id, team_b_id, team_a_score, team_b_score, match_date, location, comments, status,
    team_a:teams!matches_team_a_id_fkey(id, name),
    team_b:teams!matches_team_b_id_fkey(id, name)
  `).eq("id", matchId).eq("tournament_id", id).single()
  if (error || !match) return NextResponse.json({ error: error?.message || "Partido no encontrado" }, { status: 404 })

  const [{ data: players }, { data: events }] = await Promise.all([
    auth.admin.from("players").select("id, name, cap_number, team_id").in("team_id", [match.team_a_id, match.team_b_id]).order("cap_number"),
    auth.admin.from("match_events").select("player_id, event_type").eq("match_id", matchId),
  ])
  const playerData = (players || []).map((player) => ({
    ...player,
    goals: (events || []).filter((event) => event.player_id === player.id && event.event_type === "goal").length,
    exclusions: (events || []).filter((event) => event.player_id === player.id && event.event_type === "exclusion").length,
  }))
  return NextResponse.json({
    match: {
      ...match,
      teamAPlayers: playerData.filter((player) => player.team_id === match.team_a_id),
      teamBPlayers: playerData.filter((player) => player.team_id === match.team_b_id),
    },
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; matchId: string }> }) {
  const { id, matchId } = await params
  const auth = await authorize(id, matchId)
  if (auth.error) return auth.error

  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Datos del partido no válidos" }, { status: 400 })
  const value = parsed.data
  const { data: match } = await auth.admin.from("matches").select("team_a_id, team_b_id").eq("id", matchId).eq("tournament_id", id).single()
  if (!match) return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 })
  const { data: bracketNode } = await auth.admin.from("tournament_bracket_nodes").select("id, next_node_id, next_slot").eq("match_id", matchId).maybeSingle()
  if (bracketNode && value.status === "finished" && value.teamAScore === value.teamBScore) {
    return NextResponse.json({ error: "Un partido eliminatorio finalizado no puede terminar en empate" }, { status: 400 })
  }
  if (bracketNode?.next_node_id) {
    const { data: nextNode } = await auth.admin.from("tournament_bracket_nodes").select("match_id").eq("id", bracketNode.next_node_id).maybeSingle()
    if (nextNode?.match_id) return NextResponse.json({ error: "No se puede cambiar este resultado porque la siguiente ronda ya está creada" }, { status: 409 })
  }
  const playerIds = [...new Set(value.events.map((event) => event.playerId))]
  if (playerIds.length > 0) {
    const { data: validPlayers } = await auth.admin.from("players").select("id").in("id", playerIds).in("team_id", [match.team_a_id, match.team_b_id])
    if (validPlayers?.length !== playerIds.length) return NextResponse.json({ error: "El acta contiene jugadores no válidos" }, { status: 400 })
  }

  const { data: previousEvents } = await auth.admin.from("match_events").select("player_id, event_type").eq("match_id", matchId)
  const restoreEvents = async () => {
    await auth.admin.from("match_events").delete().eq("match_id", matchId)
    if (previousEvents?.length) await auth.admin.from("match_events").insert(previousEvents.map((event) => ({ ...event, match_id: matchId })))
  }
  const { error: deleteEventsError } = await auth.admin.from("match_events").delete().eq("match_id", matchId)
  if (deleteEventsError) return NextResponse.json({ error: deleteEventsError.message }, { status: 400 })
  if (value.events.length > 0) {
    const { error: insertEventsError } = await auth.admin.from("match_events").insert(
      value.events.map((event) => ({ match_id: matchId, player_id: event.playerId, event_type: event.eventType })),
    )
    if (insertEventsError) {
      await restoreEvents()
      return NextResponse.json({ error: insertEventsError.message }, { status: 400 })
    }
  }
  const { data, error } = await auth.admin.from("matches").update({
    team_a_score: value.teamAScore,
    team_b_score: value.teamBScore,
    match_date: value.matchDate,
    location: value.location || null,
    comments: value.comments || null,
    status: value.status,
    updated_at: new Date().toISOString(),
  }).eq("id", matchId).eq("tournament_id", id).select("id").maybeSingle()
  if (error) {
    await restoreEvents()
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!data) return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 })

  if (value.status === "finished") {
    if (bracketNode) {
      const winnerTeamId = value.teamAScore > value.teamBScore ? match.team_a_id : match.team_b_id
      await auth.admin.from("tournament_bracket_nodes").update({ winner_team_id: winnerTeamId, status: "finished", updated_at: new Date().toISOString() }).eq("id", bracketNode.id)
      if (bracketNode.next_node_id && bracketNode.next_slot) {
        await auth.admin.from("tournament_bracket_nodes").update(bracketNode.next_slot === "A" ? { team_a_id: winnerTeamId } : { team_b_id: winnerTeamId }).eq("id", bracketNode.next_node_id)
        const { data: nextNode } = await auth.admin.from("tournament_bracket_nodes").select("id, phase_id, team_a_id, team_b_id, match_id").eq("id", bracketNode.next_node_id).single()
        if (nextNode?.team_a_id && nextNode.team_b_id && !nextNode.match_id) {
          const { data: nextMatch, error: nextMatchError } = await auth.admin.from("matches").insert({ tournament_id: id, phase_id: nextNode.phase_id, team_a_id: nextNode.team_a_id, team_b_id: nextNode.team_b_id, team_a_score: 0, team_b_score: 0, match_date: new Date().toISOString(), status: "scheduled", created_by: auth.user.id }).select("id").single()
          if (nextMatchError) return NextResponse.json({ error: `El resultado se guardó, pero no se pudo crear el siguiente cruce: ${nextMatchError.message}` }, { status: 500 })
          await auth.admin.from("tournament_bracket_nodes").update({ match_id: nextMatch.id, status: "ready", updated_at: new Date().toISOString() }).eq("id", nextNode.id)
        }
      }
    }
  }
  await syncPendingGroupStages(id, auth.admin)
  await syncBracketTemplate(id, auth.admin)
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; matchId: string }> }) {
  const { id, matchId } = await params
  const auth = await authorize(id, matchId)
  if (auth.error) return auth.error

  const { data: bracketNode } = await auth.admin.from("tournament_bracket_nodes").select("id, phase_id, team_a_id, team_b_id, next_node_id, next_slot").eq("match_id", matchId).maybeSingle()
  if (bracketNode) {
    const descendants: Array<{ id: string; match_id: string | null; next_node_id: string | null; next_slot: "A" | "B" | null; clearSlot: "A" | "B" }> = []
    let currentNode: { next_node_id: string | null; next_slot: "A" | "B" | null } = bracketNode
    while (currentNode.next_node_id && currentNode.next_slot) {
      const { data: nextNode, error: nextNodeError } = await auth.admin.from("tournament_bracket_nodes").select("id, match_id, next_node_id, next_slot").eq("id", currentNode.next_node_id).single()
      if (nextNodeError || !nextNode) return NextResponse.json({ error: nextNodeError?.message || "El árbol eliminatorio está incompleto" }, { status: 400 })
      descendants.push({ ...nextNode, clearSlot: currentNode.next_slot })
      currentNode = nextNode as { next_node_id: string | null; next_slot: "A" | "B" | null }
    }

    const descendantMatchIds = descendants.flatMap((node) => node.match_id ? [node.match_id] : [])
    if (descendantMatchIds.length) {
      const { error: descendantEventsError } = await auth.admin.from("match_events").delete().in("match_id", descendantMatchIds)
      if (descendantEventsError) return NextResponse.json({ error: descendantEventsError.message }, { status: 400 })
      const { error: descendantMatchesError } = await auth.admin.from("matches").delete().in("id", descendantMatchIds)
      if (descendantMatchesError) return NextResponse.json({ error: descendantMatchesError.message }, { status: 400 })
    }
    for (const descendant of descendants) {
      const clearedSlot = descendant.clearSlot === "A" ? { team_a_id: null } : { team_b_id: null }
      const { error: resetError } = await auth.admin.from("tournament_bracket_nodes").update({ ...clearedSlot, match_id: null, winner_team_id: null, status: "pending", updated_at: new Date().toISOString() }).eq("id", descendant.id)
      if (resetError) return NextResponse.json({ error: resetError.message }, { status: 400 })
    }

    const { error: selectedEventsError } = await auth.admin.from("match_events").delete().eq("match_id", matchId)
    if (selectedEventsError) return NextResponse.json({ error: selectedEventsError.message }, { status: 400 })
    const { error: selectedMatchError } = await auth.admin.from("matches").delete().eq("id", matchId).eq("tournament_id", id)
    if (selectedMatchError) return NextResponse.json({ error: selectedMatchError.message }, { status: 400 })

    const { data: replacementMatch, error: replacementError } = await auth.admin.from("matches").insert({ tournament_id: id, phase_id: bracketNode.phase_id, team_a_id: bracketNode.team_a_id, team_b_id: bracketNode.team_b_id, team_a_score: 0, team_b_score: 0, match_date: new Date().toISOString(), status: "scheduled", created_by: auth.user.id }).select("id").single()
    if (replacementError) return NextResponse.json({ error: `Se borró la rama, pero no se pudo restablecer el cruce: ${replacementError.message}` }, { status: 500 })
    const { error: nodeResetError } = await auth.admin.from("tournament_bracket_nodes").update({ match_id: replacementMatch.id, winner_team_id: null, status: "ready", updated_at: new Date().toISOString() }).eq("id", bracketNode.id)
    if (nodeResetError) return NextResponse.json({ error: nodeResetError.message }, { status: 400 })
    return NextResponse.json({ success: true, cascadeDeleted: descendantMatchIds.length })
  }

  const { data: previousEvents, error: readEventsError } = await auth.admin
    .from("match_events")
    .select("player_id, event_type, quarter, time_minutes")
    .eq("match_id", matchId)
  if (readEventsError) return NextResponse.json({ error: readEventsError.message }, { status: 400 })
  const { error: eventsError } = await auth.admin.from("match_events").delete().eq("match_id", matchId)
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 400 })
  const { data, error } = await auth.admin
    .from("matches")
    .delete()
    .eq("id", matchId)
    .eq("tournament_id", id)
    .select("id")
    .maybeSingle()
  if (error || !data) {
    const { error: restoreError } = previousEvents?.length
      ? await auth.admin.from("match_events").insert(previousEvents.map((event) => ({ ...event, match_id: matchId })))
      : { error: null }
    const message = restoreError
      ? `${error?.message || "Partido no encontrado"}. AdemÃ¡s, no se pudieron restaurar sus eventos: ${restoreError.message}`
      : error?.message || "Partido no encontrado"
    return NextResponse.json({ error: message }, { status: error ? 400 : 404 })
  }
  await syncPendingGroupStages(id, auth.admin)
  await syncBracketTemplate(id, auth.admin)
  return NextResponse.json({ success: true })
}
