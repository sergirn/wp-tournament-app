import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeTournamentManager } from "@/lib/tournament-authorization"

const schema = z.object({
  assignments: z.array(z.object({
    nodeId: z.string().uuid(),
    teamAId: z.string().uuid().nullable(),
    teamBId: z.string().uuid().nullable(),
  })).min(1).max(128),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorizeTournamentManager(id)
  if (auth.error) return auth.error
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Configuración de cruces no válida" }, { status: 400 })
  const admin = auth.admin

  const [{ data: config }, { data: phases }, { data: qualifiedRows }] = await Promise.all([
    admin.from("tournament_qualification_config").select("status").eq("tournament_id", id).maybeSingle(),
    admin.from("tournament_phases").select("id, phase_order").eq("tournament_id", id).eq("phase_type", "knockout").order("phase_order"),
    admin.from("tournament_qualified_teams").select("team_id").eq("tournament_id", id),
  ])
  if (!config || !phases?.length) return NextResponse.json({ error: "Primero debes generar los clasificados" }, { status: 400 })
  if (config.status === "locked") return NextResponse.json({ error: "El cuadro ya está confirmado" }, { status: 409 })

  const { data: firstRoundNodes } = await admin.from("tournament_bracket_nodes").select("id, position, next_node_id, next_slot").eq("tournament_id", id).eq("phase_id", phases[0].id).order("position")
  if (!firstRoundNodes || parsed.data.assignments.length !== firstRoundNodes.length) return NextResponse.json({ error: "Debes configurar todos los cruces de la primera ronda" }, { status: 400 })
  const validNodeIds = new Set(firstRoundNodes.map((node) => node.id))
  const qualifiedIds = new Set((qualifiedRows || []).map((row) => row.team_id))
  const selectedIds = parsed.data.assignments.flatMap((assignment) => [assignment.teamAId, assignment.teamBId]).filter((value): value is string => Boolean(value))
  if (selectedIds.some((teamId) => !qualifiedIds.has(teamId))) return NextResponse.json({ error: "El cuadro contiene un equipo no clasificado" }, { status: 400 })
  if (new Set(selectedIds).size !== selectedIds.length) return NextResponse.json({ error: "Un equipo no puede aparecer en más de un cruce" }, { status: 400 })
  if (selectedIds.length !== qualifiedIds.size) return NextResponse.json({ error: "Debes asignar exactamente una vez a todos los equipos clasificados" }, { status: 400 })
  if (parsed.data.assignments.some((assignment) => !validNodeIds.has(assignment.nodeId) || (!assignment.teamAId && !assignment.teamBId) || assignment.teamAId === assignment.teamBId)) {
    return NextResponse.json({ error: "Hay cruces vacíos o no válidos" }, { status: 400 })
  }

  for (const assignment of parsed.data.assignments) {
    const node = firstRoundNodes.find((item) => item.id === assignment.nodeId)!
    const hasTwoTeams = Boolean(assignment.teamAId && assignment.teamBId)
    const winnerTeamId = hasTwoTeams ? null : assignment.teamAId || assignment.teamBId
    const { error } = await admin.from("tournament_bracket_nodes").update({ team_a_id: assignment.teamAId, team_b_id: assignment.teamBId, winner_team_id: winnerTeamId, status: hasTwoTeams ? "ready" : "bye" }).eq("id", node.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (hasTwoTeams) {
      const { data: match, error: matchError } = await admin.from("matches").insert({ tournament_id: id, phase_id: phases[0].id, team_a_id: assignment.teamAId, team_b_id: assignment.teamBId, team_a_score: 0, team_b_score: 0, match_date: new Date().toISOString(), status: "scheduled", created_by: auth.user.id }).select("id").single()
      if (matchError) return NextResponse.json({ error: matchError.message }, { status: 400 })
      await admin.from("tournament_bracket_nodes").update({ match_id: match.id }).eq("id", node.id)
    } else if (winnerTeamId && node.next_node_id && node.next_slot) {
      await admin.from("tournament_bracket_nodes").update(node.next_slot === "A" ? { team_a_id: winnerTeamId } : { team_b_id: winnerTeamId }).eq("id", node.next_node_id)
    }
  }

  // Si dos exentos confluyen en el mismo nodo, el partido queda listo inmediatamente.
  for (let phaseIndex = 1; phaseIndex < phases.length; phaseIndex++) {
    const { data: nodes } = await admin.from("tournament_bracket_nodes").select("id, team_a_id, team_b_id, match_id").eq("tournament_id", id).eq("phase_id", phases[phaseIndex].id)
    for (const node of nodes || []) {
      if (node.team_a_id && node.team_b_id && !node.match_id) {
        const { data: match, error } = await admin.from("matches").insert({ tournament_id: id, phase_id: phases[phaseIndex].id, team_a_id: node.team_a_id, team_b_id: node.team_b_id, team_a_score: 0, team_b_score: 0, match_date: new Date().toISOString(), status: "scheduled", created_by: auth.user.id }).select("id").single()
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        await admin.from("tournament_bracket_nodes").update({ match_id: match.id, status: "ready" }).eq("id", node.id)
      }
    }
  }

  await admin.from("tournament_qualification_config").update({ status: "locked", updated_at: new Date().toISOString() }).eq("tournament_id", id)
  await admin.from("tournament_phases").update({ locked: true }).eq("tournament_id", id).eq("phase_type", "knockout")
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorizeTournamentManager(id)
  if (auth.error) return auth.error
  const admin = auth.admin
  const mode = new URL(request.url).searchParams.get("mode") === "edit" ? "edit" : "all"

  const { data: nodes, error: nodesError } = await admin
    .from("tournament_bracket_nodes")
    .select("id, match_id")
    .eq("tournament_id", id)
  if (nodesError) return NextResponse.json({ error: nodesError.message }, { status: 400 })
  const matchIds = (nodes || []).flatMap((node) => node.match_id ? [node.match_id] : [])

  if (matchIds.length) {
    const { data: matches, error: matchesError } = await admin.from("matches").select("id, team_a_score, team_b_score").in("id", matchIds)
    if (matchesError) return NextResponse.json({ error: matchesError.message }, { status: 400 })
    if ((matches || []).some((match) => (match.team_a_score || 0) !== 0 || (match.team_b_score || 0) !== 0)) {
      return NextResponse.json({ error: "No se pueden modificar las eliminatorias porque algún partido ya tiene goles" }, { status: 409 })
    }
    const { error: eventsError } = await admin.from("match_events").delete().in("match_id", matchIds)
    if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 400 })
    const { error: matchesDeleteError } = await admin.from("matches").delete().in("id", matchIds)
    if (matchesDeleteError) return NextResponse.json({ error: matchesDeleteError.message }, { status: 400 })
  }

  if (mode === "edit") {
    const { error: resetError } = await admin.from("tournament_bracket_nodes").update({ team_a_id: null, team_b_id: null, match_id: null, winner_team_id: null, status: "pending", updated_at: new Date().toISOString() }).eq("tournament_id", id)
    if (resetError) return NextResponse.json({ error: resetError.message }, { status: 400 })
    await admin.from("tournament_qualification_config").update({ status: "draft", updated_at: new Date().toISOString() }).eq("tournament_id", id)
    await admin.from("tournament_phases").update({ locked: false }).eq("tournament_id", id).eq("phase_type", "knockout")
    return NextResponse.json({ success: true, mode })
  }

  const { data: phases } = await admin.from("tournament_phases").select("id").eq("tournament_id", id).eq("phase_type", "knockout")
  const { error: bracketDeleteError } = await admin.from("tournament_bracket_nodes").delete().eq("tournament_id", id)
  if (bracketDeleteError) return NextResponse.json({ error: bracketDeleteError.message }, { status: 400 })
  const phaseIds = (phases || []).map((phase) => phase.id)
  if (phaseIds.length) {
    const { error: phasesDeleteError } = await admin.from("tournament_phases").delete().in("id", phaseIds)
    if (phasesDeleteError) return NextResponse.json({ error: phasesDeleteError.message }, { status: 400 })
  }
  await admin.from("tournament_qualified_teams").delete().eq("tournament_id", id)
  await admin.from("tournament_qualification_config").delete().eq("tournament_id", id)
  return NextResponse.json({ success: true, mode })
}
