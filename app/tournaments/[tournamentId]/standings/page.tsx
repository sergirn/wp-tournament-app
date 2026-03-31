import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy } from "lucide-react"

export default async function StandingsPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: standings } = await supabase
    .from("tournament_standings")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("group_name")
    .order("points", { ascending: false })
    .order("goal_difference", { ascending: false })

  console.log("[v0] Standings data:", standings)

  // Agrupar por grupos
  const groupedStandings = standings?.reduce(
    (acc, standing) => {
      const groupName = standing.group_name || "Sin Grupo"
      if (!acc[groupName]) {
        acc[groupName] = []
      }
      acc[groupName].push(standing)
      return acc
    },
    {} as Record<string, typeof standings>,
  )

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6 md:mb-8">
        <h1 className="text-4xl font-bold gradient-text mb-2">Clasificación</h1>
        <p className="text-muted-foreground">Tabla de posiciones actualizada</p>
      </div>

      <div className="grid gap-4 md:gap-6">
        {groupedStandings && Object.keys(groupedStandings).length > 0 ? (
          Object.entries(groupedStandings).map(([groupName, teams]) => (
            <Card key={groupName} className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-cyan-400" />
                  {groupName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-2 md:mx-0">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-3 px-2 text-xs md:text-sm font-semibold text-muted-foreground">
                          #
                        </th>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold text-muted-foreground">
                          Equipo
                        </th>
                        <th className="text-center py-3 px-2 text-xs md:text-sm font-semibold text-muted-foreground">
                          PJ
                        </th>
                        <th className="text-center py-3 px-2 text-xs md:text-sm font-semibold text-muted-foreground">
                          G
                        </th>
                        <th className="text-center py-3 px-2 text-xs md:text-sm font-semibold text-muted-foreground">
                          E
                        </th>
                        <th className="text-center py-3 px-2 text-xs md:text-sm font-semibold text-muted-foreground">
                          P
                        </th>
                        <th className="text-center py-3 px-2 text-xs md:text-sm font-semibold text-muted-foreground">
                          GF
                        </th>
                        <th className="text-center py-3 px-2 text-xs md:text-sm font-semibold text-muted-foreground">
                          GC
                        </th>
                        <th className="text-center py-3 px-2 text-xs md:text-sm font-semibold text-muted-foreground">
                          DIF
                        </th>
                        <th className="text-center py-3 px-2 text-sm md:text-base font-bold text-cyan-400">PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((team, index) => (
                        <tr
                          key={team.team_id}
                          className={`border-b border-border/30 hover:bg-accent/5 transition-colors ${
                            index < 2 ? "bg-cyan-500/5" : ""
                          }`}
                        >
                          <td className="py-3 px-2 text-xs md:text-sm font-medium">
                            {index < 2 && (
                              <span className="inline-block w-1 h-6 bg-gradient-sport rounded-full mr-2"></span>
                            )}
                            {index + 1}
                          </td>
                          <td className="py-3 px-4 text-sm md:text-base font-semibold">{team.team_name}</td>
                          <td className="text-center py-3 px-2 text-xs md:text-sm">{team.matches_played || 0}</td>
                          <td className="text-center py-3 px-2 text-xs md:text-sm text-green-400">{team.wins || 0}</td>
                          <td className="text-center py-3 px-2 text-xs md:text-sm text-yellow-400">
                            {team.draws || 0}
                          </td>
                          <td className="text-center py-3 px-2 text-xs md:text-sm text-red-400">{team.losses || 0}</td>
                          <td className="text-center py-3 px-2 text-xs md:text-sm">{team.goals_for || 0}</td>
                          <td className="text-center py-3 px-2 text-xs md:text-sm">{team.goals_against || 0}</td>
                          <td className="text-center py-3 px-2 text-xs md:text-sm font-medium">
                            {Number(team.goal_difference) > 0 ? "+" : ""}
                            {team.goal_difference || 0}
                          </td>
                          <td className="text-center py-3 px-2 text-sm md:text-base font-bold text-cyan-400">
                            {team.points || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-1 h-4 bg-gradient-sport rounded-full"></span>
                    <span>Clasificados a siguiente fase</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No hay clasificación disponible aún</p>
              <p className="text-xs text-muted-foreground mt-2">
                Los datos se actualizarán automáticamente cuando se registren partidos
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export const revalidate = 0
export const dynamic = "force-dynamic"
