"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TeamLogo } from "@/components/team-logo"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  ShieldCheck,
  Swords,
  Trash2,
  Trophy,
  Users,
} from "lucide-react"

interface QualifiedTeam { id: string; name: string; logo_url: string | null; groupPosition: number }
interface BracketNode { id: string; phaseId: string; phaseName: string; phaseOrder: number; position: number; teamAId: string | null; teamBId: string | null; winnerTeamId: string | null; status: string }

export function BracketConfigurator({ tournamentId, groupSizes, canManage, config, teams, nodes, mode = "configuration", canReset = false, defaultQualifiersPerGroup }: {
  tournamentId: string
  groupSizes: number[]
  canManage: boolean
  config: { qualifiersPerGroup: number; status: string } | null
  teams: QualifiedTeam[]
  nodes: BracketNode[]
  mode?: "configuration" | "bracket"
  canReset?: boolean
  defaultQualifiersPerGroup?: number
}) {
  const router = useRouter()
  const firstRoundOrder = nodes.length ? Math.min(...nodes.map((node) => node.phaseOrder)) : null
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(config?.qualifiersPerGroup || defaultQualifiersPerGroup || Math.min(2, Math.max(1, ...groupSizes)))
  const [assignments, setAssignments] = useState(() => nodes.filter((node) => node.phaseOrder === firstRoundOrder).sort((a, b) => a.position - b.position).map((node) => ({ nodeId: node.id, teamAId: node.teamAId, teamBId: node.teamBId })))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const maxQualifiers = Math.max(1, ...groupSizes.filter(Boolean))
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])
  const selectedIds = assignments.flatMap((item) => [item.teamAId, item.teamBId]).filter(Boolean)

  useEffect(() => {
    setAssignments(nodes.filter((node) => node.phaseOrder === firstRoundOrder).sort((a, b) => a.position - b.position).map((node) => ({ nodeId: node.id, teamAId: node.teamAId, teamBId: node.teamBId })))
  }, [nodes, firstRoundOrder])

  const request = async (url: string, method: string, body: unknown) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo guardar la configuración")
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la configuración")
    } finally {
      setLoading(false)
    }
  }

  const resetBracket = async (resetMode: "edit" | "all") => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/bracket?mode=${resetMode}`, { method: "DELETE" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudieron modificar las eliminatorias")
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron modificar las eliminatorias")
    } finally {
      setLoading(false)
    }
  }

  const setSlot = (nodeId: string, slot: "teamAId" | "teamBId", value: string) => {
    setAssignments((current) => current.map((item) => item.nodeId === nodeId ? { ...item, [slot]: value === "bye" ? null : value } : item))
  }

  const renderTeam = (teamId: string | null) => {
    const team = teamId ? teamMap.get(teamId) : null
    return team ? <div className="flex items-center gap-2"><TeamLogo name={team.name} logoUrl={team.logo_url} className="h-8 w-8" /><span>{team.name}</span></div> : <span className="text-muted-foreground">Por determinar</span>
  }

  const groupedNodes = Object.values(nodes.reduce<Record<number, BracketNode[]>>((result, node) => {
    ;(result[node.phaseOrder] ||= []).push(node)
    return result
  }, {})).sort((a, b) => a[0].phaseOrder - b[0].phaseOrder)

return (
  <Card className="overflow-hidden border-border shadow-sm">
    {/* HEADER */}
    <CardHeader className="border-b bg-muted/20 px-5 py-4 sm:px-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Trophy className="h-5 w-5" />
          </div>

          <div>
            <CardTitle className="text-lg">
              Fase eliminatoria
            </CardTitle>

            <p className="mt-0.5 text-sm text-muted-foreground">
              Configura los clasificados y genera los cruces del torneo.
            </p>
          </div>
        </div>

        {config && (
          <div
            className={
              config.status === "locked"
                ? "flex w-fit items-center gap-2 rounded-full bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-600"
                : "flex w-fit items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600"
            }
          >
            {config.status === "locked" ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Configuración confirmada
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5" />
                Pendiente de confirmar
              </>
            )}
          </div>
        )}
      </div>
    </CardHeader>

    <CardContent className="space-y-6 p-4 sm:p-6">

      {/* ======================================================= */}
      {/* PASO 1 - SELECCIONAR CLASIFICADOS */}
      {/* ======================================================= */}

      {mode === "configuration" && !config && canManage && (
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="border-b bg-muted/20 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                1
              </div>

              <div>
                <h3 className="font-semibold">
                  Selecciona los equipos clasificados
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  Indica cuántos equipos de cada grupo avanzan a la fase
                  eliminatoria.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Clasificados por grupo
              </Label>

              <Select
                disabled={Boolean(defaultQualifiersPerGroup)}
                value={String(qualifiersPerGroup)}
                onValueChange={(value) =>
                  setQualifiersPerGroup(Number(value))
                }
              >
                <SelectTrigger className="h-11 w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {Array.from(
                    { length: maxQualifiers },
                    (_, index) => (
                      <SelectItem
                        key={index + 1}
                        value={String(index + 1)}
                      >
                        {index + 1}{" "}
                        {index + 1 === 1
                          ? "equipo por grupo"
                          : "equipos por grupo"}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>

              <p className="text-xs text-muted-foreground">
                {defaultQualifiersPerGroup ? "Valor definido en Ajustes. Los grupos más pequeños clasificarán a todos sus equipos disponibles." : <>Máximo configurable según el grupo más grande: <strong>{maxQualifiers}</strong>. En los grupos más pequeños se clasificarán todos los disponibles.</>}
              </p>
            </div>

            <Button
              size="lg"
              className="gap-2 sm:min-w-52"
              disabled={loading}
              onClick={() =>
                void request(
                  `/api/tournaments/${tournamentId}/qualification`,
                  "POST",
                  { qualifiersPerGroup }
                )
              }
            >
              <Users className="h-4 w-4" />

              {loading
                ? "Calculando..."
                : "Calcular clasificados"}

              {!loading && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* PASO 2 - CONFIGURAR CRUCES */}
      {/* ======================================================= */}

      {mode === "configuration" &&
        config?.status === "draft" &&
        canManage && (
          <div className="space-y-6">

            {/* CABECERA */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                  2
                </div>

                <div>
                  <h3 className="font-semibold">
                    Configura los cruces
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Distribuye los equipos clasificados entre los diferentes
                    enfrentamientos.
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" className="gap-2" disabled={loading} onClick={() => void resetBracket("all")}>
                <RotateCcw className="h-4 w-4" />
                {loading ? "Volviendo..." : "Volver a clasificados"}
              </Button>
            </div>

            {/* RESUMEN */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    Clasificados
                  </span>
                </div>

                <p className="mt-2 text-2xl font-bold">
                  {teams.length}
                </p>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Swords className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    Cruces
                  </span>
                </div>

                <p className="mt-2 text-2xl font-bold">
                  {
                    nodes.filter(
                      (node) => node.phaseOrder === firstRoundOrder
                    ).length
                  }
                </p>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    Exentos
                  </span>
                </div>

                <p className="mt-2 text-2xl font-bold">
                  {nodes.filter(
                    (node) => node.phaseOrder === firstRoundOrder
                  ).length *
                    2 -
                    teams.length}
                </p>
              </div>
            </div>

            {/* CRUCES */}
            <div className="grid gap-4 xl:grid-cols-2">
              {assignments.map((assignment, index) => {
                const selectedA = assignment.teamAId
                  ? teamMap.get(assignment.teamAId)
                  : null

                const selectedB = assignment.teamBId
                  ? teamMap.get(assignment.teamBId)
                  : null

                return (
                  <div
                    key={assignment.nodeId}
                    className="overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-sm"
                  >
                    {/* Header cruce */}
                    <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                          {index + 1}
                        </div>

                        <span className="text-sm font-semibold">
                          Cruce {index + 1}
                        </span>
                      </div>

                      <Swords className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="space-y-4 p-4">
                      {/* EQUIPO A */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Equipo A
                        </Label>

                        <Select
                          value={
                            assignment.teamAId || "bye"
                          }
                          onValueChange={(value) =>
                            setSlot(
                              assignment.nodeId,
                              "teamAId",
                              value
                            )
                          }
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Seleccionar equipo" />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectItem value="bye">
                              Exento / sin equipo
                            </SelectItem>

                            {teams
                              .filter(
                                (team) =>
                                  assignment.teamAId ===
                                    team.id ||
                                  !selectedIds.includes(
                                    team.id
                                  )
                              )
                              .map((team) => (
                                <SelectItem
                                  key={team.id}
                                  value={team.id}
                                >
                                  {team.name} ·{" "}
                                  {team.groupPosition}º
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* VS */}
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-border" />

                        <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-bold text-muted-foreground">
                          VS
                        </span>

                        <div className="h-px flex-1 bg-border" />
                      </div>

                      {/* EQUIPO B */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Equipo B
                        </Label>

                        <Select
                          value={
                            assignment.teamBId || "bye"
                          }
                          onValueChange={(value) =>
                            setSlot(
                              assignment.nodeId,
                              "teamBId",
                              value
                            )
                          }
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Seleccionar equipo" />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectItem value="bye">
                              Exento / sin equipo
                            </SelectItem>

                            {teams
                              .filter(
                                (team) =>
                                  assignment.teamBId ===
                                    team.id ||
                                  !selectedIds.includes(
                                    team.id
                                  )
                              )
                              .map((team) => (
                                <SelectItem
                                  key={team.id}
                                  value={team.id}
                                >
                                  {team.name} ·{" "}
                                  {team.groupPosition}º
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* PREVIEW */}
                      {(selectedA || selectedB) && (
                        <div className="mt-2 flex items-center justify-center gap-3 rounded-lg bg-muted/30 px-3 py-3">
                          {selectedA ? (
                            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                              <span className="truncate text-sm font-medium">
                                {selectedA.name}
                              </span>

                              <TeamLogo
                                name={selectedA.name}
                                logoUrl={
                                  selectedA.logo_url
                                }
                                className="h-7 w-7"
                              />
                            </div>
                          ) : (
                            <span className="flex-1 text-right text-xs text-muted-foreground">
                              Exento
                            </span>
                          )}

                          <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
                            VS
                          </span>

                          {selectedB ? (
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <TeamLogo
                                name={selectedB.name}
                                logoUrl={
                                  selectedB.logo_url
                                }
                                className="h-7 w-7"
                              />

                              <span className="truncate text-sm font-medium">
                                {selectedB.name}
                              </span>
                            </div>
                          ) : (
                            <span className="flex-1 text-xs text-muted-foreground">
                              Exento
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* CONFIRMAR */}
            <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  ¿Todo preparado?
                </p>

                <p className="text-xs text-muted-foreground">
                  Revisa los enfrentamientos antes de
                  confirmar el cuadro.
                </p>
              </div>

              <Button
                size="lg"
                className="gap-2 sm:min-w-48"
                disabled={
                  loading ||
                  selectedIds.length !== teams.length ||
                  assignments.some(
                    (item) =>
                      !item.teamAId &&
                      !item.teamBId
                  )
                }
                onClick={() =>
                  void request(
                    `/api/tournaments/${tournamentId}/bracket`,
                    "PATCH",
                    { assignments }
                  )
                }
              >
                <CheckCircle2 className="h-4 w-4" />

                {loading
                  ? "Confirmando..."
                  : "Confirmar cruces"}
              </Button>
            </div>
          </div>
        )}

      {/* ======================================================= */}
      {/* BRACKET */}
      {/* ======================================================= */}

      {mode === "bracket" &&
        groupedNodes.length > 0 &&
        config?.status === "locked" && (
          <div className="space-y-6">

            {/* CONTROLES */}
            {canManage && (
              <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Gestión del cuadro
                  </p>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Los cruces solo pueden modificarse mientras
                    todos sus partidos estén 0-0.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="gap-2"
                        disabled={!canReset || loading}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Editar cruces
                      </Button>
                    </AlertDialogTrigger>

                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          ¿Editar los cruces?
                        </AlertDialogTitle>

                        <AlertDialogDescription>
                          Se borrarán los partidos eliminatorios
                          0-0 y sus eventos. Los equipos
                          clasificados se conservarán para que
                          puedas configurar nuevos
                          enfrentamientos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>

                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          Cancelar
                        </AlertDialogCancel>

                        <AlertDialogAction
                          onClick={() =>
                            void resetBracket("edit")
                          }
                        >
                          Editar cruces
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="gap-2"
                        disabled={!canReset || loading}
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </Button>
                    </AlertDialogTrigger>

                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          ¿Eliminar toda la fase eliminatoria?
                        </AlertDialogTitle>

                        <AlertDialogDescription>
                          Se eliminarán cruces, partidos 0-0,
                          eventos, fases y equipos clasificados.
                          Después podrás generar las eliminatorias
                          desde cero.
                        </AlertDialogDescription>
                      </AlertDialogHeader>

                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          Cancelar
                        </AlertDialogCancel>

                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() =>
                            void resetBracket("all")
                          }
                        >
                          Eliminar todo
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}

            {/* RONDAS */}
            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-max gap-6 lg:grid-flow-col lg:auto-cols-[300px]">
                {groupedNodes.map((round) => (
                  <div
                    key={round[0].phaseId}
                    className="w-[300px] space-y-3"
                  >
                    <div className="flex items-center gap-2 border-b pb-3">
                      <Trophy className="h-4 w-4 text-primary" />

                      <h3 className="text-sm font-semibold uppercase tracking-wide">
                        {round[0].phaseName}
                      </h3>

                      <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {round.length}{" "}
                        {round.length === 1
                          ? "partido"
                          : "partidos"}
                      </span>
                    </div>

                    {round
                      .sort(
                        (a, b) =>
                          a.position - b.position
                      )
                      .map((node, index) => (
                        <div
                          key={node.id}
                          className="overflow-hidden rounded-xl border bg-card"
                        >
                          <div className="border-b bg-muted/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Partido {index + 1}
                          </div>

                          <div className="p-3">
                            <div
                              className={
                                node.winnerTeamId ===
                                node.teamAId
                                  ? "rounded-lg bg-primary/10 p-2 font-semibold text-primary"
                                  : "p-2"
                              }
                            >
                              {renderTeam(node.teamAId)}
                            </div>

                            <div className="my-1 flex items-center gap-2">
                              <div className="h-px flex-1 bg-border" />

                              <span className="text-[9px] font-bold text-muted-foreground">
                                VS
                              </span>

                              <div className="h-px flex-1 bg-border" />
                            </div>

                            <div
                              className={
                                node.winnerTeamId ===
                                node.teamBId
                                  ? "rounded-lg bg-primary/10 p-2 font-semibold text-primary"
                                  : "p-2"
                              }
                            >
                              {renderTeam(node.teamBId)}
                            </div>

                            {node.status === "bye" && (
                              <div className="mt-2 rounded-md bg-muted px-2 py-1.5 text-center text-[11px] text-muted-foreground">
                                Pasa directamente a la
                                siguiente ronda
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      {/* ======================================================= */}
      {/* ESTADOS */}
      {/* ======================================================= */}

      {mode === "configuration" &&
        config?.status === "locked" && (
          <div className="flex flex-col gap-4 rounded-xl border border-green-500/20 bg-green-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />

            <div>
              <p className="text-sm font-medium">
                Eliminatorias configuradas · {config.qualifiersPerGroup} clasificados por grupo
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Los clasificados y cruces ya están confirmados.
                Puedes consultar el árbol en la pestaña
                Eliminatorias.
              </p>
            </div>
            </div>
            {canManage && <div className="flex flex-wrap gap-2"><AlertDialog><AlertDialogTrigger asChild><Button variant="outline" disabled={!canReset || loading}>Editar cruces o clasificados</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Reconfigurar las eliminatorias?</AlertDialogTitle><AlertDialogDescription>Se eliminará el cuadro completo, incluidos partidos eliminatorios 0-0, eventos, fases y clasificados. Los grupos y sus resultados se conservarán.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void resetBracket("all")}>Continuar y reconfigurar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" disabled={!canReset || loading}>Eliminar eliminatorias completas</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar todas las eliminatorias?</AlertDialogTitle><AlertDialogDescription>Se eliminarán todas las rondas, cruces, partidos eliminatorios 0-0, eventos y equipos clasificados. Ninguna fase de grupos ni sus resultados se modificará.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void resetBracket("all")}>Eliminar eliminatorias completas</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>}
          </div>
        )}

      {mode === "bracket" &&
        config?.status !== "locked" && (
          <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

            <p className="text-sm text-muted-foreground">
              Las eliminatorias todavía no se han confirmado.
              Configura los clasificados desde la pestaña Fase de
              grupos.
            </p>
          </div>
        )}

      {mode === "configuration" &&
        !canManage &&
        !config && (
          <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
            El cuadro eliminatorio todavía no se ha configurado.
          </div>
        )}

      {error && (
        <div
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </CardContent>
  </Card>
)
}
