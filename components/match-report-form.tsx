"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { TeamPanel } from "./match-report-form/team-panel"
import { ScorePanel } from "./match-report-form/score-panel"

interface Team {
  id: string
  name: string
  logo_url?: string | null
}

interface Player {
  id: string
  name: string
  cap_number: number
  goals: number
  exclusions: number
}

interface MatchReportFormProps {
  teams: Team[]
  tournamentId: string
  initialTeamAId?: string
  initialTeamBId?: string
  fixedGroupId?: string
  skipGroupLookup?: boolean
  lockTeams?: boolean
  onSaved?: () => void
}

export function MatchReportForm({ teams, tournamentId, initialTeamAId = "", initialTeamBId = "", fixedGroupId, skipGroupLookup = false, lockTeams = false, onSaved }: MatchReportFormProps) {
  const [teamAId, setTeamAId] = useState(initialTeamAId)
  const [teamBId, setTeamBId] = useState(initialTeamBId)
  const [teamAPlayers, setTeamAPlayers] = useState<Player[]>([])
  const [teamBPlayers, setTeamBPlayers] = useState<Player[]>([])
  const [comments, setComments] = useState("")
  const [loading, setLoading] = useState(false)
  const [playersError, setPlayersError] = useState<string | null>(null)
  const playerRequest = useRef({ A: 0, B: 0 })
  const liveMatchId = useRef<string | null>(null)
  const liveMatchRequest = useRef<Promise<string> | null>(null)
  const liveEventQueue = useRef<Promise<void>>(Promise.resolve())

  const teamAScore = teamAPlayers.reduce((sum, p) => sum + p.goals, 0)
  const teamBScore = teamBPlayers.reduce((sum, p) => sum + p.goals, 0)

  useEffect(() => {
    if (teamAId) void loadPlayers(teamAId, "A")
    else setTeamAPlayers([])
  }, [teamAId])

  useEffect(() => {
    if (teamBId) void loadPlayers(teamBId, "B")
    else setTeamBPlayers([])
  }, [teamBId])

  const loadPlayers = async (teamId: string, team: "A" | "B") => {
    const requestId = ++playerRequest.current[team]
    setPlayersError(null)
    const supabase = createClient()
    const { data, error } = await supabase.from("players").select("id, name, cap_number").eq("team_id", teamId).order("cap_number")
    if (requestId !== playerRequest.current[team]) return
    if (error) {
      if (team === "A") setTeamAPlayers([])
      else setTeamBPlayers([])
      setPlayersError(`No se pudieron cargar los jugadores: ${error.message}`)
      return
    }

    const playersWithStats = (data || []).map((p) => ({
      ...p,
      goals: 0,
      exclusions: 0,
    }))

    if (team === "A") {
      setTeamAPlayers(playersWithStats)
    } else {
      setTeamBPlayers(playersWithStats)
    }
  }

  const updatePlayerStat = (team: "A" | "B", playerId: string, stat: "goals" | "exclusions", delta: number) => {
    const setter = team === "A" ? setTeamAPlayers : setTeamBPlayers
    const currentPlayer = (team === "A" ? teamAPlayers : teamBPlayers).find((player) => player.id === playerId)
    if (!currentPlayer) return
    const maximum = stat === "exclusions" ? 3 : Number.MAX_SAFE_INTEGER
    const nextValue = Math.max(0, Math.min(maximum, currentPlayer[stat] + delta))
    const appliedDelta = nextValue - currentPlayer[stat]
    if (appliedDelta === 0) return
    setter((prev) =>
      prev.map((p) => {
        if (p.id === playerId) {
          return { ...p, [stat]: Math.max(0, Math.min(maximum, p[stat] + appliedDelta)) }
        }
        return p
      }),
    )
    if (teamAId && teamBId && teamAId !== teamBId) {
      liveEventQueue.current = liveEventQueue.current.then(() => publishLiveEvent(playerId, stat === "goals" ? "goal" : "exclusion", appliedDelta)).catch((error) => {
        setPlayersError(error instanceof Error ? error.message : "No se pudo publicar el cambio en directo")
      })
    }
  }

  const ensureLiveMatch = async () => {
    if (liveMatchId.current) return liveMatchId.current
    if (!liveMatchRequest.current) {
      liveMatchRequest.current = fetch(`/api/tournaments/${tournamentId}/match-reports`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: fixedGroupId || null, teamAId, teamBId }),
      }).then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "No se pudo iniciar el partido en directo")
        liveMatchId.current = result.matchId
        return result.matchId as string
      }).finally(() => { liveMatchRequest.current = null })
    }
    return liveMatchRequest.current
  }

  useEffect(() => {
    if (!lockTeams || !teamAId || !teamBId || teamAId === teamBId) return
    void ensureLiveMatch().catch((error) => {
      setPlayersError(error instanceof Error ? error.message : "No se pudo iniciar el partido en directo")
    })
  }, [lockTeams, teamAId, teamBId])

  const publishLiveEvent = async (playerId: string, eventType: "goal" | "exclusion", delta: number) => {
    const matchId = await ensureLiveMatch()
    const response = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, eventType, delta }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || "No se pudo publicar el evento")
  }

  const handleSave = async () => {
    if (!teamAId || !teamBId) {
      alert("Selecciona ambos equipos")
      return
    }

    setLoading(true)
    try {
      await liveEventQueue.current
      if (teamAId === teamBId) throw new Error("Selecciona dos equipos diferentes")
      let groupId = fixedGroupId || null
      if (!groupId && !skipGroupLookup) {
        const supabase = createClient()
        const { data: groupData, error: groupError } = await supabase
          .from("group_members")
          .select("group_id, groups!inner(tournament_id)")
          .eq("team_id", teamAId)
          .eq("groups.tournament_id", tournamentId)
          .maybeSingle()
        if (groupError) throw new Error("No se pudo determinar el grupo del partido")
        groupId = groupData?.group_id || null
      }

      const events = [
        ...teamAPlayers.flatMap((p) => [
          ...Array(p.goals).fill({ player_id: p.id, event_type: "goal" }),
          ...Array(p.exclusions).fill({ player_id: p.id, event_type: "exclusion" }),
        ]),
        ...teamBPlayers.flatMap((p) => [
          ...Array(p.goals).fill({ player_id: p.id, event_type: "goal" }),
          ...Array(p.exclusions).fill({ player_id: p.id, event_type: "exclusion" }),
        ]),
      ].map((event) => ({ playerId: event.player_id, eventType: event.event_type }))

      const response = await fetch(liveMatchId.current ? `/api/tournaments/${tournamentId}/matches/${liveMatchId.current}` : `/api/tournaments/${tournamentId}/match-reports`, {
        method: liveMatchId.current ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(liveMatchId.current ? {
          teamAScore,
          teamBScore,
          matchDate: new Date().toISOString(),
          location: "",
          comments,
          status: "finished",
          events,
        } : {
          groupId,
          teamAId,
          teamBId,
          teamAScore,
          teamBScore,
          comments,
          events,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo guardar el acta")

      alert("Acta guardada correctamente")
      if (!lockTeams) {
        setTeamAId("")
        setTeamBId("")
      }
      setComments("")
      liveMatchId.current = null
      setTeamAPlayers([])
      setTeamBPlayers([])
      onSaved?.()
    } catch (error) {
      console.error("Error saving match:", error)
      alert(error instanceof Error ? error.message : "Error al guardar el acta")
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = () => {
    const doc = new jsPDF()

    const teamAName = teams.find((t) => t.id === teamAId)?.name || "Equipo A"
    const teamBName = teams.find((t) => t.id === teamBId)?.name || "Equipo B"

    doc.setFontSize(20)
    doc.text("ACTA DE PARTIDO - WATERPOLO", 105, 20, { align: "center" })

    doc.setFontSize(16)
    doc.text(`${teamAName} ${teamAScore} - ${teamBScore} ${teamBName}`, 105, 35, { align: "center" })

    doc.setFontSize(14)
    doc.text(teamAName, 14, 50)
    autoTable(doc, {
      startY: 55,
      head: [["Gorro", "Jugador", "Goles", "Exclusiones"]],
      body: teamAPlayers.map((p) => [p.cap_number, p.name, p.goals, p.exclusions]),
      margin: { left: 14, right: 105 },
    })

    doc.text(teamBName, 110, 50)
    autoTable(doc, {
      startY: 55,
      head: [["Gorro", "Jugador", "Goles", "Exclusiones"]],
      body: teamBPlayers.map((p) => [p.cap_number, p.name, p.goals, p.exclusions]),
      margin: { left: 110 },
    })

    doc.save(`acta-${teamAName}-vs-${teamBName}.pdf`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)] md:overflow-hidden xl:grid-cols-[minmax(0,1fr)_250px_minmax(0,1fr)]">
        {/* EQUIPO A COLUMN */}
        <TeamPanel
          team="A"
          teams={lockTeams ? teams.filter((team) => team.id === teamAId) : teams}
          selectedTeamId={teamAId}
          onTeamChange={lockTeams ? () => {} : setTeamAId}
          players={teamAPlayers}
          onUpdateStat={updatePlayerStat}
          excludedTeamId={teamBId}
        />

        {/* MARCADOR Y CONTROLES CENTRALES */}
        <ScorePanel
          teamAScore={teamAScore}
          teamBScore={teamBScore}
          comments={comments}
          onCommentsChange={setComments}
          onSave={handleSave}
          onDownloadPDF={handleDownloadPDF}
          loading={loading}
          canSave={!!(teamAId && teamBId && teamAId !== teamBId)}
        />

        {/* EQUIPO B COLUMN */}
        <TeamPanel
          team="B"
          teams={lockTeams ? teams.filter((team) => team.id === teamBId) : teams}
          selectedTeamId={teamBId}
          onTeamChange={lockTeams ? () => {} : setTeamBId}
          players={teamBPlayers}
          onUpdateStat={updatePlayerStat}
          excludedTeamId={teamAId}
        />
      </div>
      {playersError && <p className="px-4 py-2 text-sm text-destructive" role="alert">{playersError}</p>}
    </div>
  )
}
