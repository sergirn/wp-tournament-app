import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeTournamentManager } from "@/lib/tournament-authorization"
import { syncPendingGroupStages } from "@/lib/group-stage-sync"

const createSchema = z.object({
  sourcePhaseId: z.string().uuid(),
  qualifiersPerGroup: z.number().int().min(1).max(64),
  groups: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    slots: z.array(z.object({
      sourceGroupId: z.string().uuid(),
      sourcePosition: z.number().int().min(1).max(64),
    })).min(2).max(64),
  })).min(1).max(32),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorizeTournamentManager(id)
  if (auth.error) return auth.error
  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Configuración de la segunda fase no válida" }, { status: 400 })
  const admin = auth.admin
  const input = parsed.data

  const [{ data: tournament }, { data: formatConfig }, { data: sourcePhase }, { data: sourceGroups }, { data: laterPhases }] = await Promise.all([
    admin.from("tournaments").select("id, points_win, points_draw, points_loss").eq("id", id).maybeSingle(),
    admin.from("tournament_format_config").select("progression_mode, second_stage_group_count, qualifiers_from_second_phase").eq("tournament_id", id).maybeSingle(),
    admin.from("tournament_phases").select("id, phase_order, phase_type").eq("id", input.sourcePhaseId).eq("tournament_id", id).maybeSingle(),
    admin.from("groups").select("id, name, group_members(team_id)").eq("tournament_id", id).eq("phase_id", input.sourcePhaseId).order("order_number"),
    admin.from("tournament_phases").select("id, phase_type").eq("tournament_id", id),
  ])
  if (!tournament || !sourcePhase || sourcePhase.phase_type !== "group") return NextResponse.json({ error: "La fase de origen no existe" }, { status: 404 })
  if (formatConfig?.progression_mode !== "second_group_stage") return NextResponse.json({ error: "El torneo no está configurado para tener una segunda fase de grupos" }, { status: 409 })
  if (formatConfig.second_stage_group_count !== input.groups.length || formatConfig.qualifiers_from_second_phase !== input.qualifiersPerGroup) return NextResponse.json({ error: "La configuración no coincide con los Ajustes del torneo" }, { status: 409 })
  if (!sourceGroups?.length) return NextResponse.json({ error: "La fase de origen no tiene grupos" }, { status: 400 })
  if ((laterPhases || []).some((phase) => phase.id !== sourcePhase.id && (phase.phase_type === "group" || phase.phase_type === "knockout"))) {
    return NextResponse.json({ error: "Ya existe una fase posterior. Elimínala antes de generar otra." }, { status: 409 })
  }

  const sourceGroupMap = new Map(sourceGroups.map((group) => [group.id, group]))
  const sourceKeys = new Set<string>()
  for (const group of input.groups) {
    for (const slot of group.slots) {
      const sourceGroup = sourceGroupMap.get(slot.sourceGroupId)
      const teamCount = (sourceGroup?.group_members as unknown as unknown[] || []).length
      if (!sourceGroup || slot.sourcePosition > teamCount) return NextResponse.json({ error: "Una plaza hace referencia a una posición inexistente" }, { status: 400 })
      const key = `${slot.sourceGroupId}:${slot.sourcePosition}`
      if (sourceKeys.has(key)) return NextResponse.json({ error: "Una posición aparece más de una vez" }, { status: 400 })
      sourceKeys.add(key)
    }
  }
  const totalSourceTeams = sourceGroups.reduce((total, group) => total + ((group.group_members as unknown as unknown[]) || []).length, 0)
  if (sourceKeys.size !== totalSourceTeams) return NextResponse.json({ error: "La segunda fase debe asignar exactamente una vez todas las posiciones" }, { status: 400 })

  const nextOrder = Math.max(sourcePhase.phase_order + 1, 2)
  const { data: targetPhase, error: phaseError } = await admin.from("tournament_phases").insert({
    tournament_id: id, name: "Fase de grupos 2", phase_order: nextOrder, phase_type: "group", locked: false,
  }).select("id").single()
  if (phaseError || !targetPhase) return NextResponse.json({ error: phaseError?.message || "No se pudo crear la segunda fase" }, { status: 400 })

  const cleanupTargetStage = async () => {
    const { data: createdGroups } = await admin.from("groups").select("id").eq("phase_id", targetPhase.id)
    const groupIds = (createdGroups || []).map((group) => group.id)
    if (groupIds.length) {
      await admin.from("group_members").delete().in("group_id", groupIds)
      await admin.from("tournament_group_stage_slots").delete().in("group_id", groupIds)
      await admin.from("groups").delete().in("id", groupIds)
    }
    await admin.from("tournament_group_stage_config").delete().eq("target_phase_id", targetPhase.id)
    await admin.from("tournament_phases").delete().eq("id", targetPhase.id)
  }

  const createdGroupIds: string[] = []
  for (let groupIndex = 0; groupIndex < input.groups.length; groupIndex++) {
    const groupInput = input.groups[groupIndex]
    const { data: targetGroup, error: groupError } = await admin.from("groups").insert({
      tournament_id: id, phase_id: targetPhase.id, name: groupInput.name, order_number: 100 + groupIndex + 1,
    }).select("id").single()
    if (groupError || !targetGroup) {
      await cleanupTargetStage()
      return NextResponse.json({ error: groupError?.message || "No se pudo crear un grupo" }, { status: 400 })
    }
    createdGroupIds.push(targetGroup.id)
    const slots = groupInput.slots.map((slot, slotIndex) => ({
      tournament_id: id,
      phase_id: targetPhase.id,
      group_id: targetGroup.id,
      slot_order: slotIndex + 1,
      source_group_id: slot.sourceGroupId,
      source_position: slot.sourcePosition,
      team_id: null,
    }))
    const { error: slotsError } = await admin.from("tournament_group_stage_slots").insert(slots)
    if (slotsError) {
      await cleanupTargetStage()
      return NextResponse.json({ error: slotsError.message }, { status: 400 })
    }
  }

  const { error: configError } = await admin.from("tournament_group_stage_config").insert({
    tournament_id: id,
    source_phase_id: input.sourcePhaseId,
    target_phase_id: targetPhase.id,
    qualifiers_per_group: input.qualifiersPerGroup,
    status: "draft",
    configured_by: auth.user.id,
  })
  if (configError) {
    await cleanupTargetStage()
    return NextResponse.json({ error: configError.message }, { status: 400 })
  }
  const sync = await syncPendingGroupStages(id, admin)
  return NextResponse.json({ success: true, phaseId: targetPhase.id, groupIds: createdGroupIds, resolved: sync.resolved })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorizeTournamentManager(id)
  if (auth.error) return auth.error
  const admin = auth.admin
  const phaseId = new URL(request.url).searchParams.get("phaseId")
  if (!phaseId) return NextResponse.json({ error: "Falta la fase que se quiere eliminar" }, { status: 400 })

  const { data: phase } = await admin.from("tournament_phases").select("id, phase_order, phase_type").eq("id", phaseId).eq("tournament_id", id).maybeSingle()
  if (!phase || phase.phase_type !== "group") return NextResponse.json({ error: "Fase no encontrada" }, { status: 404 })
  const { data: laterPhases } = await admin.from("tournament_phases").select("id").eq("tournament_id", id).gte("phase_order", phase.phase_order)
  const phaseIds = (laterPhases || []).map((item) => item.id)
  const { data: matches } = phaseIds.length ? await admin.from("matches").select("id, team_a_score, team_b_score").eq("tournament_id", id).in("phase_id", phaseIds) : { data: [] }
  if ((matches || []).some((match) => (match.team_a_score || 0) !== 0 || (match.team_b_score || 0) !== 0)) {
    return NextResponse.json({ error: "No se puede rehacer la fase porque existen partidos posteriores con goles" }, { status: 409 })
  }
  const matchIds = (matches || []).map((match) => match.id)
  if (matchIds.length) {
    await admin.from("match_events").delete().in("match_id", matchIds)
    const { error } = await admin.from("matches").delete().in("id", matchIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  await admin.from("tournament_bracket_nodes").delete().eq("tournament_id", id)
  await admin.from("tournament_qualified_teams").delete().eq("tournament_id", id)
  await admin.from("tournament_qualification_config").delete().eq("tournament_id", id)
  const { data: laterGroups } = await admin.from("groups").select("id").in("phase_id", phaseIds)
  const groupIds = (laterGroups || []).map((group) => group.id)
  if (groupIds.length) {
    await admin.from("group_members").delete().in("group_id", groupIds)
    await admin.from("tournament_group_stage_slots").delete().in("group_id", groupIds)
    await admin.from("groups").delete().in("id", groupIds)
  }
  await admin.from("tournament_group_stage_config").delete().eq("tournament_id", id).in("target_phase_id", phaseIds)
  const { error: deleteError } = await admin.from("tournament_phases").delete().in("id", phaseIds)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
