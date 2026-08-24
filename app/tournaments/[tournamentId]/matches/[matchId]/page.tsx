import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, CalendarDays, MapPin, MessageSquareText } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MatchReportPDF } from "@/components/match-report-pdf"
import { TeamLogo } from "@/components/team-logo"

interface PlayerStat { id: string; name: string; cap_number: number; goals: number; exclusions: number }

export default async function MatchDetailPage({ params }: { params: Promise<{ tournamentId: string; matchId: string }> }) {
  const { tournamentId, matchId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { data: match } = await supabase.from("matches").select(`*, team_a:teams!matches_team_a_id_fkey(name, logo_url), team_b:teams!matches_team_b_id_fkey(name, logo_url)`).eq("id", matchId).eq("tournament_id", tournamentId).single()
  if (!match) redirect(`/tournaments/${tournamentId}/matches`)
  const [{ data: events }, { data: teamAPlayers }, { data: teamBPlayers }] = await Promise.all([
    supabase.from("match_events").select("event_type, player:players(id, team_id)").eq("match_id", matchId),
    supabase.from("players").select("id, name, cap_number").eq("team_id", match.team_a_id).order("cap_number"),
    supabase.from("players").select("id, name, cap_number").eq("team_id", match.team_b_id).order("cap_number"),
  ])
  const withStats = (players: typeof teamAPlayers): PlayerStat[] => (players || []).map((player) => ({ ...player, goals: (events || []).filter((event) => (event.player as unknown as { id: string } | null)?.id === player.id && event.event_type === "goal").length, exclusions: (events || []).filter((event) => (event.player as unknown as { id: string } | null)?.id === player.id && event.event_type === "exclusion").length }))
  const teamA = match.team_a as unknown as { name: string; logo_url: string | null }
  const teamB = match.team_b as unknown as { name: string; logo_url: string | null }
  const teamAStats = withStats(teamAPlayers)
  const teamBStats = withStats(teamBPlayers)
  const roster = (name: string, logoUrl: string | null, players: PlayerStat[]) => <Card className="overflow-hidden"><CardHeader className="border-b bg-muted/15"><CardTitle className="flex items-center gap-3"><TeamLogo name={name} logoUrl={logoUrl} className="h-10 w-10 bg-background" /><span className="truncate">{name}</span></CardTitle></CardHeader><CardContent className="px-0"><div className="overflow-x-auto"><table className="w-full min-w-[460px]"><thead><tr className="border-b bg-muted/10 text-xs uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3 text-left">Gorro</th><th className="px-3 py-3 text-left">Jugador</th><th className="px-3 py-3 text-center">Goles</th><th className="px-3 py-3 text-center">Exclusiones</th></tr></thead><tbody>{players.map((player) => <tr key={player.id} className="border-b last:border-0 hover:bg-muted/25"><td className="px-4 py-3"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{player.cap_number}</span></td><td className="px-3 py-3 font-medium">{player.name}</td><td className="px-3 py-3 text-center font-bold tabular-nums">{player.goals}</td><td className="px-3 py-3 text-center"><span className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-bold tabular-nums ${player.exclusions >= 3 ? "bg-destructive/10 text-destructive" : player.exclusions === 2 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>{player.exclusions}</span></td></tr>)}</tbody></table></div></CardContent></Card>
  return <main className="container mx-auto max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><Button asChild variant="ghost" size="icon"><Link href={`/tournaments/${tournamentId}/matches`} aria-label="Volver a partidos"><ArrowLeft className="h-5 w-5" /></Link></Button><div><h1 className="text-2xl font-semibold sm:text-3xl">Acta del partido</h1><p className="text-sm text-muted-foreground">Resultado, observaciones y estadísticas individuales.</p></div></div><MatchReportPDF match={match} teamAPlayers={teamAStats} teamBPlayers={teamBStats} className="h-10 gap-2" /></header>
    <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/15 px-5 py-3 text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" />{new Date(match.match_date).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}</span>{match.location && <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" />{match.location}</span>}</div><CardContent className="p-5 sm:p-8"><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-8"><div className="flex min-w-0 flex-col items-center gap-3 text-center sm:flex-row sm:justify-end sm:text-right"><TeamLogo name={teamA.name} logoUrl={teamA.logo_url} className="h-14 w-14 sm:h-16 sm:w-16" /><h2 className="line-clamp-2 text-base font-semibold sm:text-xl">{teamA.name}</h2></div><div className="rounded-xl border bg-muted/20 px-4 py-4 text-center shadow-sm sm:px-8"><div className="whitespace-nowrap text-4xl font-bold tabular-nums sm:text-5xl">{match.team_a_score ?? 0}<span className="mx-2 font-medium text-muted-foreground">–</span>{match.team_b_score ?? 0}</div><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Final</p></div><div className="flex min-w-0 flex-col items-center gap-3 text-center sm:flex-row sm:text-left"><TeamLogo name={teamB.name} logoUrl={teamB.logo_url} className="h-14 w-14 sm:h-16 sm:w-16" /><h2 className="line-clamp-2 text-base font-semibold sm:text-xl">{teamB.name}</h2></div></div>{match.comments && <div className="mt-7 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Comentarios del acta</p><p className="mt-2 whitespace-pre-wrap leading-7">{match.comments}</p></div></div>}</CardContent></Card>
    <section className="grid gap-5 lg:grid-cols-2">{roster(teamA.name, teamA.logo_url, teamAStats)}{roster(teamB.name, teamB.logo_url, teamBStats)}</section>
  </main>
}
