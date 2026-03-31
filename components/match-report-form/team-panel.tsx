"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlayerRow } from "./player-row"

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

interface TeamPanelProps {
  team: "A" | "B"
  teams: Team[]
  selectedTeamId: string
  onTeamChange: (teamId: string) => void
  players: Player[]
  onUpdateStat: (team: "A" | "B", playerId: string, stat: "goals" | "exclusions", delta: number) => void
}

export function TeamPanel({ team, teams, selectedTeamId, onTeamChange, players, onUpdateStat }: TeamPanelProps) {
  const selectedTeam = teams.find((t) => t.id === selectedTeamId)
  const teamName = selectedTeam?.name || `Equipo ${team}`

  return (
    <div className="bg-card/80 backdrop-blur-lg border-r border-primary/30 text-foreground overflow-hidden flex flex-col">
      <div className="p-2 border-b border-primary/20 shrink-0 backdrop-blur-sm bg-card/60">
        <Select value={selectedTeamId} onValueChange={onTeamChange}>
          <SelectTrigger className="w-full bg-background/70 border-primary/30 h-9 mb-2">
            <SelectValue placeholder={`Seleccionar Equipo ${team}`} />
          </SelectTrigger>
          <SelectContent>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <h2 className="text-lg font-bold text-center tracking-tight gradient-text">{teamName}</h2>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/40 scrollbar-track-transparent">
        <table className="w-full">
          <thead className="bg-card/60 backdrop-blur-sm sticky top-0 z-10">
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
    </div>
  )
}
