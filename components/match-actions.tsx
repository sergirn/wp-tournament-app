"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TeamPanel } from "@/components/match-report-form/team-panel"
import { MatchReportPDF } from "@/components/match-report-pdf"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface MatchSummary {
  id: string
  teamAName: string
  teamBName: string
}

interface Player {
  id: string
  name: string
  cap_number: number
  goals: number
  exclusions: number
}

interface MatchReportData {
  team_a_id: string
  team_b_id: string
  team_a: { id: string; name: string }
  team_b: { id: string; name: string }
  team_a_score: number
  team_b_score: number
  teamAPlayers: Player[]
  teamBPlayers: Player[]
  match_date: string
  location: string | null
  comments: string | null
  status: "scheduled" | "in_progress" | "finished"
}

export function MatchActions({ tournamentId, match, reportOnly = false, actionLabel = "Editar acta" }: { tournamentId: string; match: MatchSummary; reportOnly?: boolean; actionLabel?: string }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<MatchReportData | null>(null)
  const [matchDate, setMatchDate] = useState("")
  const [location, setLocation] = useState("")
  const [comments, setComments] = useState("")
  const [status, setStatus] = useState<MatchReportData["status"]>("finished")
  const [teamAScore, setTeamAScore] = useState(0)
  const [teamBScore, setTeamBScore] = useState(0)
  const endpoint = `/api/tournaments/${tournamentId}/matches/${match.id}`

  const publishLiveDelta = async (playerId: string, eventType: "goal" | "exclusion", delta: number) => {
    if (status === "finished") return
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, eventType, delta }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo publicar el cambio")
      setStatus("in_progress")
      setTeamAScore(result.teamAScore)
      setTeamBScore(result.teamBScore)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo publicar el cambio en directo")
    }
  }

  const openEditor = async () => {
    setEditOpen(true)
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const response = await fetch(endpoint)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo cargar el acta")
      const loaded = result.match as MatchReportData
      setReport(loaded)
      setMatchDate(loaded.match_date)
      setLocation(loaded.location || "")
      setComments(loaded.comments || "")
      setStatus(loaded.status)
      setTeamAScore(loaded.team_a_score)
      setTeamBScore(loaded.team_b_score)
      if (loaded.status === "scheduled") {
        const liveResponse = await fetch(endpoint, { method: "POST" })
        const liveResult = await liveResponse.json()
        if (!liveResponse.ok) throw new Error(liveResult.error || "No se pudo iniciar el directo")
        setStatus("in_progress")
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el acta")
    } finally {
      setLoading(false)
    }
  }

  const updatePlayerStat = (team: "A" | "B", playerId: string, stat: "goals" | "exclusions", delta: number) => {
    if (!report) return
    const key = team === "A" ? "teamAPlayers" : "teamBPlayers"
    const changedPlayer = report[key].find((player) => player.id === playerId)
    if (!changedPlayer) return
    const maximum = stat === "exclusions" ? 3 : Number.MAX_SAFE_INTEGER
    const nextValue = Math.max(0, Math.min(maximum, changedPlayer[stat] + delta))
    const appliedDelta = nextValue - changedPlayer[stat]
    if (appliedDelta === 0) return

    setReport((current) => {
      if (!current) return current
      const players = current[key].map((player) => player.id === playerId
        ? { ...player, [stat]: Math.max(0, Math.min(maximum, player[stat] + appliedDelta)) }
        : player)
      return { ...current, [key]: players }
    })
    if (stat === "goals") {
      const scoreSetter = team === "A" ? setTeamAScore : setTeamBScore
      scoreSetter((score) => Math.max(0, score + appliedDelta))
    }
    if (status !== "finished") void publishLiveDelta(playerId, stat === "goals" ? "goal" : "exclusion", appliedDelta)
  }

  const updateMatch = async () => {
    if (!report) return
    setLoading(true)
    setError(null)
    try {
      const assignedTeamAGoals = report.teamAPlayers.reduce((sum, player) => sum + player.goals, 0)
      const assignedTeamBGoals = report.teamBPlayers.reduce((sum, player) => sum + player.goals, 0)
      if (teamAScore < assignedTeamAGoals || teamBScore < assignedTeamBGoals) {
        throw new Error("El marcador no puede ser menor que los goles asignados a jugadores")
      }
      const parsedDate = new Date(matchDate)
      if (Number.isNaN(parsedDate.getTime())) throw new Error("Introduce una fecha y hora vÃ¡lidas")
      const events = [...report.teamAPlayers, ...report.teamBPlayers].flatMap((player) => [
        ...Array.from({ length: player.goals }, () => ({ playerId: player.id, eventType: "goal" as const })),
        ...Array.from({ length: player.exclusions }, () => ({ playerId: player.id, eventType: "exclusion" as const })),
      ])
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamAScore, teamBScore, matchDate: parsedDate.toISOString(), location, comments, status: "finished", events }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo actualizar el acta")
      setStatus("finished")
      setEditOpen(false)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar el acta")
    } finally {
      setLoading(false)
    }
  }

  const deleteMatch = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(endpoint, { method: "DELETE" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo eliminar el partido")
      setDeleteOpen(false)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo eliminar el partido")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div
        className={
          reportOnly
            ? "w-full"
            : "absolute right-3 top-3 z-20 flex gap-2"
        }
      >
        <Button
          type="button"
          size={reportOnly ? "default" : "icon"}
          variant={reportOnly ? "default" : "outline"}
          className={
            reportOnly
              ? "h-12 w-full gap-2 rounded-t-none rounded-b-xl text-sm font-semibold"
              : "h-9 w-9 bg-background/90"
          }
          onClick={() => void openEditor()}
          aria-label="Editar acta"
        >
          <Pencil className="h-4 w-4" />

          {reportOnly && actionLabel}
        </Button>

        {!reportOnly && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 bg-background/90 text-destructive hover:text-destructive"
            onClick={() => {
              setError(null)
              setDeleteOpen(true)
            }}
            aria-label="Eliminar partido"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="!inset-3 flex !h-[calc(100dvh-1.5rem)] !w-auto !max-w-none !translate-x-0 !translate-y-0 flex-col gap-3 overflow-hidden p-3 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:p-5"
          showCloseButton={!loading}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>Editar acta del partido</DialogTitle>
            <DialogDescription>{match.teamAName} contra {match.teamBName}. Modifica goles, exclusiones y comentarios.</DialogDescription>
          </DialogHeader>
          {loading && !report ? <div className="flex flex-1 items-center justify-center text-muted-foreground">Cargando acta...</div> : report ? (
            <>
              <div className="grid min-h-0 flex-1 overflow-auto rounded-2xl border bg-card shadow-sm md:grid-cols-[minmax(0,1fr)_240px_minmax(0,1fr)] md:overflow-hidden xl:grid-cols-[minmax(0,1fr)_280px_minmax(0,1fr)]">
                <TeamPanel team="A" teams={[report.team_a]} selectedTeamId={report.team_a_id} onTeamChange={() => {}} players={report.teamAPlayers} onUpdateStat={updatePlayerStat} />
                <div className="flex flex-col justify-between gap-4 border-y bg-muted/10 p-4 md:border-y-0">
                  <div className="text-center"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Marcador del partido</p><div className="mt-3 rounded-xl bg-background px-2 py-5 text-5xl font-black tabular-nums shadow-sm">{teamAScore} <span className="font-medium text-muted-foreground">—</span> {teamBScore}</div><p className="mt-2 text-[11px] text-muted-foreground">{status === "in_progress" ? "● Publicando cambios en directo" : status === "scheduled" ? "El primer cambio iniciará el directo" : "Partido finalizado: los cambios se publican al guardar"}</p></div>
                  <div className="space-y-2"><Label htmlFor={`comments-${match.id}`}>Comentarios</Label><Textarea id={`comments-${match.id}`} value={comments} onChange={(event) => setComments(event.target.value)} className="min-h-28" maxLength={2000} /></div>
                  {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                  <div className="space-y-2"><Button onClick={updateMatch} disabled={loading} className="w-full gap-2"><Save className="h-4 w-4" />{loading ? "Guardando..." : "Guardar acta"}</Button><MatchReportPDF match={{ ...report, team_a_score: teamAScore, team_b_score: teamBScore, comments }} teamAPlayers={report.teamAPlayers} teamBPlayers={report.teamBPlayers} className="h-10 w-full gap-2" /></div>
                </div>
                <TeamPanel team="B" teams={[report.team_b]} selectedTeamId={report.team_b_id} onTeamChange={() => {}} players={report.teamBPlayers} onUpdateStat={updatePlayerStat} />
              </div>
            </>
          ) : <div className="flex flex-1 items-center justify-center text-destructive">{error || "No se pudo cargar el acta"}</div>}
        </DialogContent>
      </Dialog>

      {!reportOnly && <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar este partido?</AlertDialogTitle><AlertDialogDescription>Se eliminarán también todos sus goles y exclusiones. Si pertenece a una eliminatoria, se reiniciará el cruce y se borrarán en cascada las rondas posteriores que dependan de este resultado. Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>{error && <p className="text-sm text-destructive" role="alert">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void deleteMatch() }} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{loading ? "Eliminando..." : "Eliminar partido"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>}
    </>
  )
}
