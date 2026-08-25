"use client"

import Link from "next/link"
import Image from "next/image"
import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, CircleDot, LogIn, MapPin, Radio, ShieldCheck, Trophy, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { rankGroup } from "@/lib/standings"
import { TeamLogo } from "@/components/team-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Tournament { id: string; name: string; status: string; points_win: number; points_draw: number; points_loss: number }
interface Team { id: string; name: string; logo_url: string | null }
interface Group { id: string; name: string; order_number: number; phase_id: string | null; group_members: { team_id: string }[] }
interface Phase { id: string; name: string; phase_order: number; phase_type: string }
interface Match {
  id: string; tournament_id: string; group_id: string | null; phase_id: string | null; team_a_id: string | null; team_b_id: string | null
  team_a_score: number | null; team_b_score: number | null; match_date: string; location: string | null; status: string; updated_at: string
  team_a: Team | null; team_b: Team | null
}

const PublicMatchSelectionContext = createContext<(matchId: string) => void>(() => {})

export function PublicTournamentLive({ tournament, teams, groups, phases, matches }: { tournament: Tournament | null; teams: Team[]; groups: Group[]; phases: Phase[]; matches: Match[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [lastUpdate, setLastUpdate] = useState(() => new Date())
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])
  const selectedMatch = selectedMatchId ? matches.find((match) => match.id === selectedMatchId) || null : null

  useEffect(() => {
    if (!tournament) return
    const supabase = createClient()
    const refresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => {
        setLastUpdate(new Date())
        startTransition(() => router.refresh())
      }, 250)
    }
    const channel = supabase.channel(`public-tournament-${tournament.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tournament.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events" }, refresh)
      .subscribe()
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      void supabase.removeChannel(channel)
    }
  }, [router, tournament])

  if (!tournament) return <EmptyPublicHome />

  const liveMatches = matches.filter((match) => match.status === "in_progress")
  const finishedMatches = matches.filter((match) => match.status === "finished").slice(0, 24)
  const groupPhases = phases.filter((phase) => phase.phase_type === "group")
  const knockoutPhases = phases.filter((phase) => phase.phase_type !== "group")
  const primaryGroupPhase = groupPhases[0] || null
  const secondaryGroupPhases = groupPhases.slice(1)
  const topLevelTabCount = 4 + secondaryGroupPhases.length

  return <PublicMatchSelectionContext.Provider value={setSelectedMatchId}><main className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/.12),transparent_34%),radial-gradient(circle_at_top_right,hsl(var(--accent)/.10),transparent_30%)]">
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6"><div className="flex min-w-0 items-center gap-3"><Image src="/images/bwmf-logo.png" alt="Waterpolo Pro" width={46} height={40} className="h-10 w-auto object-contain dark:brightness-0 dark:invert" priority /><div className="min-w-0"><p className="truncate text-sm font-bold sm:text-base">{tournament.name}</p><p className="text-[11px] uppercase tracking-[.18em] text-muted-foreground">Centro oficial de resultados</p></div></div><div className="flex items-center gap-2"><ThemeToggle /><Button asChild variant="outline" size="sm"><Link href="/dashboard"><LogIn className="h-4 w-4" /><span className="hidden sm:inline">Acceder</span></Link></Button></div></div></header>

    <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary via-primary/90 to-accent text-primary-foreground"><div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)", backgroundSize: "32px 32px" }} /><div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:py-14"><div className="min-w-0"><Badge variant="secondary" className="mb-4"><CircleDot className="mr-1.5 h-3.5 w-3.5" />Torneo activo</Badge><h1 className="max-w-4xl break-words text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">{tournament.name}</h1><p className="mt-4 max-w-2xl text-base text-primary-foreground/75 sm:text-lg">Partidos, clasificaciones y eliminatorias actualizados durante todo el torneo.</p></div><div className="grid w-full grid-cols-3 gap-2 sm:gap-3 lg:w-auto"><HeroStat icon={Users} value={teams.length} label="Equipos" /><HeroStat icon={Radio} value={liveMatches.length} label="En directo" /><HeroStat icon={Trophy} value={finishedMatches.length} label="Finalizados" /></div></div></section>

    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:py-12">
      <section aria-labelledby="live-title"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-2"><span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"/><span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"/></span><h2 id="live-title" className="text-2xl font-black">Ahora en juego</h2></div><p className="mt-1 text-sm text-muted-foreground">Los marcadores cambian automáticamente al actualizarse el acta.</p></div><span className="text-xs text-muted-foreground">{isPending ? "Actualizando…" : `Actualizado ${lastUpdate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}</span></div>
        {liveMatches.length ? <div className="grid gap-4 lg:grid-cols-2">{liveMatches.map((match) => <MatchCard key={match.id} match={match} live />)}</div> : <Card className="border-dashed"><CardContent className="flex flex-col items-center py-10 text-center"><Radio className="mb-3 h-9 w-9 text-muted-foreground"/><p className="font-semibold">No hay partidos en juego ahora mismo</p><p className="mt-1 text-sm text-muted-foreground">El próximo partido aparecerá aquí cuando cambie a “En juego”.</p></CardContent></Card>}
      </section>

      <Tabs defaultValue="groups-primary" className="gap-5"><TabsList className="grid h-auto w-full bg-muted/70 p-1" style={{ gridTemplateColumns: `repeat(${topLevelTabCount}, minmax(0, 1fr))` }}><TabsTrigger value="groups-primary" className="h-full min-w-0 whitespace-normal px-1.5 py-2 text-center text-xs sm:px-3 sm:text-sm">Fase de grupos 1</TabsTrigger>{secondaryGroupPhases.map((phase, index) => <TabsTrigger key={phase.id} value={`groups-${phase.id}`} className="h-full min-w-0 whitespace-normal px-1.5 py-2 text-center text-xs sm:px-3 sm:text-sm">Fase de grupos {index + 2}</TabsTrigger>)}<TabsTrigger value="fixtures" className="h-full min-w-0 whitespace-normal px-1.5 py-2 text-center text-xs sm:px-3 sm:text-sm">Partidos de grupos</TabsTrigger><TabsTrigger value="knockout" className="h-full min-w-0 whitespace-normal px-1.5 py-2 text-center text-xs sm:px-3 sm:text-sm">Eliminatorias</TabsTrigger><TabsTrigger value="results" className="h-full min-w-0 whitespace-normal px-1.5 py-2 text-center text-xs sm:px-3 sm:text-sm">Resultados</TabsTrigger></TabsList>
        <TabsContent value="groups-primary" className="space-y-6"><PhaseGroupStandings groups={primaryGroupPhase ? groups.filter((group) => group.phase_id === primaryGroupPhase.id) : groups} phaseName={primaryGroupPhase?.name || "Fase de grupos 1"} matches={matches} teamMap={teamMap} tournament={tournament} /></TabsContent>
        {secondaryGroupPhases.map((phase) => <TabsContent key={phase.id} value={`groups-${phase.id}`}><PhaseGroupStandings groups={groups.filter((group) => group.phase_id === phase.id)} phaseName={phase.name} matches={matches} teamMap={teamMap} tournament={tournament} /></TabsContent>)}
        <TabsContent value="fixtures"><GroupFixtures groups={groups} phases={groupPhases} matches={matches} teamMap={teamMap} /></TabsContent>
        <TabsContent value="knockout"><KnockoutView phases={knockoutPhases} matches={matches} /></TabsContent>
        <TabsContent value="results">{finishedMatches.length ? <div className="grid gap-3 md:grid-cols-2">{finishedMatches.map((match) => <MatchCard key={match.id} match={match} />)}</div> : <EmptyBlock icon={Trophy} text="Todavía no hay resultados definitivos." />}</TabsContent>
      </Tabs>
    </div>
    <footer className="border-t py-7 text-center text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline h-4 w-4" />Vista pública de solo lectura · Waterpolo Pro</footer>
    <PublicMatchReportDialog match={selectedMatch} open={Boolean(selectedMatchId)} onOpenChange={(open) => { if (!open) setSelectedMatchId(null) }} />
  </main></PublicMatchSelectionContext.Provider>
}

function HeroStat({ icon: Icon, value, label }: { icon: typeof Trophy; value: number; label: string }) { return <div className="min-w-0 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-2 text-center backdrop-blur sm:min-w-20 sm:p-3"><Icon className="mx-auto mb-1 h-4 w-4 text-primary-foreground/70"/><p className="text-xl font-black sm:text-2xl">{value}</p><p className="truncate text-[9px] uppercase tracking-wider text-primary-foreground/65 sm:text-[10px]">{label}</p></div> }

function MatchCard({ match, live = false }: { match: Match; live?: boolean }) { const date = new Date(match.match_date); const selectMatch = useContext(PublicMatchSelectionContext); return <Card role="button" tabIndex={0} aria-label={`Ver acta de ${match.team_a?.name || "equipo"} contra ${match.team_b?.name || "equipo"}`} onClick={() => selectMatch(match.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectMatch(match.id) } }} className={`min-w-0 cursor-pointer transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${live ? "overflow-hidden border-red-500/35 shadow-lg shadow-red-500/5" : "overflow-hidden"}`}><div className={`flex flex-wrap items-center justify-between gap-1 border-b px-3 py-2 text-[11px] sm:px-4 sm:text-xs ${live ? "bg-red-500/8 text-red-600 dark:text-red-400" : "bg-muted/25 text-muted-foreground"}`}><span className="font-bold uppercase tracking-wider">{live ? "● En directo" : match.status === "finished" ? "Finalizado" : "Programado"}</span><span>{date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} · {date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span></div><CardContent className="p-3 sm:p-5"><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-3"><TeamSide team={match.team_a} align="right"/><div className={`whitespace-nowrap rounded-xl px-2.5 py-3 text-2xl font-black tabular-nums sm:px-4 sm:text-3xl ${live ? "bg-red-500/10" : "bg-muted/50"}`}>{match.team_a_score ?? 0}<span className="mx-1 text-muted-foreground sm:mx-2">–</span>{match.team_b_score ?? 0}</div><TeamSide team={match.team_b} align="left"/></div>{match.location && <p className="mt-4 flex items-center justify-center gap-1.5 border-t pt-3 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5"/>{match.location}</p>}<p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-wider text-primary">Ver acta</p></CardContent></Card> }
function TeamSide({ team, align }: { team: Team | null; align: "left" | "right" }) { return <div className={`flex min-w-0 flex-col items-center gap-1 text-center sm:gap-2 ${align === "right" ? "sm:flex-row-reverse sm:text-right" : "sm:flex-row sm:text-left"}`}><TeamLogo name={team?.name} logoUrl={team?.logo_url} className="h-8 w-8 shrink-0 sm:h-12 sm:w-12"/><span className="line-clamp-2 min-w-0 break-words text-[11px] font-bold leading-tight sm:text-base">{team?.name || "Por determinar"}</span></div> }

function PhaseGroupStandings({ groups, phaseName, matches, teamMap, tournament }: { groups: Group[]; phaseName: string; matches: Match[]; teamMap: Map<string, Team>; tournament: Tournament }) {
  if (!groups.length) return <EmptyBlock icon={Users} text="Todavía no se han configurado grupos." />
  return <section><div className="mb-4"><h3 className="text-xl font-black">{phaseName}</h3><p className="text-sm text-muted-foreground">Selecciona un grupo para consultar su clasificación.</p></div><Tabs defaultValue={groups[0].id} className="gap-5"><FullWidthGroupTabs groups={groups} />{groups.map((group) => <TabsContent key={group.id} value={group.id}><GroupStandingsCard group={group} matches={matches} teamMap={teamMap} tournament={tournament} /></TabsContent>)}</Tabs></section>
}

function FullWidthGroupTabs({ groups }: { groups: Group[] }) { return <TabsList className="grid h-auto w-full p-1" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>{groups.map((group) => <TabsTrigger key={group.id} value={group.id} className="min-w-0 whitespace-normal px-2 py-2 text-center">{group.name}</TabsTrigger>)}</TabsList> }

function GroupStandingsCard({ group, matches, teamMap, tournament }: { group: Group; matches: Match[]; teamMap: Map<string, Team>; tournament: Tournament }) { const ranking = rankGroup(group.group_members.map((member) => member.team_id), matches, group.id, { win: tournament.points_win, draw: tournament.points_draw, loss: tournament.points_loss }); return <Card className="min-w-0 overflow-hidden"><CardHeader><CardTitle>{group.name}</CardTitle></CardHeader><CardContent className="overflow-x-auto px-0"><table className="w-full min-w-[520px] text-sm"><thead><tr className="border-y bg-muted/25 text-xs text-muted-foreground"><th className="px-4 py-2 text-left">#</th><th className="px-2 py-2 text-left">Equipo</th>{["PJ","G","E","P","DIF","PTS"].map((value) => <th key={value} className="px-2 py-2 text-center">{value}</th>)}</tr></thead><tbody>{ranking.map((row, index) => { const team = teamMap.get(row.teamId); return <tr key={row.teamId} className="border-b last:border-0"><td className="px-4 py-3 font-bold">{index + 1}</td><td className="px-2 py-3"><div className="flex items-center gap-2"><TeamLogo name={team?.name} logoUrl={team?.logo_url} className="h-7 w-7 shrink-0"/><span className="font-semibold">{team?.name || "Equipo"}</span></div></td>{[row.played,row.wins,row.draws,row.losses,row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference,row.points].map((value, valueIndex) => <td key={valueIndex} className={`px-2 py-3 text-center tabular-nums ${valueIndex === 5 ? "font-black text-primary" : ""}`}>{value}</td>)}</tr>})}</tbody></table></CardContent></Card> }

function GroupFixtures({ groups, phases, matches, teamMap }: { groups: Group[]; phases: Phase[]; matches: Match[]; teamMap: Map<string, Team> }) {
  if (!groups.length) return <EmptyBlock icon={CalendarDays} text="Todavía no se han configurado grupos." />
  const availablePhases = phases.filter((phase) => groups.some((group) => group.phase_id === phase.id))
  const orphanGroups = groups.filter((group) => !group.phase_id)
  const fixturePhases = availablePhases.length ? availablePhases : [{ id: "all", name: "Fase de grupos", phase_order: 1, phase_type: "group" }]
  const phaseContent = (phase: Phase) => {
    const phaseGroups = (phase.id === "all" ? groups : groups.filter((group) => group.phase_id === phase.id)).sort((a, b) => a.order_number - b.order_number)
    if (!phaseGroups.length) return <EmptyBlock icon={CalendarDays} text="Esta fase todavía no tiene grupos." />
    return <Tabs defaultValue={phaseGroups[0].id} className="gap-5"><FullWidthGroupTabs groups={phaseGroups} />{phaseGroups.map((group) => <TabsContent key={group.id} value={group.id}><GroupFixtureList group={group} matches={matches} teamMap={teamMap} /></TabsContent>)}</Tabs>
  }
  return <section><div className="mb-4"><h3 className="text-xl font-black">Partidos de grupos</h3><p className="text-sm text-muted-foreground">Selecciona primero la fase y después el grupo que quieres consultar.</p></div>{fixturePhases.length > 1 ? <Tabs defaultValue={fixturePhases[0].id} className="gap-5"><TabsList className="grid h-auto w-full p-1" style={{ gridTemplateColumns: `repeat(${fixturePhases.length}, minmax(0, 1fr))` }}>{fixturePhases.map((phase, index) => <TabsTrigger key={phase.id} value={phase.id} className="min-w-0 whitespace-normal px-2 py-2 text-center">Fase {index + 1}</TabsTrigger>)}</TabsList>{fixturePhases.map((phase) => <TabsContent key={phase.id} value={phase.id} className="rounded-xl border bg-muted/10 p-3 sm:p-4">{phaseContent(phase)}</TabsContent>)}</Tabs> : phaseContent(fixturePhases[0])}{orphanGroups.length > 0 && availablePhases.length > 0 && <p className="mt-4 text-xs text-amber-600">Hay {orphanGroups.length} grupo(s) sin fase asignada que no se muestran en este selector.</p>}</section>
}

function GroupFixtureList({ group, matches, teamMap }: { group: Group; matches: Match[]; teamMap: Map<string, Team> }) {
  const teamIds = group.group_members.map((member) => member.team_id)
  const fixtures = teamIds.flatMap((teamAId, index) => teamIds.slice(index + 1).map((teamBId) => {
    const match = matches.find((candidate) => candidate.group_id === group.id && ((candidate.team_a_id === teamAId && candidate.team_b_id === teamBId) || (candidate.team_a_id === teamBId && candidate.team_b_id === teamAId)))
    return { teamA: teamMap.get(teamAId) || null, teamB: teamMap.get(teamBId) || null, match }
  }))
  return <section><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-xl font-black">{group.name}</h3><span className="text-xs text-muted-foreground">{fixtures.filter((fixture) => fixture.match?.status === "finished").length} de {fixtures.length} resueltos</span></div>{fixtures.length ? <div className="grid min-w-0 gap-3 md:grid-cols-2">{fixtures.map((fixture, index) => fixture.match ? <MatchCard key={fixture.match.id} match={fixture.match} live={fixture.match.status === "in_progress"} /> : <PendingFixtureCard key={`${fixture.teamA?.id}-${fixture.teamB?.id}-${index}`} teamA={fixture.teamA} teamB={fixture.teamB} />)}</div> : <EmptyBlock icon={Users} text="Este grupo necesita al menos dos equipos." />}</section>
}

function PendingFixtureCard({ teamA, teamB }: { teamA: Team | null; teamB: Team | null }) {
  return <Card className="min-w-0 overflow-hidden"><div className="flex items-center justify-between border-b bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground sm:px-4 sm:text-xs"><span className="font-bold uppercase tracking-wider">Pendiente</span><span>Por disputar</span></div><CardContent className="p-3 sm:p-5"><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-3"><TeamSide team={teamA} align="right"/><div className="rounded-xl bg-muted/40 px-3 py-3 text-lg font-black text-muted-foreground sm:px-5 sm:text-xl">VS</div><TeamSide team={teamB} align="left"/></div></CardContent></Card>
}

interface PublicPlayerStat { id: string; name: string; cap_number: number; team_id: string; goals: number; exclusions: number }

function PublicMatchReportDialog({ match, open, onOpenChange }: { match: Match | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [players, setPlayers] = useState<PublicPlayerStat[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open || !match?.team_a_id || !match.team_b_id) return
    let cancelled = false
    const loadReport = async () => {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      const [{ data: playerRows, error: playersError }, { data: events, error: eventsError }] = await Promise.all([
        supabase.from("players").select("id, name, cap_number, team_id").in("team_id", [match.team_a_id!, match.team_b_id!]).order("cap_number"),
        supabase.from("match_events").select("player_id, event_type").eq("match_id", match.id),
      ])
      if (cancelled) return
      if (playersError || eventsError) {
        setPlayers([])
        setError(playersError?.message || eventsError?.message || "No se pudo cargar el acta")
      } else {
        setPlayers((playerRows || []).map((player) => ({ ...player, goals: (events || []).filter((event) => event.player_id === player.id && event.event_type === "goal").length, exclusions: (events || []).filter((event) => event.player_id === player.id && event.event_type === "exclusion").length })))
      }
      setLoading(false)
    }
    void loadReport()
    return () => { cancelled = true }
  }, [open, match?.id, match?.updated_at, match?.team_a_id, match?.team_b_id])

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="flex !h-auto max-h-[96dvh] !w-[96vw] !max-w-[90rem] flex-col overflow-hidden p-0 sm:!w-[94vw] lg:max-h-[92dvh]"><DialogHeader className="shrink-0 border-b px-4 py-4 pr-12 sm:px-6"><DialogTitle>Acta del partido</DialogTitle><DialogDescription>{match?.status === "in_progress" ? "Información actualizada en directo" : "Detalle público de goles y exclusiones"}</DialogDescription></DialogHeader>{match && <div className="min-h-0 flex-1 overflow-y-auto"><div className={`border-b px-4 py-5 sm:px-6 ${match.status === "in_progress" ? "bg-red-500/5" : "bg-muted/15"}`}><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6"><TeamSide team={match.team_a} align="right"/><div className="whitespace-nowrap rounded-xl border bg-background px-3 py-3 text-3xl font-black tabular-nums shadow-sm sm:px-7 sm:text-5xl">{match.team_a_score ?? 0}<span className="mx-1.5 text-muted-foreground sm:mx-3">–</span>{match.team_b_score ?? 0}</div><TeamSide team={match.team_b} align="left"/></div>{match.status === "in_progress" && <p className="mt-3 text-center text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">● En directo</p>}</div>{loading ? <div className="py-16 text-center text-sm text-muted-foreground">Cargando acta…</div> : error ? <div className="px-5 py-16 text-center text-sm text-destructive">{error}</div> : <div className="grid gap-4 p-3 sm:p-5 md:grid-cols-2"><PublicRoster team={match.team_a} players={players.filter((player) => player.team_id === match.team_a_id)} /><PublicRoster team={match.team_b} players={players.filter((player) => player.team_id === match.team_b_id)} /></div>}</div>}</DialogContent></Dialog>
}

function PublicRoster({ team, players }: { team: Team | null; players: PublicPlayerStat[] }) {
  return <Card className="min-w-0 overflow-hidden"><CardHeader className="border-b bg-muted/15 px-4 py-3"><CardTitle className="flex items-center gap-2 text-base"><TeamLogo name={team?.name} logoUrl={team?.logo_url} className="h-8 w-8"/><span className="truncate">{team?.name || "Equipo"}</span></CardTitle></CardHeader><CardContent className="overflow-x-auto px-0"><table className="w-full min-w-[360px] text-sm"><thead><tr className="border-b text-xs uppercase tracking-wider text-muted-foreground"><th className="px-3 py-2 text-center">Gorro</th><th className="px-3 py-2 text-left">Jugador</th><th className="px-3 py-2 text-center">Goles</th><th className="px-3 py-2 text-center">Excl.</th></tr></thead><tbody>{players.length ? players.map((player) => <tr key={player.id} className="border-b last:border-0"><td className="px-3 py-2.5 text-center font-bold">{player.cap_number}</td><td className="px-3 py-2.5 font-medium">{player.name}</td><td className="px-3 py-2.5 text-center font-bold tabular-nums">{player.goals}</td><td className="px-3 py-2.5 text-center font-bold tabular-nums">{player.exclusions}</td></tr>) : <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No hay jugadores disponibles.</td></tr>}</tbody></table></CardContent></Card>
}

function KnockoutView({ phases, matches }: { phases: Phase[]; matches: Match[] }) { const knockoutMatches = matches.filter((match) => match.phase_id && phases.some((phase) => phase.id === match.phase_id)); if (!knockoutMatches.length) return <EmptyBlock icon={Trophy} text="El cuadro eliminatorio todavía no tiene partidos." />; return <div className="flex gap-5 overflow-x-auto pb-4">{phases.map((phase) => { const roundMatches = knockoutMatches.filter((match) => match.phase_id === phase.id); if (!roundMatches.length) return null; return <div key={phase.id} className="w-[330px] shrink-0"><h3 className="mb-3 text-center text-sm font-black uppercase tracking-wider text-muted-foreground">{phase.name}</h3><div className="space-y-3">{roundMatches.map((match) => <MatchCard key={match.id} match={match} live={match.status === "in_progress"}/>)}</div></div>})}</div> }
function EmptyBlock({ icon: Icon, text }: { icon: typeof Trophy; text: string }) { return <Card className="border-dashed"><CardContent className="flex items-center justify-center gap-3 py-12 text-muted-foreground"><Icon className="h-5 w-5"/><p>{text}</p></CardContent></Card> }
function EmptyPublicHome() { return <main className="flex min-h-screen items-center justify-center bg-muted/20 px-4"><Card className="w-full max-w-xl text-center"><CardContent className="py-14"><Image src="/images/bwmf-logo.png" alt="Waterpolo Pro" width={90} height={80} className="mx-auto mb-6 h-20 w-auto object-contain dark:brightness-0 dark:invert"/><h1 className="text-3xl font-black">No hay un torneo activo</h1><p className="mx-auto mt-3 max-w-md text-muted-foreground">Cuando la organización active un torneo, aquí aparecerán sus partidos, clasificaciones y resultados en directo.</p><Button asChild className="mt-7"><Link href="/dashboard"><LogIn className="h-4 w-4"/>Acceder a gestión</Link></Button></CardContent></Card></main> }
