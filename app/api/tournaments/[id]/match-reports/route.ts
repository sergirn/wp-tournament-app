import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { syncPendingGroupStages } from "@/lib/group-stage-sync"
import { syncBracketTemplate } from "@/lib/bracket-template-sync"

const reportSchema = z.object({
  groupId: z.string().uuid().nullable(),
  teamAId: z.string().uuid(),
  teamBId: z.string().uuid(),
  teamAScore: z.number().int().nonnegative(),
  teamBScore: z.number().int().nonnegative(),
  comments: z.string().max(2000).default(""),
  events: z.array(z.object({ playerId: z.string().uuid(), eventType: z.enum(["goal", "exclusion"]) })).max(500),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: "Falta configurar el acceso administrativo de Supabase" }, { status: 500 })
    const email = user.email?.toLowerCase()
    const membershipQuery = admin.from("tournament_users").select("id").eq("tournament_id", id).eq("id", user.id)
    const { data: membershipById } = await membershipQuery.maybeSingle()
    const { data: membershipByEmail } = email
      ? await admin.from("tournament_users").select("id").eq("tournament_id", id).eq("email", email).maybeSingle()
      : { data: null }
    if (!membershipById && !membershipByEmail) {
      return NextResponse.json({ error: "No tienes permiso para registrar actas en este torneo" }, { status: 403 })
    }
  }

  const parsed = reportSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || parsed.data.teamAId === parsed.data.teamBId) {
    return NextResponse.json({ error: "Datos del acta no válidos" }, { status: 400 })
  }

  const value = parsed.data
  let groupPhaseId: string | null = null
  const { data: participants, error: participantsError } = await supabase
    .from("tournament_teams")
    .select("team_id")
    .eq("tournament_id", id)
    .in("team_id", [value.teamAId, value.teamBId])
  if (participantsError || participants?.length !== 2) {
    return NextResponse.json({ error: "Ambos equipos deben pertenecer al torneo" }, { status: 400 })
  }

  if (value.groupId) {
    const { data: group, error: groupError } = await supabase.from("groups").select("id, phase_id").eq("id", value.groupId).eq("tournament_id", id).maybeSingle()
    if (groupError || !group) return NextResponse.json({ error: "El grupo no pertenece al torneo" }, { status: 400 })
    groupPhaseId = group.phase_id
    const { data: groupMembers, error: membersError } = await supabase
      .from("group_members")
      .select("team_id")
      .eq("group_id", value.groupId)
      .in("team_id", [value.teamAId, value.teamBId])
    if (membersError || groupMembers?.length !== 2) {
      return NextResponse.json({ error: "Ambos equipos deben pertenecer al grupo seleccionado" }, { status: 400 })
    }
    const { data: existingMatch, error: existingMatchError } = await supabase
      .from("matches")
      .select("id")
      .eq("tournament_id", id)
      .eq("group_id", value.groupId)
      .or(`and(team_a_id.eq.${value.teamAId},team_b_id.eq.${value.teamBId}),and(team_a_id.eq.${value.teamBId},team_b_id.eq.${value.teamAId})`)
      .limit(1)
      .maybeSingle()
    if (existingMatchError) return NextResponse.json({ error: existingMatchError.message }, { status: 400 })
    if (existingMatch) return NextResponse.json({ error: "Este partido de grupo ya tiene un acta. Edítala desde el listado de partidos del grupo" }, { status: 409 })
  }

  const playerIds = [...new Set(value.events.map((event) => event.playerId))]
  if (playerIds.length > 0) {
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, team_id")
      .in("id", playerIds)
      .in("team_id", [value.teamAId, value.teamBId])
    if (playersError || players?.length !== playerIds.length) {
      return NextResponse.json({ error: "El acta contiene jugadores no válidos" }, { status: 400 })
    }
  }

  const { data: match, error: matchError } = await supabase.from("matches").insert({
    tournament_id: id,
    group_id: value.groupId,
    phase_id: groupPhaseId,
    team_a_id: value.teamAId,
    team_b_id: value.teamBId,
    team_a_score: value.teamAScore,
    team_b_score: value.teamBScore,
    match_date: new Date().toISOString(),
    status: "finished",
    created_by: user.id,
    comments: value.comments.trim() || null,
  }).select("id").single()
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 400 })

  if (value.events.length > 0) {
    const { error: eventsError } = await supabase.from("match_events").insert(
      value.events.map((event) => ({ match_id: match.id, player_id: event.playerId, event_type: event.eventType })),
    )
    if (eventsError) {
      await supabase.from("matches").delete().eq("id", match.id)
      return NextResponse.json({ error: eventsError.message }, { status: 400 })
    }
  }

  const syncAdmin = createAdminClient()
  if (syncAdmin && value.groupId) {
    await syncPendingGroupStages(id, syncAdmin)
    await syncBracketTemplate(id, syncAdmin)
  }
  return NextResponse.json({ matchId: match.id }, { status: 201 })
}
