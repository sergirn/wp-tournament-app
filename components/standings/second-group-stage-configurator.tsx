"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2, RefreshCcw, Shuffle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

interface SourceGroup { id: string; name: string; teamCount: number }
interface Assignment { sourceGroupId: string; sourceGroupName: string; sourcePosition: number; destination: number }

function groupLetter(index: number) {
  let value = index + 1
  let label = ""
  while (value > 0) {
    value -= 1
    label = String.fromCharCode(65 + (value % 26)) + label
    value = Math.floor(value / 26)
  }
  return label
}

export function SecondGroupStageConfigurator({ tournamentId, sourcePhaseId, sourceGroups, existingPhaseId, existingStatus, canManage, canReset, defaultGroupCount, defaultQualifiers }: {
  tournamentId: string
  sourcePhaseId: string | null
  sourceGroups: SourceGroup[]
  existingPhaseId: string | null
  existingStatus?: string | null
  canManage: boolean
  canReset: boolean
  defaultGroupCount?: number
  defaultQualifiers?: number
}) {
  const router = useRouter()
  const [groupCount, setGroupCount] = useState(Math.max(1, defaultGroupCount || sourceGroups.length))
  const [qualifiers, setQualifiers] = useState(Math.max(1, defaultQualifiers || 2))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const initialAssignments = useMemo(() => {
    const sourceGroupCount = Math.max(1, sourceGroups.length)
    return sourceGroups.flatMap((group, groupIndex) =>
    Array.from({ length: group.teamCount }, (_, positionIndex) => ({
      sourceGroupId: group.id,
      sourceGroupName: group.name,
      sourcePosition: positionIndex + 1,
      destination: ((groupIndex - positionIndex) % sourceGroupCount + sourceGroupCount) % sourceGroupCount,
    })))
  }, [sourceGroups])
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const assignments = initialAssignments.map((assignment) => ({
    ...assignment,
    destination: overrides[`${assignment.sourceGroupId}:${assignment.sourcePosition}`] ?? ((assignment.destination % groupCount + groupCount) % groupCount),
  }))
  const destinationSizes = Array.from({ length: groupCount }, (_, index) => assignments.filter((item) => item.destination === index).length)
  const largestGroupSize = Math.max(1, ...destinationSizes)

  async function createStage() {
    if (!sourcePhaseId) return
    const groups = Array.from({ length: groupCount }, (_, index) => ({
      name: `Grupo ${groupLetter(index)}`,
      slots: assignments.filter((item) => item.destination === index).map((item) => ({ sourceGroupId: item.sourceGroupId, sourcePosition: item.sourcePosition })),
    }))
    const assignedSlots = groups.flatMap((group) => group.slots)
    const uniqueSlots = new Set(assignedSlots.map((slot) => `${slot.sourceGroupId}:${slot.sourcePosition}`))
    if (assignedSlots.length !== assignments.length || uniqueSlots.size !== assignments.length) {
      setError("La distribución está incompleta. Revisa que cada posición aparezca una sola vez.")
      return
    }
    setBusy(true); setError("")
    const response = await fetch(`/api/tournaments/${tournamentId}/group-stages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourcePhaseId, qualifiersPerGroup: qualifiers, groups }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setError(result.error || "No se pudo crear la segunda fase")
    else router.refresh()
    setBusy(false)
  }

  async function resetStage() {
    if (!existingPhaseId) return
    setBusy(true); setError("")
    const response = await fetch(`/api/tournaments/${tournamentId}/group-stages?phaseId=${existingPhaseId}`, { method: "DELETE" })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setError(result.error || "No se pudo eliminar la segunda fase")
    else router.refresh()
    setBusy(false)
  }

  if (existingPhaseId) return <Card><CardContent className="space-y-4 p-5"><div><p className="font-semibold">{existingStatus === "generated" ? "Segunda fase resuelta" : "Estructura de la segunda fase guardada"}</p><p className="text-sm text-muted-foreground">{existingStatus === "generated" ? "Los equipos ya se asignaron según la clasificación real." : "Las plazas se resolverán automáticamente cuando termine la primera fase."}</p></div>{canManage && <div className="flex flex-wrap gap-2"><AlertDialog><AlertDialogTrigger asChild><Button variant="outline" disabled={busy || !canReset}><RefreshCcw className="mr-2 h-4 w-4" />Editar distribución</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Reconfigurar la segunda fase?</AlertDialogTitle><AlertDialogDescription>Se eliminarán la segunda fase completa y todas las eliminatorias posteriores que estén 0-0. Los resultados de la primera fase se conservarán y podrás crear una nueva distribución.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={resetStage}>Continuar y reconfigurar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" disabled={busy || !canReset}>Eliminar segunda fase completa</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar la segunda fase completa?</AlertDialogTitle><AlertDialogDescription>Se eliminarán sus grupos, plazas, partidos 0-0, eventos y todas las eliminatorias posteriores. La primera fase y sus resultados no se modificarán.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={resetStage}>Eliminar fase completa</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>}{!canReset && <p className="text-xs text-destructive">La fase está protegida porque ella o alguna fase posterior contiene resultados con goles.</p>}{error && <p className="text-sm text-destructive">{error}</p>}</CardContent></Card>
  if (!canManage) return <Card><CardContent className="py-10 text-center text-muted-foreground">La segunda fase todavía no está configurada.</CardContent></Card>

  return <div className="space-y-5">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Shuffle className="h-5 w-5" />Configurar segunda fase de grupos</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="second-group-count">Número de grupos</Label><Input id="second-group-count" type="number" min={1} max={Math.max(1, Math.floor(assignments.length / 2))} value={groupCount} onChange={(event) => { const next = Math.max(1, Math.min(Number(event.target.value) || 1, Math.max(1, Math.floor(assignments.length / 2)))); setGroupCount(next); setOverrides({}) }} /></div><div className="space-y-2"><Label htmlFor="second-qualifiers">Máximo de clasificados por grupo</Label><Input id="second-qualifiers" type="number" min={1} max={largestGroupSize} value={qualifiers} onChange={(event) => setQualifiers(Math.max(1, Number(event.target.value) || 1))} /><p className="text-xs text-muted-foreground">Si un grupo tiene menos equipos, se clasificarán todos los disponibles.</p></div></CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: groupCount }, (_, destination) => <Card key={destination}><CardHeader className="pb-3"><CardTitle className="text-base">Grupo {groupLetter(destination)} · {destinationSizes[destination]} equipos</CardTitle></CardHeader><CardContent className="space-y-2">{assignments.filter((item) => item.destination === destination).map((item) => <div key={`${item.sourceGroupId}:${item.sourcePosition}`} className="flex items-center justify-between gap-3 rounded-lg border p-3"><span className="text-sm font-medium">{item.sourcePosition}.º de {item.sourceGroupName}</span><Select value={String(item.destination)} onValueChange={(value) => setOverrides((current) => ({ ...current, [`${item.sourceGroupId}:${item.sourcePosition}`]: Number(value) }))}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: groupCount }, (_, index) => <SelectItem key={index} value={String(index)}>Grupo {groupLetter(index)}</SelectItem>)}</SelectContent></Select></div>)}</CardContent></Card>)}</div>
    {destinationSizes.some((size) => size < 2) && <p className="text-sm text-destructive">Todos los grupos deben tener al menos dos equipos.</p>}
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    <Button className="w-full sm:w-auto" onClick={createStage} disabled={busy || !sourcePhaseId || destinationSizes.some((size) => size < 2)}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}Generar segunda fase</Button>
  </div>
}
