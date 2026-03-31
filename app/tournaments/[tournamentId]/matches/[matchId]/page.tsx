import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MatchReportPDF } from "@/components/match-report-pdf"

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ tournamentId: string; matchId: string }>
}) {
  const { tournamentId, matchId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: match } = await supabase
    .from("matches")
    .select(
      `
      *,
      team_a:teams!matches_team_a_id_fkey(name, logo_url),
      team_b:teams!matches_team_b_id_fkey(name, logo_url)
    `,
    )
    .eq("id", matchId)
    .single()

  if (!match) {
    redirect(`/tournaments/${tournamentId}/matches`)
  }

  const { data: events } = await supabase
    .from("match_events")
    .select(
      `
      *,
      player:players(id, name, cap_number, team_id)
    `,
    )
    .eq("match_id", matchId)

  const { data: teamAPlayers } = await supabase
    .from("players")
    .select("*")
    .eq("team_id", match.team_a_id)
    .order("cap_number")

  const { data: teamBPlayers } = await supabase
    .from("players")
    .select("*")
    .eq("team_id", match.team_b_id)
    .order("cap_number")

  const getPlayerStats = (playerId: string) => {
    const playerEvents = events?.filter((e) => e.player?.id === playerId) || []
    return {
      goals: playerEvents.filter((e) => e.event_type === "goal").length,
      exclusions: playerEvents.filter((e) => e.event_type === "exclusion").length,
    }
  }

  const teamAPlayersWithStats = (teamAPlayers || []).map((p) => ({
    ...p,
    ...getPlayerStats(p.id),
  }))

  const teamBPlayersWithStats = (teamBPlayers || []).map((p) => ({
    ...p,
    ...getPlayerStats(p.id),
  }))

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/tournaments/${tournamentId}/matches`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-bold gradient-text mb-2">Acta del Partido</h1>
            <p className="text-muted-foreground">Resumen completo y estadísticas</p>
          </div>
        </div>
        <MatchReportPDF match={match} teamAPlayers={teamAPlayersWithStats} teamBPlayers={teamBPlayersWithStats} />
      </div>

      {/* INFORMACIÓN DEL PARTIDO */}
      <Card className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-cyan-400" />
              <span className="text-sm text-muted-foreground">
                {new Date(match.match_date).toLocaleDateString("es-ES", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {match.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {match.location}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* MARCADOR */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex-1 flex items-center justify-end gap-4">
              {match.team_a?.logo_url && (
                <img
                  src={match.team_a.logo_url || "/placeholder.svg"}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover"
                />
              )}
              <p className="font-bold text-2xl">{match.team_a?.name}</p>
            </div>
            <div className="px-12 py-6 bg-card/60 backdrop-blur-lg border border-primary/20 rounded-lg mx-8">
              <div className="flex items-center gap-6">
                <span className="text-5xl font-bold sport-gradient-text">{match.team_a_score || 0}</span>
                <span className="text-4xl font-bold text-muted-foreground">-</span>
                <span className="text-5xl font-bold sport-gradient-text">{match.team_b_score || 0}</span>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-4">
              <p className="font-bold text-2xl">{match.team_b?.name}</p>
              {match.team_b?.logo_url && (
                <img
                  src={match.team_b.logo_url || "/placeholder.svg"}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover"
                />
              )}
            </div>
          </div>

          {/* COMENTARIOS */}
          {match.comments && (
            <div className="p-4 bg-card/60 backdrop-blur-lg border border-primary/20 rounded-lg">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Comentarios</h3>
              <p className="text-foreground">{match.comments}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ESTADÍSTICAS DE JUGADORES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EQUIPO A */}
        <Card className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl">
          <CardHeader>
            <h2 className="text-2xl font-bold gradient-text flex items-center gap-3">
              {match.team_a?.logo_url && (
                <img
                  src={match.team_a.logo_url || "/placeholder.svg"}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              )}
              {match.team_a?.name}
            </h2>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-primary/20">
                    <th className="text-left p-2 text-sm font-semibold text-muted-foreground">Gorro</th>
                    <th className="text-left p-2 text-sm font-semibold text-muted-foreground">Jugador</th>
                    <th className="text-center p-2 text-sm font-semibold text-muted-foreground">Goles</th>
                    <th className="text-center p-2 text-sm font-semibold text-muted-foreground">Exclusiones</th>
                  </tr>
                </thead>
                <tbody>
                  {teamAPlayersWithStats.map((player) => (
                    <tr key={player.id} className="border-b border-primary/10 hover:bg-primary/5">
                      <td className="p-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold text-sm">
                          {player.cap_number}
                        </div>
                      </td>
                      <td className="p-2 font-medium">{player.name}</td>
                      <td className="p-2 text-center">
                        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-sm">
                          {player.goals}
                        </span>
                      </td>
                      <td className="p-2 text-center">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* EQUIPO B */}
        <Card className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl">
          <CardHeader>
            <h2 className="text-2xl font-bold gradient-text flex items-center gap-3">
              {match.team_b?.logo_url && (
                <img
                  src={match.team_b.logo_url || "/placeholder.svg"}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              )}
              {match.team_b?.name}
            </h2>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-primary/20">
                    <th className="text-left p-2 text-sm font-semibold text-muted-foreground">Gorro</th>
                    <th className="text-left p-2 text-sm font-semibold text-muted-foreground">Jugador</th>
                    <th className="text-center p-2 text-sm font-semibold text-muted-foreground">Goles</th>
                    <th className="text-center p-2 text-sm font-semibold text-muted-foreground">Exclusiones</th>
                  </tr>
                </thead>
                <tbody>
                  {teamBPlayersWithStats.map((player) => (
                    <tr key={player.id} className="border-b border-primary/10 hover:bg-primary/5">
                      <td className="p-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white font-bold text-sm">
                          {player.cap_number}
                        </div>
                      </td>
                      <td className="p-2 font-medium">{player.name}</td>
                      <td className="p-2 text-center">
                        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-sm">
                          {player.goals}
                        </span>
                      </td>
                      <td className="p-2 text-center">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
