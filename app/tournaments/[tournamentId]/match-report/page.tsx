import { createClient } from "@/lib/supabase/server"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { TeamLogo } from "@/components/team-logo"
import { MatchActions } from "@/components/match-actions"
import { GroupFixtures } from "@/components/match-report/group-fixtures"
import { MatchReportForm } from "@/components/match-report-form"

export default async function MatchReportPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>
}) {
  const { tournamentId } = await params
  const supabase = await createClient()
  const { data: tournamentTeamRows } = await supabase.from("tournament_teams").select("team:teams(id, name, logo_url)").eq("tournament_id", tournamentId)
  const tournamentTeams = (tournamentTeamRows || []).flatMap((row) => {
    const team = row.team as unknown as { id: string; name: string; logo_url: string | null } | null
    return team ? [team] : []
  })

  const [{ data: groupRows }, { data: groupMatches }, { data: groupPhaseRows }] =
    await Promise.all([
      supabase
        .from("groups")
        .select(
          `
          id,
          name,
          order_number,
          phase_id,
          group_members(
            team:teams(
              id,
              name,
              logo_url
            )
          )
        `
        )
        .eq("tournament_id", tournamentId)
        .order("order_number"),

      supabase
        .from("matches")
        .select(
          `
          id,
          group_id,
          team_a_id,
          team_b_id,
          team_a_score,
          team_b_score
        `
        )
        .eq("tournament_id", tournamentId)
        .not("group_id", "is", null),
      supabase.from("tournament_phases").select("id, name, phase_order").eq("tournament_id", tournamentId).eq("phase_type", "group").order("phase_order"),
    ])

  const groupsData = (groupRows || []).map((group) => ({
    id: group.id,
    name: group.name,
    phaseId: group.phase_id as string | null,
    teams: (
      (group.group_members || []) as unknown as Array<{
        team: {
          id: string
          name: string
          logo_url: string | null
        } | null
      }>
    ).flatMap((member) =>
      member.team ? [member.team] : []
    ),
  }))
  const firstGroupPhase = groupPhaseRows?.[0] || null
  const secondGroupPhase = groupPhaseRows?.[1] || null
  const firstStageGroups = firstGroupPhase ? groupsData.filter((group) => group.phaseId === firstGroupPhase.id) : groupsData
  const secondStageGroups = secondGroupPhase ? groupsData.filter((group) => group.phaseId === secondGroupPhase.id) : []

  const existingGroupMatches = (groupMatches || []).map(
    (match) => ({
      id: match.id,
      groupId: match.group_id!,
      teamAId: match.team_a_id!,
      teamBId: match.team_b_id!,
      teamAScore: match.team_a_score || 0,
      teamBScore: match.team_b_score || 0,
    })
  )

  const { data: knockoutMatches } = await supabase
    .from("matches")
    .select(
      `
      id,
      status,
      team_a_score,
      team_b_score,
      phase:tournament_phases!inner(
        name,
        phase_order,
        phase_type
      ),
      team_a:teams!matches_team_a_id_fkey(
        name,
        logo_url
      ),
      team_b:teams!matches_team_b_id_fkey(
        name,
        logo_url
      )
    `
    )
    .eq("tournament_id", tournamentId)
    .eq("phase.phase_type", "knockout")
    .order("match_date")

  const knockoutPhases = Object.values(
    (knockoutMatches || []).reduce(
      (acc, match) => {
        const phase = match.phase as unknown as {
          name: string
          phase_order: number
          phase_type: string
        }

        const key = `${phase.phase_order}-${phase.name}`

        if (!acc[key]) {
          acc[key] = {
            name: phase.name,
            order: phase.phase_order,
            matches: [],
          }
        }

        acc[key].matches.push(match)

        return acc
      },
      {} as Record<
        string,
        {
          name: string
          order: number
          matches: NonNullable<typeof knockoutMatches>
        }
      >
    )
  ).sort((a, b) => a.order - b.order)

  const knockoutCount = knockoutMatches?.length || 0

  return (
    <main className="h-[calc(100dvh-4rem)] p-2 sm:p-4 lg:p-5">
      <Tabs
        defaultValue="groups"
        className="h-full gap-4"
      >
        {/* ========================== */}
        {/* FASE DE GRUPOS */}
        {/* ========================== */}

        <TabsContent
          value="groups"
          className="min-h-0 overflow-hidden rounded-xl"
        >
          <div className="h-full p-2">
            <GroupFixtures
              tournamentId={tournamentId}
              groups={firstStageGroups}
              existingMatches={existingGroupMatches}
              knockoutCount={knockoutCount}
              stageTitle={firstGroupPhase?.name || "Fase de grupos 1"}
              secondStageAvailable={Boolean(secondGroupPhase)}
            />
          </div>
        </TabsContent>

        {secondGroupPhase && <TabsContent value="groups-2" className="min-h-0 overflow-hidden rounded-xl"><div className="h-full p-2"><GroupFixtures tournamentId={tournamentId} groups={secondStageGroups} existingMatches={existingGroupMatches} knockoutCount={knockoutCount} stageTitle={secondGroupPhase.name} secondStageAvailable /></div></TabsContent>}

        {/* ========================== */}
        {/* ELIMINATORIAS */}
        {/* ========================== */}

        <TabsContent
          value="knockout"
          className="min-h-0 overflow-y-auto"
        >
          <div className="mx-auto max-w-6xl space-y-4 p-2">
            {/* TÍTULO */}
            <div>
              <h1 className="text-2xl font-bold">
                Actas eliminatorias
              </h1>

              <p className="text-sm text-muted-foreground">
                Selecciona un cruce preparado. Los equipos
                están definidos por el cuadro y no se pueden
                cambiar.
              </p>
            </div>

            <TabsList className={`grid h-11 w-full shrink-0 ${secondGroupPhase ? "grid-cols-4" : "grid-cols-3"}`}>
              <TabsTrigger value="groups">Grupos 1</TabsTrigger>
              {secondGroupPhase && <TabsTrigger value="groups-2">Grupos 2</TabsTrigger>}
              <TabsTrigger value="knockout">Eliminatorias{knockoutCount > 0 ? ` (${knockoutCount})` : ""}</TabsTrigger>
              <TabsTrigger value="free">Acta libre</TabsTrigger>
            </TabsList>

            {/* FASES */}
            <div className="space-y-8 pt-1">
              {knockoutPhases.length ? (
                knockoutPhases.map((phase) => (
                  <section
                    key={`${phase.order}-${phase.name}`}
                    className="space-y-4"
                  >
                    {/* TÍTULO DE LA RONDA */}
                    <div className="flex items-center gap-4">
                      <h2 className="shrink-0 text-sm font-bold uppercase tracking-wider">
                        {phase.name}
                      </h2>

                      <div className="h-px flex-1 bg-border" />
                    </div>

                    {/* PARTIDOS */}
                    <div className="grid gap-4 md:grid-cols-2">
                      {phase.matches.map(
                        (match, index) => {
                          const teamA =
                            match.team_a as unknown as {
                              name: string
                              logo_url: string | null
                            }

                          const teamB =
                            match.team_b as unknown as {
                              name: string
                              logo_url: string | null
                            }

                          return (
                            <Card key={match.id} className="overflow-hidden border-border/70 bg-card shadow-sm transition-shadow hover:shadow-md">
                              <CardContent className="flex h-full flex-col p-0">
                                <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2.5">
                                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Partido {index + 1}</span>
                                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${match.status === "finished" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-background text-muted-foreground"}`}>{match.status === "finished" ? "Acta registrada" : "Pendiente"}</span>
                                </div>

                                <div className="grid flex-1 grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] items-center gap-2 px-4 py-6 sm:px-5">
                                  <div className="flex min-w-0 flex-col items-center gap-3 text-center">
                                    <TeamLogo name={teamA.name} logoUrl={teamA.logo_url} className="h-14 w-14 bg-background shadow-sm" />
                                    <strong className="line-clamp-2 min-h-10 text-sm leading-5 sm:text-base">{teamA.name}</strong>
                                  </div>

                                  <div className="flex h-10 min-w-10 items-center justify-center rounded-full border bg-muted/30 px-2 text-[11px] font-bold text-muted-foreground">{match.status === "finished" ? `${match.team_a_score ?? 0}–${match.team_b_score ?? 0}` : "VS"}</div>

                                  <div className="flex min-w-0 flex-col items-center gap-3 text-center">
                                    <TeamLogo name={teamB.name} logoUrl={teamB.logo_url} className="h-14 w-14 bg-background shadow-sm" />
                                    <strong className="line-clamp-2 min-h-10 text-sm leading-5 sm:text-base">{teamB.name}</strong>
                                  </div>
                                </div>

                                <div className="mt-auto border-t">
                                  <MatchActions tournamentId={tournamentId} match={{ id: match.id, teamAName: teamA.name, teamBName: teamB.name }} reportOnly actionLabel={match.status === "finished" ? "Editar o descargar acta" : "Registrar acta"} />
                                </div>
                              </CardContent>
                            </Card>
                          )
                        }
                      )}
                    </div>
                  </section>
                ))
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No hay cruces eliminatorios disponibles.
                    Cuando estén definidos los dos equipos de
                    un cruce aparecerá aquí, incluso después de registrar su acta.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="free" className="min-h-0 overflow-hidden rounded-xl">
          <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 p-2"><div><h1 className="text-2xl font-bold">Acta libre</h1><p className="text-sm text-muted-foreground">Selecciona dos equipos y registra goles, exclusiones y observaciones en una única vista.</p></div><TabsList className={`grid h-11 w-full shrink-0 ${secondGroupPhase ? "grid-cols-4" : "grid-cols-3"}`}><TabsTrigger value="groups">Grupos 1</TabsTrigger>{secondGroupPhase && <TabsTrigger value="groups-2">Grupos 2</TabsTrigger>}<TabsTrigger value="knockout">Eliminatorias{knockoutCount > 0 ? ` (${knockoutCount})` : ""}</TabsTrigger><TabsTrigger value="free">Acta libre</TabsTrigger></TabsList><div className="min-h-0 flex-1 overflow-hidden rounded-2xl border bg-card shadow-sm"><MatchReportForm teams={tournamentTeams} tournamentId={tournamentId} skipGroupLookup /></div></div>
        </TabsContent>
      </Tabs>
    </main>
  )
}
