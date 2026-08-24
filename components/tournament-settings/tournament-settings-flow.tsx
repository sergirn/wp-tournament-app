"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { FormatSettingsForm } from "@/components/tournament-settings/format-settings-form"

type Mode = "direct_knockout" | "second_group_stage"

export function TournamentSettingsFlow({ tournamentId, canManage, initial, directContent, groupContent }: {
  tournamentId: string
  canManage: boolean
  initial: { progressionMode: Mode; qualifiersFromFirstPhase: number; secondStageGroupCount: number; qualifiersFromSecondPhase: number }
  directContent: ReactNode
  groupContent: ReactNode
}) {
  const [mode, setMode] = useState<Mode>(initial.progressionMode)
  return <div className="space-y-8">
    <section className="space-y-4"><div><h2 className="text-xl font-semibold">Formato de competición</h2><p className="text-sm text-muted-foreground">Selecciona el recorrido que quieres configurar.</p></div><FormatSettingsForm tournamentId={tournamentId} canManage={canManage} initial={initial} selectedMode={mode} onModeChange={setMode} /></section>
    {mode !== initial.progressionMode ? <div className="rounded-xl border bg-muted/20 p-6 text-center"><p className="font-semibold">Guarda el formato para continuar</p><p className="mt-1 text-sm text-muted-foreground">Después aparecerán únicamente las opciones de configuración correspondientes.</p></div> : mode === "direct_knockout" ? directContent : groupContent}
  </div>
}
