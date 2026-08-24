"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlayerRow } from "./player-row"
import { TeamLogo } from "@/components/team-logo"

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

interface TeamPanelProps {
  team: "A" | "B"
  teams: Team[]
  selectedTeamId: string
  onTeamChange: (teamId: string) => void
  players: Player[]
  onUpdateStat: (team: "A" | "B", playerId: string, stat: "goals" | "exclusions", delta: number) => void
  excludedTeamId?: string
}

export function TeamPanel({ team, teams, selectedTeamId, onTeamChange, players, onUpdateStat, excludedTeamId }: TeamPanelProps) {
  const selectedTeam = teams.find((t) => t.id === selectedTeamId)
  const teamName = selectedTeam?.name || `Equipo ${team}`

  return (
    <section className={`flex min-h-[360px] flex-col overflow-hidden bg-card text-foreground md:min-h-0 ${team === "A" ? "md:border-r" : "md:border-l"}`}>
      <div className="shrink-0 border-b bg-muted/15 p-3">
        <Select value={selectedTeamId} onValueChange={onTeamChange}>
          <SelectTrigger className="mb-3 h-10 w-full bg-background">
            <SelectValue placeholder={`Seleccionar Equipo ${team}`} />
          </SelectTrigger>
          <SelectContent>
            {teams.filter((item) => item.id !== excludedTeamId || item.id === selectedTeamId).map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center justify-center gap-3">
          <TeamLogo name={teamName} logoUrl={selectedTeam?.logo_url} className="h-10 w-10 bg-background" />
          <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Equipo {team}</p><h2 className="truncate text-base font-bold text-foreground">{teamName}</h2></div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/40 scrollbar-track-transparent">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
            <tr className="border-b border-primary/20">
              <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Gorro
              </th>
              <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Jugador
              </th>
              <th className="text-center p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Goles
              </th>
              <th className="text-center p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Excl.
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <PlayerRow key={player.id} player={player} team={team} onUpdateStat={onUpdateStat} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
