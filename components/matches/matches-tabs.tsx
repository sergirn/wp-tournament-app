"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { CalendarDays, ChevronRight, Trophy } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TeamLogo } from "@/components/team-logo"
import { MatchActions } from "@/components/match-actions"

interface MatchItem {
  id: string; team_a_score: number | null; team_b_score: number | null; match_date: string; location: string | null; comments: string | null; group_id: string | null; created_by: string | null
  team_a: { name: string; logo_url: string | null } | null; team_b: { name: string; logo_url: string | null } | null; group: { name: string } | null
  phase: { name: string; phase_type: string; phase_order: number } | null
}

export function MatchesTabs({ tournamentId, matches, canManage, userId, groupPhaseNames }: { tournamentId: string; matches: MatchItem[]; canManage: boolean; userId: string; groupPhaseNames: string[] }) {
  const groupPhases = useMemo(() => groupPhaseNames.length ? groupPhaseNames.map((name, index) => ({ name, order: index + 1 })) : Array.from(new Map(matches.filter((match) => match.phase?.phase_type !== "knockout").map((match) => [match.phase?.name || "Fase de grupos 1", { name: match.phase?.name || "Fase de grupos 1", order: match.phase?.phase_order || 1 }])).values()).sort((a, b) => a.order - b.order), [groupPhaseNames, matches])
  const knockoutMatches = matches.filter((match) => match.phase?.phase_type === "knockout")
  const rounds = Array.from(new Map(knockoutMatches.map((match) => [match.phase?.name || "Eliminatorias", { name: match.phase?.name || "Eliminatorias", order: match.phase?.phase_order || 99 }])).values()).sort((a, b) => a.order - b.order)
  const [selectedGroups, setSelectedGroups] = useState<Record<string, string>>({})
  const hasSecondPhase = groupPhases.length > 1

  const renderMatch = (match: MatchItem, compact = false) => <div key={match.id} className="relative">
    {(canManage || match.created_by === userId) && <MatchActions tournamentId={tournamentId} match={{ id: match.id, teamAName: match.team_a?.name || "Equipo A", teamBName: match.team_b?.name || "Equipo B" }} />}
    <Link href={`/tournaments/${tournamentId}/matches/${match.id}`} className="block h-full"><Card className="h-full overflow-hidden transition-shadow hover:shadow-md"><CardContent className="flex h-full flex-col p-0"><div className="flex items-center justify-between border-b bg-muted/15 px-4 py-2.5 pr-24 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{new Date(match.match_date).toLocaleDateString("es-ES")}</span><span>Acta registrada</span></div><div className={`grid flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center ${compact ? "gap-2 px-4 py-5" : "gap-3 px-5 py-6"}`}><div className="flex min-w-0 flex-col items-center gap-2 text-center"><TeamLogo name={match.team_a?.name} logoUrl={match.team_a?.logo_url} className="h-11 w-11" /><strong className="line-clamp-2 text-sm">{match.team_a?.name || "Equipo A"}</strong></div><div className="rounded-lg bg-muted/30 px-3 py-2 text-xl font-bold tabular-nums">{match.team_a_score ?? 0}<span className="mx-1.5 text-muted-foreground">–</span>{match.team_b_score ?? 0}</div><div className="flex min-w-0 flex-col items-center gap-2 text-center"><TeamLogo name={match.team_b?.name} logoUrl={match.team_b?.logo_url} className="h-11 w-11" /><strong className="line-clamp-2 text-sm">{match.team_b?.name || "Equipo B"}</strong></div></div>{match.comments && <p className="mx-4 mb-3 line-clamp-2 rounded-lg bg-amber-500/5 p-3 text-sm">{match.comments}</p>}<div className="mt-auto flex items-center justify-end gap-1 border-t px-4 py-2.5 text-xs text-muted-foreground">Ver detalles <ChevronRight className="h-3.5 w-3.5" /></div></CardContent></Card></Link>
  </div>

  const empty = (message: string) => <Card><CardContent className="flex flex-col items-center py-14 text-center text-muted-foreground"><Trophy className="mb-3 h-7 w-7" /><p>{message}</p></CardContent></Card>
  const phaseContent = (phaseName: string, title: string) => {
    const phaseMatches = matches.filter((match) => match.phase?.phase_type !== "knockout" && (match.phase?.name || "Fase de grupos 1") === phaseName)
    const groups = Array.from(new Set(phaseMatches.map((match) => match.group?.name || "Sin grupo"))).sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
    const selected = selectedGroups[phaseName] || groups[0] || ""
    const visible = phaseMatches.filter((match) => (match.group?.name || "Sin grupo") === selected)
    return <div className="mx-auto flex max-w-6xl flex-col gap-4"><div><h1 className="text-2xl font-bold">Partidos de {title.toLowerCase()}</h1><p className="text-sm text-muted-foreground">Consulta las actas registradas y abre cualquier partido para ver sus detalles.</p></div><TabsList className={`grid h-11 w-full shrink-0 ${hasSecondPhase ? "grid-cols-3" : "grid-cols-2"}`}><TabsTrigger value="groups">Grupos 1</TabsTrigger>{hasSecondPhase && <TabsTrigger value="groups-2">Grupos 2</TabsTrigger>}<TabsTrigger value="knockout">Eliminatorias{knockoutMatches.length ? ` (${knockoutMatches.length})` : ""}</TabsTrigger></TabsList>{groups.length > 0 && <div className="grid w-full gap-2 border-b pb-3" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>{groups.map((group) => <Button key={group} variant={selected === group ? "default" : "outline"} onClick={() => setSelectedGroups((current) => ({ ...current, [phaseName]: group }))}>{group}</Button>)}</div>}<div className="grid gap-3 md:grid-cols-2">{visible.length ? visible.map((match) => renderMatch(match, true)) : <div className="md:col-span-2">{empty("No hay partidos resueltos en este grupo.")}</div>}</div></div>
  }

  return <Tabs defaultValue="groups" className="gap-4">
    <TabsContent value="groups">{phaseContent(groupPhases[0]?.name || "Fase de grupos 1", groupPhases[0]?.name || "Fase de grupos 1")}</TabsContent>
    {hasSecondPhase && <TabsContent value="groups-2">{phaseContent(groupPhases[1].name, groupPhases[1].name)}</TabsContent>}
    <TabsContent value="knockout"><div className="mx-auto max-w-6xl space-y-4"><div><h1 className="text-2xl font-bold">Partidos eliminatorios</h1><p className="text-sm text-muted-foreground">Consulta los cruces y actas de cada ronda.</p></div><TabsList className={`grid h-11 w-full shrink-0 ${hasSecondPhase ? "grid-cols-3" : "grid-cols-2"}`}><TabsTrigger value="groups">Grupos 1</TabsTrigger>{hasSecondPhase && <TabsTrigger value="groups-2">Grupos 2</TabsTrigger>}<TabsTrigger value="knockout">Eliminatorias{knockoutMatches.length ? ` (${knockoutMatches.length})` : ""}</TabsTrigger></TabsList><div className="space-y-8 pt-1">{rounds.length ? rounds.map((round) => <section key={round.name} className="space-y-4"><div className="flex items-center gap-4"><h2 className="shrink-0 text-sm font-bold uppercase tracking-wider">{round.name}</h2><div className="h-px flex-1 bg-border" /></div><div className="grid gap-4 md:grid-cols-2">{knockoutMatches.filter((match) => (match.phase?.name || "Eliminatorias") === round.name).map((match) => renderMatch(match))}</div></section>) : empty("No hay partidos eliminatorios resueltos.")}</div></div></TabsContent>
  </Tabs>
}
