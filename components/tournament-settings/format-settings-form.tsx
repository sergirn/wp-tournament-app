"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { GitBranch, Layers3, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Mode = "direct_knockout" | "second_group_stage"

export function FormatSettingsForm({ tournamentId, canManage, initial, selectedMode, onModeChange }: {
  tournamentId: string
  canManage: boolean
  initial: { progressionMode: Mode; qualifiersFromFirstPhase: number; secondStageGroupCount: number; qualifiersFromSecondPhase: number }
  selectedMode?: Mode
  onModeChange?: (mode: Mode) => void
}) {
  const router = useRouter()
  const [internalMode, setInternalMode] = useState<Mode>(initial.progressionMode)
  const mode = selectedMode ?? internalMode
  const setMode = (nextMode: Mode) => {
    setInternalMode(nextMode)
    onModeChange?.(nextMode)
  }
  const [firstQualifiers, setFirstQualifiers] = useState(initial.qualifiersFromFirstPhase)
  const [secondGroups, setSecondGroups] = useState(initial.secondStageGroupCount)
  const [secondQualifiers, setSecondQualifiers] = useState(initial.qualifiersFromSecondPhase)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  async function save() {
    setBusy(true); setMessage(null)
    const body = mode === "direct_knockout" ? { progressionMode: mode, qualifiersFromFirstPhase: firstQualifiers } : { progressionMode: mode, secondStageGroupCount: secondGroups, qualifiersFromSecondPhase: secondQualifiers }
    const response = await fetch(`/api/tournaments/${tournamentId}/format-settings`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setMessage({ type: "error", text: result.error || "No se pudo guardar la configuración" })
    else { setMessage({ type: "success", text: "Formato actualizado correctamente" }); router.refresh() }
    setBusy(false)
  }

  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2">
      <button type="button" disabled={!canManage} onClick={() => setMode("direct_knockout")} className={`rounded-xl border p-5 text-left transition ${mode === "direct_knockout" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/40"}`}><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><GitBranch className="h-5 w-5" /></div><h2 className="font-semibold">Eliminatoria directa</h2><p className="mt-1 text-sm text-muted-foreground">La clasificación de la primera fase alimenta directamente el cuadro eliminatorio.</p></button>
      <button type="button" disabled={!canManage} onClick={() => setMode("second_group_stage")} className={`rounded-xl border p-5 text-left transition ${mode === "second_group_stage" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/40"}`}><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Layers3 className="h-5 w-5" /></div><h2 className="font-semibold">Segunda fase de grupos</h2><p className="mt-1 text-sm text-muted-foreground">Los equipos se redistribuyen según su posición antes de generar las eliminatorias.</p></button>
    </div>
    <Card><CardContent className="grid gap-5 p-5 sm:grid-cols-2">{mode === "direct_knockout" ? <div className="space-y-2 sm:col-span-2"><Label htmlFor="first-qualifiers">Equipos clasificados por grupo</Label><Input id="first-qualifiers" type="number" min={1} max={64} value={firstQualifiers} disabled={!canManage} onChange={(event) => setFirstQualifiers(Math.max(1, Number(event.target.value) || 1))} /><p className="text-xs text-muted-foreground">Se aplicará sobre la clasificación de la primera fase.</p></div> : <div className="space-y-2 sm:col-span-2"><Label htmlFor="second-groups">Grupos en la segunda fase</Label><Input id="second-groups" type="number" min={1} max={32} value={secondGroups} disabled={!canManage} onChange={(event) => setSecondGroups(Math.max(1, Number(event.target.value) || 1))} /><p className="text-xs text-muted-foreground">Los equipos que pasarán a eliminatorias se decidirán después de generar esta segunda fase.</p></div>}</CardContent></Card>
    {message && <p className={`text-sm ${message.type === "error" ? "text-destructive" : "text-emerald-600"}`} role="status">{message.text}</p>}
    {canManage ? <Button onClick={save} disabled={busy}><Save className="mr-2 h-4 w-4" />{busy ? "Guardando..." : "Guardar formato"}{busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}</Button> : <p className="text-sm text-muted-foreground">Solo los administradores del torneo pueden modificar estos ajustes.</p>}
  </div>
}
