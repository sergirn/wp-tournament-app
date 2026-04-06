import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarDays, MapPin, Eye, Trophy, ChevronRight } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default async function MatchesPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const resolvedParams = await params
  const { tournamentId } = resolvedParams

  const { data: matches } = await supabase
    .from("matches")
    .select(`
      *,
      team_a:teams!matches_team_a_id_fkey(name, logo_url),
      team_b:teams!matches_team_b_id_fkey(name, logo_url)
    `)
    .eq("tournament_id", tournamentId)
    .order("match_date", { ascending: false })

  return (
    <div className="container mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6 sm:mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Tournament Matches
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Full history of all recorded matches
            </p>
          </div>

          {matches && matches.length > 0 && (
            <div className="hidden sm:flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {matches.length} {matches.length === 1 ? "match" : "matches"}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4">
        {matches && matches.length > 0 ? (
          matches.map((match) => {
            const matchDate = new Date(match.match_date)

            return (
              <Link
                key={match.id}
                href={`/tournaments/${tournamentId}/matches/${match.id}`}
                className="block"
              >
                <Card className="group overflow-hidden border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="p-4 sm:p-5">
                    {/* Top meta */}
                    <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          <span>
                            {matchDate.toLocaleDateString("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        {match.location && (
                          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="max-w-[180px] truncate sm:max-w-[240px]">
                              {match.location}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Eye className="h-3.5 w-3.5" />
                        <span>View details</span>
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>

                    {/* Main content */}
                    <div className="grid gap-4 sm:gap-5 md:grid-cols-[1fr_auto_1fr] md:items-center">
                      {/* Team A */}
                      <div className="flex items-center gap-3 md:justify-end">
                        <TeamLogo
                          name={match.team_a?.name}
                          logoUrl={match.team_a?.logo_url}
                        />
                        <div className="min-w-0 md:text-right">
                          <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                            {match.team_a?.name || "Home Team"}
                          </p>
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Home
                          </span>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="mx-auto w-full max-w-[220px] rounded-xl  px-4 py-3 text-center  sm:px-5">
                        <div className="flex items-center justify-center gap-3">
                          <span className="min-w-[28px] text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            {match.team_a_score ?? 0}
                          </span>
                          <span className="text-base font-medium text-muted-foreground sm:text-lg">
                            —
                          </span>
                          <span className="min-w-[28px] text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            {match.team_b_score ?? 0}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Final score
                        </div>
                      </div>

                      {/* Team B */}
                      <div className="flex items-center gap-3 md:justify-start">
                        <TeamLogo
                          name={match.team_b?.name}
                          logoUrl={match.team_b?.logo_url}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                            {match.team_b?.name || "Away Team"}
                          </p>
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Away
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Comments */}
                    {match.comments && (
                      <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Comments
                        </p>
                        <p className="line-clamp-3 text-sm leading-6 text-foreground/90">
                          {match.comments}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })
        ) : (
          <Card className="border-dashed border-border bg-card shadow-sm">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center sm:py-20">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/40">
                <Trophy className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">No matches yet</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                There are no recorded matches for this tournament yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function TeamLogo({
  name,
  logoUrl,
}: {
  name?: string | null
  logoUrl?: string | null
}) {
  if (logoUrl) {
    return (
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-border bg-background sm:h-12 sm:w-12">
        <Image
          src={logoUrl || "/placeholder.svg"}
          alt={name || "Team logo"}
          fill
          className="object-cover"
          sizes="48px"
        />
      </div>
    )
  }

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 sm:h-12 sm:w-12">
      <Trophy className="h-4 w-4 text-muted-foreground" />
    </div>
  )
}