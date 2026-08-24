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
    setter((prev) =>
      prev.map((p) => {
        if (p.id === playerId) {
          if (stat === "exclusions") {
            const newValue = Math.max(0, Math.min(3, p[stat] + delta))
            return { ...p, [stat]: newValue }
          }
          return { ...p, [stat]: Math.max(0, p[stat] + delta) }
        }
        return p
      }),
    )
  }

  const handleSave = async () => {
    if (!teamAId || !teamBId) {
      alert("Selecciona ambos equipos")
      return
    }

    setLoading(true)
    try {
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

      const response = await fetch(`/api/tournaments/${tournamentId}/match-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
