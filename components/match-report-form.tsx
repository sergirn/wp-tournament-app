"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { TeamPanel } from "./match-report-form/team-panel"
import { ScorePanel } from "./match-report-form/score-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Team {
  id: string
  name: string
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
}

export function MatchReportForm({ teams, tournamentId }: MatchReportFormProps) {
  const [teamAId, setTeamAId] = useState("")
  const [teamBId, setTeamBId] = useState("")
  const [teamAPlayers, setTeamAPlayers] = useState<Player[]>([])
  const [teamBPlayers, setTeamBPlayers] = useState<Player[]>([])
  const [comments, setComments] = useState("")
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    if (teamAId) loadPlayers(teamAId, "A")
  }, [teamAId])

  useEffect(() => {
    if (teamBId) loadPlayers(teamBId, "B")
  }, [teamBId])

  const loadPlayers = async (teamId: string, team: "A" | "B") => {
    const supabase = createClient()
    const { data } = await supabase.from("players").select("*").eq("team_id", teamId).order("cap_number")

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
    const supabase = createClient()

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("Usuario no autenticado")
      }

      const { data: groupData } = await supabase
        .from("group_members")
        .select("group_id, groups!inner(tournament_id)")
        .eq("team_id", teamAId)
        .eq("groups.tournament_id", tournamentId)
        .single()

      const groupId = groupData?.group_id || null

      const { data: match, error: matchError } = await supabase
        .from("matches")
        .insert({
          tournament_id: tournamentId,
          group_id: groupId,
          team_a_id: teamAId,
          team_b_id: teamBId,
          team_a_score: teamAPlayers.reduce((sum, p) => sum + p.goals, 0),
          team_b_score: teamBPlayers.reduce((sum, p) => sum + p.goals, 0),
          match_date: new Date().toISOString(),
          status: "finished",
          created_by: user.id,
          comments: comments || null,
        })
        .select()
        .single()

      if (matchError) throw matchError

      const events = [
        ...teamAPlayers.flatMap((p) => [
          ...Array(p.goals).fill({ player_id: p.id, event_type: "goal" }),
          ...Array(p.exclusions).fill({ player_id: p.id, event_type: "exclusion" }),
        ]),
        ...teamBPlayers.flatMap((p) => [
          ...Array(p.goals).fill({ player_id: p.id, event_type: "goal" }),
          ...Array(p.exclusions).fill({ player_id: p.id, event_type: "exclusion" }),
        ]),
      ].map((e) => ({ ...e, match_id: match.id }))

      if (events.length > 0) {
        const { error: eventsError } = await supabase.from("match_events").insert(events)
        if (eventsError) throw eventsError
      }

      alert("Acta guardada correctamente")
      setTeamAId("")
      setTeamBId("")
      setComments("")
      setTeamAPlayers([])
      setTeamBPlayers([])
    } catch (error) {
      console.error("Error saving match:", error)
      alert("Error al guardar el acta")
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
    doc.text(
      `${teamAName} ${teamAPlayers.reduce((sum, p) => sum + p.goals, 0)} - ${teamBPlayers.reduce((sum, p) => sum + p.goals, 0)} ${teamBName}`,
      105,
      35,
      { align: "center" },
    )

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

  const teamAScore = teamAPlayers.reduce((sum, p) => sum + p.goals, 0)
  const teamBScore = teamBPlayers.reduce((sum, p) => sum + p.goals, 0)

  return (
    <div className="h-full flex flex-col bg-background">
      {isMobile ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="team-a" className="flex-1 flex flex-col">
            <TabsList className="w-full grid grid-cols-3 h-12 shrink-0">
              <TabsTrigger value="team-a" className="text-xs sm:text-sm">
                Equipo A
              </TabsTrigger>
              <TabsTrigger value="score" className="text-xs sm:text-sm">
                Marcador
              </TabsTrigger>
              <TabsTrigger value="team-b" className="text-xs sm:text-sm">
                Equipo B
              </TabsTrigger>
            </TabsList>

            <TabsContent value="team-a" className="flex-1 mt-0 overflow-hidden">
              <TeamPanel
                team="A"
                teams={teams}
                selectedTeamId={teamAId}
                onTeamChange={setTeamAId}
                players={teamAPlayers}
                onUpdateStat={updatePlayerStat}
              />
            </TabsContent>

            <TabsContent value="score" className="flex-1 mt-0 overflow-auto">
              <div className="h-full flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                  <ScorePanel
                    teamAScore={teamAScore}
                    teamBScore={teamBScore}
                    comments={comments}
                    onCommentsChange={setComments}
                    onSave={handleSave}
                    onDownloadPDF={handleDownloadPDF}
                    loading={loading}
                    canSave={!!(teamAId && teamBId)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="team-b" className="flex-1 mt-0 overflow-hidden">
              <TeamPanel
                team="B"
                teams={teams}
                selectedTeamId={teamBId}
                onTeamChange={setTeamBId}
                players={teamBPlayers}
                onUpdateStat={updatePlayerStat}
              />
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-[1fr_200px_1fr] gap-0 overflow-hidden">
          <TeamPanel
            team="A"
            teams={teams}
            selectedTeamId={teamAId}
            onTeamChange={setTeamAId}
            players={teamAPlayers}
            onUpdateStat={updatePlayerStat}
          />

          <ScorePanel
            teamAScore={teamAScore}
            teamBScore={teamBScore}
            comments={comments}
            onCommentsChange={setComments}
            onSave={handleSave}
            onDownloadPDF={handleDownloadPDF}
            loading={loading}
            canSave={!!(teamAId && teamBId)}
          />

          <TeamPanel
            team="B"
            teams={teams}
            selectedTeamId={teamBId}
            onTeamChange={setTeamBId}
            players={teamBPlayers}
            onUpdateStat={updatePlayerStat}
          />
        </div>
      )}
    </div>
  )
}
