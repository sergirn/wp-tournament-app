import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeTournamentManager } from "@/lib/tournament-authorization"
import { getBracketSize, getRoundName } from "@/lib/bracket"
import { expectedRoundRobinMatches } from "@/lib/standings"

const schema = z.object({ qualifiersPerGroup: z.number().int().min(1).max(64), sourcePhaseId: z.string().uuid().optional() })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorizeTournamentManager(id)
  if (auth.error) return auth.error
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Cantidad de clasificados no válida" }, { status: 400 })
  const admin = auth.admin

  const [{ data: tournament }, { data: formatConfig }, { data: groupStageConfig }, { data: allGroups }, { data: matches }, { data: existingNodes }, { data: groupPhases }] = await Promise.all([
    admin.from("tournaments").select("id, type, points_win, points_draw, points_loss").eq("id", id).maybeSingle(),
    admin.from("tournament_format_config").select("progression_mode, qualifiers_from_first_phase, qualifiers_from_second_phase").eq("tournament_id", id).maybeSingle(),
    admin.from("tournament_group_stage_config").select("source_phase_id, target_phase_id").eq("tournament_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("groups").select("id, name, phase_id, group_members(team_id)").eq("tournament_id", id).order("order_number"),
    admin.from("matches").select("group_id, phase_id, team_a_id, team_b_id, team_a_score, team_b_score, status").eq("tournament_id", id),
    admin.from("tournament_bracket_nodes").select("match_id").eq("tournament_id", id).not("match_id", "is", null).limit(1),
    admin.from("tournament_phases").select("id, phase_order").eq("tournament_id", id).eq("phase_type", "group").order("phase_order", { ascending: false }),
  ])
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 })
  const sourcePhaseId = parsed.data.sourcePhaseId || groupPhases?.[0]?.id || null
  const sourcePhaseOrder = groupPhases?.find((phase) => phase.id === sourcePhaseId)?.phase_order || 0
  const expectedQualifiers = formatConfig?.progression_mode === "second_group_stage" ? formatConfig.qualifiers_from_second_phase : formatConfig?.qualifiers_from_first_phase
  if (expectedQualifiers && parsed.data.qualifiersPerGroup !== expectedQualifiers) return NextResponse.json({ error: "La cantidad de clasificados no coincide con los Ajustes del torneo" }, { status: 409 })
  if (formatConfig?.progression_mode === "second_group_stage" && (groupPhases?.length || 0) < 2) return NextResponse.json({ error: "Primero debes generar y resolver la segunda fase de grupos" }, { status: 409 })
  if (formatConfig?.progression_mode === "second_group_stage" && sourcePhaseId !== groupStageConfig?.target_phase_id) return NextResponse.json({ error: "Los clasificados deben calcularse desde la segunda fase" }, { status: 409 })
  const groups = (allGroups || []).filter((group) => sourcePhaseId ? group.phase_id === sourcePhaseId : true)
  const sourceMatches = (matches || []).filter((match) => sourcePhaseId ? match.phase_id === sourcePhaseId : true)
  if (tournament.type !== "groups" || !groups.length) return NextResponse.json({ error: "El torneo no tiene una fase de grupos configurada" }, { status: 400 })
  for (const group of groups) {
    const teamCount = ((group.group_members || []) as Array<{ team_id: string }>).length
    const finishedCount = sourceMatches.filter((match) => match.group_id === group.id && match.status === "finished").length
    if (!teamCount || finishedCount < expectedRoundRobinMatches(teamCount)) return NextResponse.json({ error: `${group.name} todavía tiene partidos pendientes` }, { status: 409 })
  }
  if (existingNodes?.length) return NextResponse.json({ error: "No se puede regenerar el cuadro porque ya tiene partidos creados" }, { status: 409 })

  const qualifiers: Array<{ tournament_id: string; group_id: string; team_id: string; group_position: number }> = []
  for (const group of groups) {
    const teamIds = ((group.group_members || []) as Array<{ team_id: string }>).map((member) => member.team_id)
    const ranking = teamIds.map((teamId) => {
      let points = 0, goalDifference = 0, goalsFor = 0
      for (const match of sourceMatches) {
        if (match.status !== "finished" || match.group_id !== group.id || (match.team_a_id !== teamId && match.team_b_id !== teamId)) continue
        const isA = match.team_a_id === teamId
        const own = (isA ? match.team_a_score : match.team_b_score) || 0
        const rival = (isA ? match.team_b_score : match.team_a_score) || 0
        goalsFor += own
        goalDifference += own - rival
        points += own > rival ? tournament.points_win : own === rival ? tournament.points_draw : tournament.points_loss
      }
      return { teamId, points: points || 0, goalDifference, goalsFor }
    }).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.teamId.localeCompare(b.teamId))
    ranking.slice(0, parsed.data.qualifiersPerGroup).forEach((team, index) => qualifiers.push({ tournament_id: id, group_id: group.id, team_id: team.teamId, group_position: index + 1 }))
  }
  if (qualifiers.length < 2) return NextResponse.json({ error: "Se necesitan al menos dos equipos clasificados" }, { status: 400 })

  const { data: knockoutPhases } = await admin.from("tournament_phases").select("id").eq("tournament_id", id).eq("phase_type", "knockout")
  const phaseIds = (knockoutPhases || []).map((phase) => phase.id)
  await admin.from("tournament_bracket_nodes").delete().eq("tournament_id", id)
  if (phaseIds.length) await admin.from("tournament_phases").delete().in("id", phaseIds)
  await admin.from("tournament_qualified_teams").delete().eq("tournament_id", id)
  const { error: qualifiedError } = await admin.from("tournament_qualified_teams").insert(qualifiers)
  if (qualifiedError) return NextResponse.json({ error: qualifiedError.message }, { status: 400 })

  const bracketSize = getBracketSize(qualifiers.length)
  const roundSizes: number[] = []
  for (let size = bracketSize; size >= 2; size /= 2) roundSizes.push(size)
  const phaseRows: Array<{ id: string; name: string; phase_order: number }> = []
  for (let index = 0; index < roundSizes.length; index++) {
    const { data: phase, error } = await admin.from("tournament_phases").insert({ tournament_id: id, name: getRoundName(roundSizes[index]), phase_order: sourcePhaseOrder + index + 1, phase_type: "knockout" }).select("id, name, phase_order").single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    phaseRows.push(phase)
  }

  const rounds: Array<Array<{ id: string }>> = []
  for (let roundIndex = 0; roundIndex < phaseRows.length; roundIndex++) {
    const nodeCount = roundSizes[roundIndex] / 2
    const { data: nodes, error } = await admin.from("tournament_bracket_nodes").insert(Array.from({ length: nodeCount }, (_, index) => ({ tournament_id: id, phase_id: phaseRows[roundIndex].id, position: index + 1 }))).select("id, position").order("position")
    if (error || !nodes) return NextResponse.json({ error: error?.message || "No se pudo crear el cuadro" }, { status: 400 })
    rounds.push(nodes)
  }
  for (let roundIndex = 0; roundIndex < rounds.length - 1; roundIndex++) {
    for (let index = 0; index < rounds[roundIndex].length; index++) {
      await admin.from("tournament_bracket_nodes").update({ next_node_id: rounds[roundIndex + 1][Math.floor(index / 2)].id, next_slot: index % 2 === 0 ? "A" : "B" }).eq("id", rounds[roundIndex][index].id)
    }
  }

  const { error: configError } = await admin.from("tournament_qualification_config").upsert({ tournament_id: id, source_phase_id: sourcePhaseId, qualifiers_per_group: parsed.data.qualifiersPerGroup, status: "draft", configured_by: auth.user.id, updated_at: new Date().toISOString() }, { onConflict: "tournament_id" })
  if (configError) return NextResponse.json({ error: configError.message }, { status: 400 })
  return NextResponse.json({ qualifiedCount: qualifiers.length, bracketSize, byes: bracketSize - qualifiers.length })
}
