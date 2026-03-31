"use client"

import { Button } from "@/components/ui/button"
import { Plus, Minus } from "lucide-react"

interface PlayerRowProps {
  player: {
    id: string
    name: string
    cap_number: number
    goals: number
    exclusions: number
  }
  team: "A" | "B"
  onUpdateStat: (team: "A" | "B", playerId: string, stat: "goals" | "exclusions", delta: number) => void
}

export function PlayerRow({ player, team, onUpdateStat }: PlayerRowProps) {
  const getExclusionRowClass = (exclusions: number) => {
    if (exclusions === 3) return "bg-red-900/40 border-red-700/60"
    if (exclusions === 2) return "bg-yellow-900/40 border-yellow-700/60"
    return ""
  }

  const capGradient =
    team === "A" ? "bg-gradient-to-br from-cyan-500 to-blue-600" : "bg-gradient-to-br from-orange-500 to-red-600"

  return (
    <tr
      className={`border-b border-primary/10 hover:bg-primary/5 transition-colors ${getExclusionRowClass(player.exclusions)}`}
    >
      <td className="p-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${capGradient} text-white font-bold shadow-lg text-sm`}
        >
          {player.cap_number}
        </div>
      </td>
      <td className="p-2 font-medium text-sm">{player.name}</td>
      <td className="p-2">
        <div className="flex items-center justify-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:bg-primary/20 rounded-full"
            onClick={() => onUpdateStat(team, player.id, "goals", -1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-sm">
            {player.goals}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:bg-primary/20 rounded-full"
            onClick={() => onUpdateStat(team, player.id, "goals", 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </td>
      <td className="p-2">
        <div className="flex items-center justify-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:bg-primary/20 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onUpdateStat(team, player.id, "exclusions", -1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span
            className={`inline-flex items-center justify-center h-7 w-7 rounded-full font-bold text-sm ${
              player.exclusions === 3
                ? "bg-red-500/20 text-red-400"
                : player.exclusions === 2
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-orange-500/20 text-orange-400"
            }`}
          >
            {player.exclusions}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:bg-primary/20 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onUpdateStat(team, player.id, "exclusions", 1)}
            disabled={player.exclusions >= 3}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
