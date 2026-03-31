import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Trophy, Users, Calendar, TrendingUp, Clock, Award, ChevronRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default async function TournamentHomePage({
  params,
}: {
  params: Promise<{ tournamentId: string }>
}) {
  const { tournamentId } = await params

  const supabase = await createClient()

  const [
    { data: tournament },
    { data: teams },
    { data: finishedMatches },
    { data: upcomingMatches },
    { data: recentMatches },
  ] = await Promise.all([
    supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
    supabase.from("tournament_teams").select("team:teams(*)").eq("tournament_id", tournamentId),
    supabase.from("matches").select("*").eq("tournament_id", tournamentId).eq("status", "finished"),
    supabase
      .from("matches")
      .select("*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)")
      .eq("tournament_id", tournamentId)
      .eq("status", "scheduled")
      .order("match_date", { ascending: true })
      .limit(3),
    supabase
      .from("matches")
      .select("*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)")
      .eq("tournament_id", tournamentId)
      .eq("status", "finished")
      .order("match_date", { ascending: false })
      .limit(3),
  ])

  const totalMatches = finishedMatches?.length || 0

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary via-primary/90 to-accent text-primary-foreground overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="container relative mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl">
            <Badge variant="secondary" className="mb-4 text-xs uppercase tracking-wider font-semibold">
              Torneo Activo
            </Badge>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 text-balance">
              {tournament?.name || "Torneo de Waterpolo"}
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 max-w-2xl mb-8 leading-relaxed">
              {tournament?.description || "Sigue todos los partidos, clasificaciones y estadísticas en tiempo real"}
            </p>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4 border border-primary-foreground/20">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 opacity-70" />
                  <span className="text-xs uppercase tracking-wider opacity-70 font-semibold">Equipos</span>
                </div>
                <div className="text-3xl font-black">{teams?.length || 0}</div>
              </div>

              <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4 border border-primary-foreground/20">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="h-4 w-4 opacity-70" />
                  <span className="text-xs uppercase tracking-wider opacity-70 font-semibold">Partidos</span>
                </div>
                <div className="text-3xl font-black">{totalMatches}</div>
              </div>

              <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4 border border-primary-foreground/20">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="h-4 w-4 opacity-70" />
                  <span className="text-xs uppercase tracking-wider opacity-70 font-semibold">Tipo</span>
                </div>
                <div className="text-2xl font-black">{tournament?.type === "league" ? "Liga" : "Grupos"}</div>
              </div>

              <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4 border border-primary-foreground/20">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 opacity-70" />
                  <span className="text-xs uppercase tracking-wider opacity-70 font-semibold">Estado</span>
                </div>
                <div className={`text-2xl font-black ${tournament?.status === 'finished' ? 'text-red-400' : ''}`}>
                  {tournament?.status === 'active' ? 'Activo' : tournament?.status === 'finished' ? 'Finalizado' : 'Borrador'}
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary" className="font-bold">
                <Link href={`/tournaments/${tournamentId}/matches`}>
                  Ver Partidos
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="font-bold bg-primary-foreground/10 hover:bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground"
              >
                <Link href={`/tournaments/${tournamentId}/standings`}>Clasificación</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 space-y-12">
        {/* Upcoming Matches */}
        {upcomingMatches && upcomingMatches.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-balance">Próximos Partidos</h2>
                <p className="text-muted-foreground mt-1">No te pierdas la acción</p>
              </div>
              <Button asChild variant="ghost" className="font-semibold">
                <Link href={`/tournaments/${tournamentId}/matches`}>
                  Ver todos
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {upcomingMatches.map((match: any) => (
                <Link key={match.id} href={`/tournaments/${tournamentId}/matches/${match.id}`}>
                  <Card className="group hover:border-primary transition-all hover:shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-br from-muted/50 to-muted p-4 border-b">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(match.match_date).toLocaleDateString("es-ES", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                        {match.match_time && ` · ${match.match_time}`}
                      </div>
                    </div>

                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {/* Home Team */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {match.home_team?.logo_url ? (
                              <div className="relative h-10 w-10 rounded-full overflow-hidden border-2 border-border">
                                <Image
                                  src={match.home_team.logo_url || "/placeholder.svg"}
                                  alt={match.home_team.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground font-bold text-sm">
                                {match.home_team?.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="font-bold text-sm">{match.home_team?.name}</span>
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-2xl font-black text-muted-foreground">VS</div>
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {match.away_team?.logo_url ? (
                              <div className="relative h-10 w-10 rounded-full overflow-hidden border-2 border-border">
                                <Image
                                  src={match.away_team.logo_url || "/placeholder.svg"}
                                  alt={match.away_team.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-accent-foreground font-bold text-sm">
                                {match.away_team?.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="font-bold text-sm">{match.away_team?.name}</span>
                          </div>
                        </div>
                      </div>

                      {match.location && (
                        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">📍 {match.location}</div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recent Results */}
        {recentMatches && recentMatches.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-balance">Resultados Recientes</h2>
                <p className="text-muted-foreground mt-1">Últimos partidos finalizados</p>
              </div>
              <Button asChild variant="ghost" className="font-semibold">
                <Link href={`/tournaments/${tournamentId}/matches`}>
                  Ver todos
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {recentMatches.map((match: any) => (
                <Link key={match.id} href={`/tournaments/${tournamentId}/matches/${match.id}`}>
                  <Card className="group hover:border-primary transition-all hover:shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-br from-primary/5 to-accent/5 p-4 border-b">
                      <Badge variant="secondary" className="text-xs font-bold">
                        FINALIZADO
                      </Badge>
                    </div>

                    <CardContent className="p-6">
                      <div className="space-y-3">
                        {/* Home Team */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {match.home_team?.logo_url ? (
                              <div className="relative h-9 w-9 rounded-full overflow-hidden border-2 border-border">
                                <Image
                                  src={match.home_team.logo_url || "/placeholder.svg"}
                                  alt={match.home_team.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground font-bold text-xs">
                                {match.home_team?.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="font-bold text-sm flex-1">{match.home_team?.name}</span>
                          </div>
                          <span className="text-2xl font-black tabular-nums">{match.home_score ?? 0}</span>
                        </div>

                        <div className="border-t" />

                        {/* Away Team */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {match.away_team?.logo_url ? (
                              <div className="relative h-9 w-9 rounded-full overflow-hidden border-2 border-border">
                                <Image
                                  src={match.away_team.logo_url || "/placeholder.svg"}
                                  alt={match.away_team.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-accent-foreground font-bold text-xs">
                                {match.away_team?.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="font-bold text-sm flex-1">{match.away_team?.name}</span>
                          </div>
                          <span className="text-2xl font-black tabular-nums">{match.away_score ?? 0}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                        {new Date(match.match_date).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "long",
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Teams Grid */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-balance">Equipos Participantes</h2>
              <p className="text-muted-foreground mt-1">Todos los equipos del torneo</p>
            </div>
            <Button asChild variant="ghost" className="font-semibold">
              <Link href={`/tournaments/${tournamentId}/standings`}>
                Ver clasificación
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {teams?.map((item: any) => (
              <Card
                key={item.team.id}
                className="group hover:border-primary transition-all hover:shadow-lg overflow-hidden"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center gap-4">
                    {item.team.logo_url ? (
                      <div className="relative h-20 w-20 rounded-full overflow-hidden border-4 border-border group-hover:border-primary transition-colors">
                        <Image
                          src={item.team.logo_url || "/placeholder.svg"}
                          alt={item.team.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary via-secondary to-accent text-primary-foreground font-black text-2xl shadow-lg group-hover:scale-110 transition-transform">
                        {item.team.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-lg leading-tight">{item.team.name}</h3>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Quick Links */}
        <section className="grid gap-4 md:grid-cols-3">
          <Link href={`/tournaments/${tournamentId}/matches`}>
            <Card className="group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
              <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-black text-xl mb-1">Calendario</h3>
                  <p className="text-sm text-muted-foreground">Ver todos los partidos programados</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/tournaments/${tournamentId}/standings`}>
            <Card className="group hover:border-secondary hover:bg-secondary/5 transition-all cursor-pointer">
              <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 rounded-full bg-secondary/10 group-hover:bg-secondary/20 flex items-center justify-center transition-colors">
                  <Trophy className="h-8 w-8 text-secondary" />
                </div>
                <div>
                  <h3 className="font-black text-xl mb-1">Clasificación</h3>
                  <p className="text-sm text-muted-foreground">Tabla de posiciones actualizada</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/tournaments/${tournamentId}/stats`}>
            <Card className="group hover:border-accent hover:bg-accent/5 transition-all cursor-pointer">
              <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 rounded-full bg-accent/10 group-hover:bg-accent/20 flex items-center justify-center transition-colors">
                  <TrendingUp className="h-8 w-8 text-accent" />
                </div>
                <div>
                  <h3 className="font-black text-xl mb-1">Estadísticas</h3>
                  <p className="text-sm text-muted-foreground">Números y récords del torneo</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </section>
      </div>
    </main>
  )
}
