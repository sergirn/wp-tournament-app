"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  CircleDashed,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"

import { MatchReportForm } from "@/components/match-report-form"
import { MatchActions } from "@/components/match-actions"
import { TeamLogo } from "@/components/team-logo"

interface Team {
  id: string
  name: string
  logo_url: string | null
}

interface Group {
  id: string
  name: string
  teams: Team[]
}

interface ExistingMatch {
  id: string
  groupId: string
  teamAId: string
  teamBId: string
  teamAScore: number
  teamBScore: number
}

interface GroupFixturesProps {
  tournamentId: string
  groups: Group[]
  existingMatches: ExistingMatch[]
  knockoutCount: number
  stageTitle?: string
  secondStageAvailable?: boolean
}

export function GroupFixtures({
  tournamentId,
  groups,
  existingMatches,
  knockoutCount,
  stageTitle = "Fase de grupos 1",
  secondStageAvailable = false,
}: GroupFixturesProps) {
  const router = useRouter()

  const [selectedGroupId, setSelectedGroupId] =
    useState(groups[0]?.id || "")

  const [openFixture, setOpenFixture] = useState<{
    groupId: string
    teamA: Team
    teamB: Team
  } | null>(null)

  const selectedGroup = groups.find(
    (group) => group.id === selectedGroupId
  )

  const fixtures = useMemo(() => {
    if (!selectedGroup) return []

    return selectedGroup.teams.flatMap(
      (teamA, index) =>
        selectedGroup.teams
          .slice(index + 1)
          .map((teamB) => {
            const match = existingMatches.find(
              (item) =>
                item.groupId === selectedGroup.id &&
                (
                  (
                    item.teamAId === teamA.id &&
                    item.teamBId === teamB.id
                  ) ||
                  (
                    item.teamAId === teamB.id &&
                    item.teamBId === teamA.id
                  )
                )
            )

            return {
              teamA,
              teamB,
              match,
            }
          })
    )
  }, [existingMatches, selectedGroup])

  const completed = fixtures.filter(
    (fixture) => fixture.match
  ).length

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-4 overflow-hidden">
      {/* ========================== */}
      {/* TÍTULO */}
      {/* ========================== */}

      <div className="shrink-0">
        <h1 className="text-2xl font-bold">
          Partidos de {stageTitle.toLowerCase()}
        </h1>

        <p className="text-sm text-muted-foreground">
          Cada equipo se enfrenta una vez contra todos los
          equipos de su grupo.
        </p>
      </div>

      <TabsList className={`grid h-11 w-full shrink-0 ${secondStageAvailable ? "grid-cols-4" : "grid-cols-3"}`}>
        <TabsTrigger value="groups">Grupos 1</TabsTrigger>
        {secondStageAvailable && <TabsTrigger value="groups-2">Grupos 2</TabsTrigger>}
        <TabsTrigger value="knockout">Eliminatorias{knockoutCount > 0 ? ` (${knockoutCount})` : ""}</TabsTrigger>
        <TabsTrigger value="free">Acta libre</TabsTrigger>
      </TabsList>

      {/* ========================== */}
      {/* TABS PRINCIPALES */}
      {/* ========================== */}

      {/* ========================== */}
      {/* SIN GRUPOS */}
      {/* ========================== */}

      {!groups.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay grupos configurados en este torneo.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ========================== */}
          {/* SELECTOR DE GRUPOS */}
          {/* ========================== */}

          <div
            className="grid w-full shrink-0 gap-2 border-b pb-3"
            style={{
              gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))`,
            }}
          >
            {groups.map((group) => (
              <Button
                key={group.id}
                type="button"
                variant={
                  selectedGroupId === group.id
                    ? "default"
                    : "outline"
                }
                className="w-full"
                onClick={() =>
                  setSelectedGroupId(group.id)
                }
              >
                {group.name}
              </Button>
            ))}
          </div>

          {/* ========================== */}
          {/* RESUMEN */}
          {/* ========================== */}

          <div className="shrink-0 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
            <strong>
              {selectedGroup?.name}
            </strong>

            {" · "}

            {completed} de {fixtures.length} partidos
            resueltos
          </div>

          {/* ========================== */}
          {/* PARTIDOS */}
          {/* ========================== */}

          <div className="grid min-h-0 gap-3 overflow-y-auto pb-2 md:grid-cols-2">
            {fixtures.map((fixture) => (
              <Card
                key={`${fixture.teamA.id}-${fixture.teamB.id}`}
              >
                <CardContent className="flex h-full flex-col gap-4 p-4">
                  {/* EQUIPOS */}
                  <div className="flex items-center justify-between gap-3">
                    {/* EQUIPO A */}
                    <div className="flex min-w-0 items-center gap-2">
                      <TeamLogo
                        name={fixture.teamA.name}
                        logoUrl={
                          fixture.teamA.logo_url
                        }
                        className="h-9 w-9"
                      />

                      <span className="truncate font-semibold">
                        {fixture.teamA.name}
                      </span>
                    </div>

                    <span className="shrink-0 text-xs text-muted-foreground">
                      VS
                    </span>

                    {/* EQUIPO B */}
                    <div className="flex min-w-0 items-center gap-2">
                      <TeamLogo
                        name={fixture.teamB.name}
                        logoUrl={
                          fixture.teamB.logo_url
                        }
                        className="h-9 w-9"
                      />

                      <span className="truncate font-semibold">
                        {fixture.teamB.name}
                      </span>
                    </div>
                  </div>

                  {/* PARTIDO RESUELTO */}
                  {fixture.match ? (
                  /* PARTIDO RESUELTO */
                  <div className="mt-auto flex flex-col gap-3">
                    {/* ESTADO */}
                    <div className="flex items-center justify-center gap-2 py-2 text-center text-sm text-green-600">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />

                      <span>Resuelto ·</span>

                      <strong className="tabular-nums">
                        {fixture.match.teamAId === fixture.teamA.id
                          ? fixture.match.teamAScore
                          : fixture.match.teamBScore}

                        {" - "}

                        {fixture.match.teamAId === fixture.teamA.id
                          ? fixture.match.teamBScore
                          : fixture.match.teamAScore}
                      </strong>
                    </div>

                    {/* EDITAR ACTA */}
                    <div className="-mx-4 -mb-4 mt-auto">
                      <MatchActions
                        tournamentId={tournamentId}
                        match={{
                          id: fixture.match.id,
                          teamAName: fixture.teamA.name,
                          teamBName: fixture.teamB.name,
                        }}
                        reportOnly
                      />
                    </div>
                  </div>
                ) : (
                  /* PARTIDO PENDIENTE */
                  <div className="mt-auto flex flex-col gap-3">
                    {/* ESTADO */}
                    <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                      <CircleDashed className="h-4 w-4 shrink-0" />
                      Pendiente
                    </div>

                    {/* REGISTRAR ACTA */}
                    <div className="-mx-4 -mb- mt-auto">
                      <Button
                        className="h-12 w-full rounded-t-none rounded-b-xl text-sm font-semibold"
                        onClick={() => {
                          if (!selectedGroup) return

                          setOpenFixture({
                            groupId: selectedGroup.id,
                            teamA: fixture.teamA,
                            teamB: fixture.teamB,
                          })
                        }}
                      >
                        Registrar acta
                      </Button>
                    </div>
                  </div>
                )}
                </CardContent>
              </Card>
            ))}

            {!fixtures.length && (
              <Card className="md:col-span-2">
                <CardContent className="py-12 text-center text-muted-foreground">
                  Este grupo necesita al menos dos
                  equipos.
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* ========================== */}
      {/* MODAL REGISTRAR ACTA */}
      {/* ========================== */}

      <Dialog
        open={Boolean(openFixture)}
        onOpenChange={(open) => {
          if (!open) {
            setOpenFixture(null)
          }
        }}
      >
        <DialogContent className="!inset-3 flex !h-[calc(100dvh-1.5rem)] !w-auto !max-w-none !translate-x-0 !translate-y-0 flex-col overflow-hidden p-3 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:p-5">
          <DialogHeader>
            <DialogTitle>
              Registrar acta de grupo
            </DialogTitle>

            <DialogDescription>
              {openFixture?.teamA.name} contra{" "}
              {openFixture?.teamB.name}. Los equipos
              pertenecen a {selectedGroup?.name}.
            </DialogDescription>
          </DialogHeader>

          {openFixture && (
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border bg-card shadow-sm">
              <MatchReportForm
                teams={[
                  openFixture.teamA,
                  openFixture.teamB,
                ]}
                tournamentId={tournamentId}
                initialTeamAId={
                  openFixture.teamA.id
                }
                initialTeamBId={
                  openFixture.teamB.id
                }
                fixedGroupId={
                  openFixture.groupId
                }
                lockTeams
                onSaved={() => {
                  setOpenFixture(null)
                  router.refresh()
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
