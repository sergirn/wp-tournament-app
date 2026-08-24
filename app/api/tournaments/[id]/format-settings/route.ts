import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeTournamentManager } from "@/lib/tournament-authorization"

const schema = z.discriminatedUnion("progressionMode", [
  z.object({ progressionMode: z.literal("direct_knockout"), qualifiersFromFirstPhase: z.number().int().min(1).max(64) }),
  z.object({ progressionMode: z.literal("second_group_stage"), secondStageGroupCount: z.number().int().min(1).max(32), qualifiersFromSecondPhase: z.number().int().min(1).max(64) }),
])

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorizeTournamentManager(id)
  if (auth.error) return auth.error
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Configuración de formato no válida" }, { status: 400 })
  const admin = auth.admin

  const [{ data: current }, { data: groupStage }, { data: qualification }] = await Promise.all([
    admin.from("tournament_format_config").select("progression_mode, qualifiers_from_first_phase, second_stage_group_count, qualifiers_from_second_phase").eq("tournament_id", id).maybeSingle(),
    admin.from("tournament_group_stage_config").select("target_phase_id").eq("tournament_id", id).limit(1).maybeSingle(),
    admin.from("tournament_qualification_config").select("status").eq("tournament_id", id).maybeSingle(),
  ])
  const changesGeneratedFormat = current && (current.progression_mode !== parsed.data.progressionMode
    || (parsed.data.progressionMode === "direct_knockout" && current.qualifiers_from_first_phase !== parsed.data.qualifiersFromFirstPhase)
    || (parsed.data.progressionMode === "second_group_stage" && (current.second_stage_group_count !== parsed.data.secondStageGroupCount || current.qualifiers_from_second_phase !== parsed.data.qualifiersFromSecondPhase)))
  if (changesGeneratedFormat && (groupStage || qualification)) {
    return NextResponse.json({ error: "Antes de cambiar estos ajustes debes eliminar la segunda fase o las eliminatorias ya generadas desde Clasificación" }, { status: 409 })
  }

  const row = parsed.data.progressionMode === "direct_knockout" ? {
    tournament_id: id,
    progression_mode: parsed.data.progressionMode,
    qualifiers_from_first_phase: parsed.data.qualifiersFromFirstPhase,
    second_stage_group_count: null,
    qualifiers_from_second_phase: null,
    configured_by: auth.user.id,
    updated_at: new Date().toISOString(),
  } : {
    tournament_id: id,
    progression_mode: parsed.data.progressionMode,
    qualifiers_from_first_phase: 1,
    second_stage_group_count: parsed.data.secondStageGroupCount,
    qualifiers_from_second_phase: parsed.data.qualifiersFromSecondPhase,
    configured_by: auth.user.id,
    updated_at: new Date().toISOString(),
  }
  const { error } = await admin.from("tournament_format_config").upsert(row, { onConflict: "tournament_id" })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
