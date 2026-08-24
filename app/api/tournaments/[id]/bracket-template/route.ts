import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeTournamentManager } from "@/lib/tournament-authorization"
import { getBracketSize, getRoundName } from "@/lib/bracket"
import { syncBracketTemplate } from "@/lib/bracket-template-sync"

const schema = z.object({
  sourcePhaseId: z.string().uuid(),
  qualifiersPerGroup: z.number().int().min(1).max(64),
  seeds: z.array(z.object({ sourceGroupId: z.string().uuid(), sourcePosition: z.number().int().min(1).max(64) })).min(2).max(128),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorizeTournamentManager(id)
  if (auth.error) return auth.error
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Plantilla eliminatoria no válida" }, { status: 400 })
  const admin = auth.admin
  const input = parsed.data
  const [{ data: sourcePhase }, { data: formatConfig }, { data: groupStageConfig }, { data: groups }, { data: existingNodes }] = await Promise.all([
    admin.from("tournament_phases").select("id, phase_order, phase_type").eq("id", input.sourcePhaseId).eq("tournament_id", id).maybeSingle(),
    admin.from("tournament_format_config").select("progression_mode, qualifiers_from_first_phase, qualifiers_from_second_phase").eq("tournament_id", id).maybeSingle(),
    admin.from("tournament_group_stage_config").select("source_phase_id, target_phase_id").eq("tournament_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("groups").select("id, name, group_members(team_id)").eq("tournament_id", id).eq("phase_id", input.sourcePhaseId).order("order_number"),
    admin.from("tournament_bracket_nodes").select("id").eq("tournament_id", id).limit(1),
  ])
  if (!sourcePhase || sourcePhase.phase_type !== "group" || !groups?.length) return NextResponse.json({ error: "La fase de origen no está preparada" }, { status: 400 })
  if (formatConfig?.progression_mode === "second_group_stage" && input.sourcePhaseId !== groupStageConfig?.target_phase_id) return NextResponse.json({ error: "Las eliminatorias deben generarse desde la segunda fase de grupos" }, { status: 409 })
  if (formatConfig?.progression_mode === "direct_knockout" && groupStageConfig?.source_phase_id && input.sourcePhaseId !== groupStageConfig.source_phase_id) return NextResponse.json({ error: "Las eliminatorias directas deben generarse desde la primera fase" }, { status: 409 })
  if (formatConfig?.progression_mode === "direct_knockout" && formatConfig.qualifiers_from_first_phase && input.qualifiersPerGroup !== formatConfig.qualifiers_from_first_phase) return NextResponse.json({ error: "La cantidad de clasificados no coincide con los Ajustes del torneo" }, { status: 409 })
  if (existingNodes?.length) return NextResponse.json({ error: "Ya existe una plantilla eliminatoria. Elimínala antes de crear otra." }, { status: 409 })
  const groupMap = new Map(groups.map((group) => [group.id, group]))
  const unique = new Set<string>()
  for (const seed of input.seeds) {
    const group = groupMap.get(seed.sourceGroupId)
    const memberCount = (group?.group_members as unknown as unknown[] || []).length
    const { count: draftCount } = memberCount ? { count: memberCount } : await admin.from("tournament_group_stage_slots").select("id", { count: "exact", head: true }).eq("group_id", seed.sourceGroupId)
    if (!group || seed.sourcePosition > (draftCount || 0)) return NextResponse.json({ error: "Una plaza de clasificación no existe" }, { status: 400 })
    const key = `${seed.sourceGroupId}:${seed.sourcePosition}`
    if (unique.has(key)) return NextResponse.json({ error: "Una plaza no puede aparecer dos veces" }, { status: 400 })
    unique.add(key)
  }
  const bracketSize = getBracketSize(input.seeds.length)
  const roundSizes: number[] = []
  for (let size = bracketSize; size >= 2; size /= 2) roundSizes.push(size)
  const phaseRows: Array<{ id: string; phase_order: number }> = []
  for (let index = 0; index < roundSizes.length; index++) {
    const { data: phase, error } = await admin.from("tournament_phases").insert({ tournament_id: id, name: getRoundName(roundSizes[index]), phase_order: sourcePhase.phase_order + index + 1, phase_type: "knockout", locked: false }).select("id, phase_order").single()
    if (error || !phase) return NextResponse.json({ error: error?.message || "No se pudo crear la eliminatoria" }, { status: 400 })
    phaseRows.push(phase)
  }
  const rounds: Array<Array<{ id: string }>> = []
  for (let roundIndex = 0; roundIndex < phaseRows.length; roundIndex++) {
    const { data: nodes, error } = await admin.from("tournament_bracket_nodes").insert(Array.from({ length: roundSizes[roundIndex] / 2 }, (_, index) => ({ tournament_id: id, phase_id: phaseRows[roundIndex].id, position: index + 1 }))).select("id, position").order("position")
    if (error || !nodes) return NextResponse.json({ error: error?.message || "No se pudo crear el cuadro" }, { status: 400 })
    rounds.push(nodes)
  }
  for (let round = 0; round < rounds.length - 1; round++) for (let index = 0; index < rounds[round].length; index++) await admin.from("tournament_bracket_nodes").update({ next_node_id: rounds[round + 1][Math.floor(index / 2)].id, next_slot: index % 2 === 0 ? "A" : "B" }).eq("id", rounds[round][index].id)
  const slots = [
    ...rounds[0].map((node) => ({ nodeId: node.id, nodeSlot: "A" })),
    ...rounds[0].map((node) => ({ nodeId: node.id, nodeSlot: "B" })),
  ].slice(0, input.seeds.length)
  const { error: seedError } = await admin.from("tournament_bracket_seed_slots").insert(input.seeds.map((seed, index) => ({ tournament_id: id, source_phase_id: input.sourcePhaseId, node_id: slots[index].nodeId, node_slot: slots[index].nodeSlot, source_group_id: seed.sourceGroupId, source_position: seed.sourcePosition })))
  if (seedError) return NextResponse.json({ error: seedError.message }, { status: 400 })
  const { error: configError } = await admin.from("tournament_qualification_config").upsert({ tournament_id: id, source_phase_id: input.sourcePhaseId, qualifiers_per_group: input.qualifiersPerGroup, status: "draft", configured_by: auth.user.id, updated_at: new Date().toISOString() }, { onConflict: "tournament_id" })
  if (configError) return NextResponse.json({ error: configError.message }, { status: 400 })
  if (formatConfig?.progression_mode === "second_group_stage") {
    await Promise.all([
      admin.from("tournament_format_config").update({ qualifiers_from_second_phase: input.qualifiersPerGroup, updated_at: new Date().toISOString() }).eq("tournament_id", id),
      admin.from("tournament_group_stage_config").update({ qualifiers_per_group: input.qualifiersPerGroup, updated_at: new Date().toISOString() }).eq("tournament_id", id).eq("target_phase_id", input.sourcePhaseId),
    ])
  }
  const sync = await syncBracketTemplate(id, admin)
  return NextResponse.json({ success: true, resolved: sync.resolved, bracketSize })
}
