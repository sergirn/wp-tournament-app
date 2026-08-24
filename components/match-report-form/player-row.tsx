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
    if (exclusions === 3) return "bg-red-500/10"
    if (exclusions === 2) return "bg-amber-500/10"
    return ""
  }

  const capGradient =
    team === "A" ? "bg-gradient-to-br from-cyan-500 to-blue-600" : "bg-gradient-to-br from-orange-500 to-red-600"

  return (
    <tr
      className={`border-b transition-colors hover:bg-muted/40 ${getExclusionRowClass(player.exclusions)}`}
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
            className="h-8 w-8 rounded-full hover:bg-primary/10"
            onClick={() => onUpdateStat(team, player.id, "goals", -1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary tabular-nums">
            {player.goals}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full hover:bg-primary/10"
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
            className="h-8 w-8 rounded-full hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onUpdateStat(team, player.id, "exclusions", -1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
              player.exclusions === 3
                ? "bg-red-500/20 text-red-400"
                : player.exclusions === 2
                  ? "bg-amber-500/15 text-amber-600"
                  : "bg-orange-500/10 text-orange-600"
            }`}
          >
            {player.exclusions}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
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
