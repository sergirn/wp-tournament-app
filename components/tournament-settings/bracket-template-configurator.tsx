"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { GitBranch, Loader2, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Group { id: string; name: string; teamCount: number }

export function BracketTemplateConfigurator({ tournamentId, sourcePhaseId, groups, qualifiersPerGroup: initialQualifiersPerGroup, existing, resolved, canManage, canReset, chooseQualifiers = false }: {
  tournamentId: string
  sourcePhaseId: string | null
  groups: Group[]
  qualifiersPerGroup: number
  existing: boolean
  resolved: boolean
  canManage: boolean
  canReset: boolean
  chooseQualifiers?: boolean
}) {
  const router = useRouter()
  const largestGroup = Math.max(1, ...groups.map((group) => group.teamCount))
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(Math.min(Math.max(1, initialQualifiersPerGroup), largestGroup))
  const available = useMemo(() => groups.flatMap((group) => Array.from({ length: Math.min(qualifiersPerGroup, group.teamCount) }, (_, index) => ({ key: `${group.id}:${index + 1}`, sourceGroupId: group.id, sourcePosition: index + 1, label: `${index + 1}.º de ${group.name}` }))), [groups, qualifiersPerGroup])
  const [order, setOrder] = useState(() => available.map((seed) => seed.key))
  useEffect(() => setOrder(available.map((seed) => seed.key)), [available])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const byKey = new Map(available.map((seed) => [seed.key, seed]))
  const bracketSize = 2 ** Math.ceil(Math.log2(Math.max(2, order.length)))
  const matchCount = bracketSize / 2

  async function create() {
    if (!sourcePhaseId) return
    setBusy(true); setError("")
    const seeds = order.map((key) => byKey.get(key)!).filter(Boolean).map(({ sourceGroupId, sourcePosition }) => ({ sourceGroupId, sourcePosition }))
    const response = await fetch(`/api/tournaments/${tournamentId}/bracket-template`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourcePhaseId, qualifiersPerGroup, seeds }) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setError(result.error || "No se pudo crear la plantilla eliminatoria")
    else router.refresh()
    setBusy(false)
  }
  async function reset() {
    if (!confirm("Se eliminará la plantilla eliminatoria y sus cruces. ¿Continuar?")) return
    setBusy(true); setError("")
    const response = await fetch(`/api/tournaments/${tournamentId}/bracket?mode=all`, { method: "DELETE" })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setError(result.error || "No se pudo eliminar la plantilla")
    else router.refresh()
    setBusy(false)
  }

  if (existing) return <Card><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{resolved ? "Plazas resueltas con equipos" : "Plantilla eliminatoria preparada"}</p><p className="text-sm text-muted-foreground">{resolved ? "Puedes confirmar o modificar los cruces con los equipos reales." : "Los equipos se asignarán automáticamente cuando termine la fase de origen."}</p></div>{canManage && <Button variant="outline" disabled={busy || !canReset} onClick={reset}><RefreshCcw className="mr-2 h-4 w-4" />Rehacer eliminatorias</Button>}{error && <p className="text-sm text-destructive">{error}</p>}</CardContent></Card>
  if (!canManage) return <Card><CardContent className="py-10 text-center text-muted-foreground">Las eliminatorias todavía no están configuradas.</CardContent></Card>
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5" />Generar cuadro eliminatorio</CardTitle></CardHeader><CardContent className="space-y-5">{chooseQualifiers && <div className="max-w-sm space-y-2"><Label htmlFor="knockout-qualifiers">Equipos que pasan de cada grupo</Label><Input id="knockout-qualifiers" type="number" min={1} max={largestGroup} value={qualifiersPerGroup} onChange={(event) => setQualifiersPerGroup(Math.min(largestGroup, Math.max(1, Number(event.target.value) || 1)))} /><p className="text-xs text-muted-foreground">El cuadro se generará con los primeros clasificados de cada grupo de esta segunda fase. Si un grupo tiene menos equipos, pasarán todos los disponibles.</p></div>}<p className="text-sm text-muted-foreground">Cambia cualquier plaza para personalizar los enfrentamientos. Las plazas sin rival quedarán exentas.</p><div className="grid gap-4 md:grid-cols-2">{Array.from({ length: matchCount }, (_, matchIndex) => <div key={matchIndex} className="rounded-xl border p-4"><p className="mb-3 text-sm font-semibold">Cruce {matchIndex + 1}</p><div className="space-y-2">{[matchIndex, matchCount + matchIndex].map((index, slotIndex) => { if (index >= order.length) return <div key={slotIndex} className="rounded-md border border-dashed p-2 text-sm text-muted-foreground">Exento</div>; return <Select key={slotIndex} value={order[index]} onValueChange={(value) => setOrder((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{available.map((seed) => <SelectItem key={seed.key} value={seed.key} disabled={order.includes(seed.key) && order[index] !== seed.key}>{seed.label}</SelectItem>)}</SelectContent></Select> })}</div></div>)}</div>{error && <p className="text-sm text-destructive">{error}</p>}<Button onClick={create} disabled={busy || available.length < 2 || new Set(order).size !== order.length}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitBranch className="mr-2 h-4 w-4" />}Generar cuadro eliminatorio</Button></CardContent></Card>
}
