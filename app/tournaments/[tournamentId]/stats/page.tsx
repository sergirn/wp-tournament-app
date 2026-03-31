import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Target, AlertCircle } from "lucide-react"

export default async function StatsPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: tournamentMatches } = await supabase.from("matches").select("id").eq("tournament_id", tournamentId)

  const matchIds = tournamentMatches?.map((m) => m.id) || []

  // Máximos goleadores
  const { data: topScorers } = await supabase
    .from("match_events")
    .select(`
      player_id,
      players!inner(name, cap_number, team_id, teams!inner(name))
    `)
    .eq("event_type", "goal")
    .in("match_id", matchIds)

  // Agrupar goleadores por jugador
  const scorerStats = topScorers?.reduce((acc: any[], event: any) => {
    const playerId = event.player_id
    const existing = acc.find((s) => s.player_id === playerId)

    if (existing) {
      existing.goals += 1
    } else {
      acc.push({
        player_id: playerId,
        name: event.players.name,
        cap_number: event.players.cap_number,
        team_name: event.players.teams.name,
        goals: 1,
      })
    }
    return acc
  }, [])

  const sortedScorers = scorerStats?.sort((a, b) => b.goals - a.goals).slice(0, 10) || []

  // Jugadores con más exclusiones
  const { data: topExclusions } = await supabase
    .from("match_events")
    .select(`
      player_id,
      players!inner(name, cap_number, team_id, teams!inner(name))
    `)
    .eq("event_type", "exclusion")
    .in("match_id", matchIds)

  const exclusionStats = topExclusions?.reduce((acc: any[], event: any) => {
    const playerId = event.player_id
    const existing = acc.find((s) => s.player_id === playerId)

    if (existing) {
      existing.exclusions += 1
    } else {
      acc.push({
        player_id: playerId,
        name: event.players.name,
        cap_number: event.players.cap_number,
        team_name: event.players.teams.name,
        exclusions: 1,
      })
    }
    return acc
  }, [])

  const sortedExclusions = exclusionStats?.sort((a, b) => b.exclusions - a.exclusions).slice(0, 5) || []

  // Estadísticas generales del torneo
  const { data: matches } = await supabase
    .from("matches")
    .select("team_a_score, team_b_score, status")
    .eq("tournament_id", tournamentId)

  const totalMatches = matches?.length || 0
  const completedMatches = matches?.filter((m) => m.status === "completed").length || 0
  const totalGoals = matches?.reduce((sum, m) => sum + (m.team_a_score || 0) + (m.team_b_score || 0), 0) || 0
  const avgGoalsPerMatch = completedMatches > 0 ? (totalGoals / completedMatches).toFixed(1) : "0"

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold gradient-text mb-2">Estadísticas</h1>
        <p className="text-muted-foreground">Análisis y métricas del torneo</p>
      </div>

      <div className="grid gap-6 md:grid-cols-4 mb-8">
        <Card className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Partidos Totales</p>
              <p className="text-3xl font-bold gradient-text">{totalMatches}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Partidos Completados</p>
              <p className="text-3xl font-bold text-cyan-400">{completedMatches}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Goles Totales</p>
              <p className="text-3xl font-bold text-orange-400">{totalGoals}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Promedio Goles</p>
              <p className="text-3xl font-bold text-violet-400">{avgGoalsPerMatch}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Máximos Goleadores */}
        <Card className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-cyan-400" />
              Máximos Goleadores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedScorers.length > 0 ? (
              <div className="space-y-3">
                {sortedScorers.map((scorer, index) => (
                  <div
                    key={scorer.player_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0
                            ? "bg-gradient-sport text-white"
                            : index === 1
                              ? "bg-cyan-500/20 text-cyan-400"
                              : index === 2
                                ? "bg-orange-500/20 text-orange-400"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">
                          #{scorer.cap_number} {scorer.name}
                        </p>
                        <p className="text-sm text-muted-foreground">{scorer.team_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-cyan-400">{scorer.goals}</p>
                      <p className="text-xs text-muted-foreground">goles</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">No hay goles registrados aún</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Jugadores con Más Exclusiones */}
        <Card className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-400" />
              Más Exclusiones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedExclusions.length > 0 ? (
              <div className="space-y-3">
                {sortedExclusions.map((player, index) => (
                  <div
                    key={player.player_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-muted text-muted-foreground">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">
                          #{player.cap_number} {player.name}
                        </p>
                        <p className="text-sm text-muted-foreground">{player.team_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-orange-400">{player.exclusions}</p>
                      <p className="text-xs text-muted-foreground">exclusiones</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">No hay exclusiones registradas</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
