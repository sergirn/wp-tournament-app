import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Target, AlertCircle, CalendarRange, Goal } from "lucide-react"

type PlayerStat = {
  player_id: string
  name: string
  cap_number: number | null
  team_name: string
  goals?: number
  exclusions?: number
}

export default async function StatsPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>
}) {
  const { tournamentId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: tournamentMatches } = await supabase
    .from("matches")
    .select("id")
    .eq("tournament_id", tournamentId)

  const matchIds = tournamentMatches?.map((m) => m.id) || []

  const eventSelect = `
      player_id,
      players!inner(
        name,
        cap_number,
        team_id,
        teams!inner(name)
      )
    `

  const loadAllEvents = async (eventType: "goal" | "exclusion") => {
    const allEvents: any[] = []
    const matchIdChunks = Array.from({ length: Math.ceil(matchIds.length / 100) }, (_, index) => matchIds.slice(index * 100, (index + 1) * 100))

    for (const matchIdChunk of matchIdChunks) {
      let from = 0
      const pageSize = 500
      while (true) {
        const { data, error } = await supabase
          .from("match_events")
          .select(eventSelect)
          .eq("event_type", eventType)
          .in("match_id", matchIdChunk)
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) throw new Error(`No se pudieron cargar todos los eventos del torneo: ${error.message}`)
        allEvents.push(...(data || []))
        if (!data || data.length < pageSize) break
        from += pageSize
      }
    }

    return allEvents
  }

  const [{ data: topScorers }, { data: topExclusions }] = matchIds.length > 0
    ? (await Promise.all([loadAllEvents("goal"), loadAllEvents("exclusion")])).map((data) => ({ data }))
    : [{ data: [] }, { data: [] }]

  const scorerStats =
    topScorers?.reduce((acc: PlayerStat[], event: any) => {
      const playerId = event.player_id
      const existing = acc.find((s) => s.player_id === playerId)

      if (existing) {
        existing.goals = (existing.goals || 0) + 1
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
    }, []) || []

  const sortedScorers = scorerStats.sort((a, b) => (b.goals || 0) - (a.goals || 0) || a.name.localeCompare(b.name, "es")).slice(0, 10)

  const exclusionStats =
    topExclusions?.reduce((acc: PlayerStat[], event: any) => {
      const playerId = event.player_id
      const existing = acc.find((s) => s.player_id === playerId)

      if (existing) {
        existing.exclusions = (existing.exclusions || 0) + 1
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
    }, []) || []

  const sortedExclusions = exclusionStats
    .sort((a, b) => (b.exclusions || 0) - (a.exclusions || 0))
    .slice(0, 5)

  const { data: matches } = await supabase
    .from("matches")
    .select("team_a_score, team_b_score, status")
    .eq("tournament_id", tournamentId)

  const finishedMatches = matches?.filter((match) => match.status === "finished") || []
  const totalMatches = matches?.length || 0
  const completedMatches = finishedMatches.length
  const totalGoals =
    finishedMatches.reduce((sum, match) => sum + (match.team_a_score || 0) + (match.team_b_score || 0), 0)

  return (
    <div className="container mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Tournament Statistics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Overview, scoring leaders, and discipline metrics
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-2 sm:gap-4">
        <StatCard
          title="Total Matches"
          value={totalMatches}
          subtitle="All recorded matches"
          icon={CalendarRange}
        />
        <StatCard
          title="Total Goals"
          value={totalGoals}
          subtitle="Goals across the tournament"
          icon={Goal}
        />
      </div>

      {/* Rankings */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Trophy className="h-4 w-4 text-foreground" />
              Top Scorers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedScorers.length > 0 ? (
              <div className="space-y-2">
                {sortedScorers.map((scorer, index) => (
                  <RankingRow
                    key={scorer.player_id}
                    index={index}
                    name={scorer.name}
                    capNumber={scorer.cap_number}
                    teamName={scorer.team_name}
                    value={scorer.goals || 0}
                    valueLabel="goals"
                    highlight={index < 3}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Target}
                title="No goals recorded"
                description="Scoring stats will appear once match events are registered."
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <AlertCircle className="h-4 w-4 text-foreground" />
              Most Exclusions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedExclusions.length > 0 ? (
              <div className="space-y-2">
                {sortedExclusions.map((player, index) => (
                  <RankingRow
                    key={player.player_id}
                    index={index}
                    name={player.name}
                    capNumber={player.cap_number}
                    teamName={player.team_name}
                    value={player.exclusions || 0}
                    valueLabel="exclusions"
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={AlertCircle}
                title="No exclusions recorded"
                description="Disciplinary stats will appear once exclusion events are registered."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string
  value: string | number
  subtitle: string
  icon: React.ElementType
}) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RankingRow({
  index,
  name,
  capNumber,
  teamName,
  value,
  valueLabel,
  highlight = false,
}: {
  index: number
  name: string
  capNumber: number | null
  teamName: string
  value: number
  valueLabel: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            highlight
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {index + 1}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground sm:text-[15px]">
            {capNumber ? `#${capNumber} ` : ""}
            {name}
          </p>
          <p className="truncate text-xs text-muted-foreground sm:text-sm">
            {teamName}
          </p>
        </div>
      </div>

      <div className="ml-3 text-right">
        <p className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {value}
        </p>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {valueLabel}
        </p>
      </div>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
