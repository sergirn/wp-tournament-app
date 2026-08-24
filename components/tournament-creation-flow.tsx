"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, ArrowRight, Shuffle, Search, CheckCircle2 } from "lucide-react"

type Step = "basic" | "teams" | "groups" | "complete"

interface Team {
  id: string
  name: string
  logo_url?: string
}

export function TournamentCreationFlow({ teams }: { teams: Team[] }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>("basic")
  const [loading, setLoading] = useState(false)

  const [tournamentName, setTournamentName] = useState("")
  const [tournamentType, setTournamentType] = useState<"league" | "groups">("groups")

  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [searchTeam, setSearchTeam] = useState("")

  const [numGroups, setNumGroups] = useState(2)
  const [groups, setGroups] = useState<Record<string, string[]>>({})

  const stepOrder: Step[] = ["basic", "teams", "groups"]
  const currentStepIndex = stepOrder.indexOf(step)

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => team.name.toLowerCase().includes(searchTeam.toLowerCase()))
  }, [teams, searchTeam])

  const selectedTeamObjects = useMemo(() => {
    return teams.filter((team) => selectedTeams.includes(team.id))
  }, [teams, selectedTeams])

  const groupNames = useMemo(() => {
    return Array.from({ length: numGroups }, (_, i) => `Grupo ${String.fromCharCode(65 + i)}`)
  }, [numGroups])

  const assignedTeamIds = useMemo(() => {
    return Object.values(groups).flat()
  }, [groups])

  const unassignedTeams = useMemo(() => {
    return selectedTeamObjects.filter((team) => !assignedTeamIds.includes(team.id))
  }, [selectedTeamObjects, assignedTeamIds])

  const basicStepValid = tournamentName.trim().length > 0
  const teamsStepValid = selectedTeams.length >= 2

  const groupsStepValid =
    tournamentType === "league"
      ? true
      : selectedTeams.length > 0 &&
        assignedTeamIds.length === selectedTeams.length &&
        new Set(assignedTeamIds).size === assignedTeamIds.length &&
        groupNames.every((groupName) => (groups[groupName] || []).length > 0)

  const getStepLabel = (value: Step) => {
    switch (value) {
      case "basic":
        return "Paso 1: Información básica"
      case "teams":
        return "Paso 2: Seleccionar equipos"
      case "groups":
        return "Paso 3: Organizar grupos"
      case "complete":
        return "Completado"
    }
  }

  const toggleTeam = (teamId: string) => {
    setSelectedTeams((prev) => {
      if (prev.includes(teamId)) {
        const next = prev.filter((id) => id !== teamId)

        setGroups((currentGroups) => {
          const updated: Record<string, string[]> = {}
          for (const [groupName, teamIds] of Object.entries(currentGroups)) {
            updated[groupName] = teamIds.filter((id) => id !== teamId)
          }
          return updated
        })

        return next
      }

      return [...prev, teamId]
    })
  }

  const distributeTeamsRandomly = () => {
    const shuffled = [...selectedTeams].sort(() => Math.random() - 0.5)
    const newGroups: Record<string, string[]> = {}

    groupNames.forEach((groupName) => {
      newGroups[groupName] = []
    })

    shuffled.forEach((teamId, index) => {
      const groupIndex = index % numGroups
      const groupName = groupNames[groupIndex]
      newGroups[groupName].push(teamId)
    })

    setGroups(newGroups)
  }

  const resetGroups = () => {
    const cleared: Record<string, string[]> = {}
    groupNames.forEach((groupName) => {
      cleared[groupName] = []
    })
    setGroups(cleared)
  }

  const assignTeamToGroup = (teamId: string, targetGroup: string) => {
    setGroups((prev) => {
      const updated: Record<string, string[]> = {}

      for (const name of groupNames) {
        updated[name] = (prev[name] || []).filter((id) => id !== teamId)
      }

      updated[targetGroup] = [...(updated[targetGroup] || []), teamId]
      return updated
    })
  }

  const removeTeamFromGroup = (groupName: string, teamId: string) => {
    setGroups((prev) => ({
      ...prev,
      [groupName]: (prev[groupName] || []).filter((id) => id !== teamId),
    }))
  }

  const handleCreateTournament = async () => {
    if (!basicStepValid || !teamsStepValid || !groupsStepValid) return

    setLoading(true)
    try {
      const groupPayload = tournamentType === "groups"
        ? groupNames.map((name, index) => ({ name, orderNumber: index + 1, teamIds: groups[name] || [] }))
        : []
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tournamentName, type: tournamentType, teamIds: selectedTeams, groups: groupPayload }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo crear el torneo")

      setStep("complete")

      setTimeout(() => {
        router.push(`/tournaments/${result.tournamentId}`)
      }, 1600)
    } catch (error: unknown) {
      console.error(error)
      alert(error instanceof Error ? error.message : "Error creating tournament")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.035] via-background to-background" />
      <div className="absolute left-1/2 top-0 h-72 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8 space-y-5">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="rounded-xl text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-border/60 bg-background/70 px-4 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur-md">
                Creación de torneo
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-background/70 shadow-lg backdrop-blur-sm">
                  <Image
                    src="/images/bwmf-logo.png"
                    alt="Waterpolo Pro"
                    width={36}
                    height={36}
                    className="object-contain dark:brightness-0 dark:invert"
                    priority
                  />
                </div>

                <div>
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Crear torneo</h1>
                  <p className="mt-1 text-sm text-muted-foreground sm:text-base">{getStepLabel(step)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-medium">Progreso</span>
                <span className="text-muted-foreground">
                  {step === "complete" ? "100%" : `${Math.round(((currentStepIndex + 1) / 3) * 100)}%`}
                </span>
              </div>

              <div className="flex gap-2">
                {stepOrder.map((s, i) => {
                  const isActive = s === step
                  const isCompleted = currentStepIndex > i || step === "complete"

                  return (
                    <div
                      key={s}
                      className={`h-2 flex-1 rounded-full transition-all ${
                        isActive ? "bg-primary" : isCompleted ? "bg-primary/50" : "bg-muted"
                      }`}
                    />
                  )
                })}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <span>Información</span>
                <span className="text-center">Equipos</span>
                <span className="text-right">Grupos</span>
              </div>
            </div>
          </div>
        </div>

        {step === "basic" && (
          <Card className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl tracking-tight">Datos del torneo</CardTitle>
              <CardDescription>Elige el nombre y el formato de la competición.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-8">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del torneo</Label>
                <Input
                  id="name"
                  placeholder="Ejemplo: Liga Nacional 2026"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  className="h-12 rounded-xl border-border bg-background/70"
                />
              </div>

              <div className="space-y-3">
                <Label>Tipo de torneo</Label>

                <RadioGroup
                  value={tournamentType}
                  onValueChange={(value) => setTournamentType(value as "league" | "groups")}
                  className="grid gap-4 md:grid-cols-2"
                >
                  <label
                    htmlFor="league"
                    className={`cursor-pointer rounded-2xl border p-5 transition-all ${
                      tournamentType === "league"
                        ? "border-primary/30 bg-primary/5 shadow-sm"
                        : "border-border/60 bg-background/40 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="league" id="league" className="mt-1" />
                      <div className="space-y-1">
                        <div className="font-semibold">Liga</div>
                        <p className="text-sm text-muted-foreground">
                          Todos los equipos se enfrentan entre sí.
                        </p>
                      </div>
                    </div>
                  </label>

                  <label
                    htmlFor="groups"
                    className={`cursor-pointer rounded-2xl border p-5 transition-all ${
                      tournamentType === "groups"
                        ? "border-primary/30 bg-primary/5 shadow-sm"
                        : "border-border/60 bg-background/40 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="groups" id="groups" className="mt-1" />
                      <div className="space-y-1">
                        <div className="font-semibold">Fase de grupos</div>
                        <p className="text-sm text-muted-foreground">
                          Los equipos se distribuyen en grupos antes de la siguiente fase.
                        </p>
                      </div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              <div className="flex justify-end">
                <Button
                  className="h-12 rounded-xl px-6"
                  onClick={() => setStep("teams")}
                  disabled={!basicStepValid}
                >
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "teams" && (
          <Card className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl tracking-tight">Seleccionar equipos participantes</CardTitle>
              <CardDescription>
                {selectedTeams.length} seleccionados de {teams.length} equipos disponibles.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar equipos..."
                  value={searchTeam}
                  onChange={(e) => setSearchTeam(e.target.value)}
                  className="h-12 rounded-xl border-border bg-background/70 pl-10"
                />
              </div>

              <div className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {filteredTeams.length === 0 ? (
                  <div className="col-span-2 rounded-2xl border border-dashed border-border/60 py-10 text-center text-muted-foreground">
                    No se encontraron equipos
                  </div>
                ) : (
                  filteredTeams.map((team) => {
                    const checked = selectedTeams.includes(team.id)

                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => toggleTeam(team.id)}
                        className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                          checked
                            ? "border-primary/30 bg-primary/5 shadow-sm"
                            : "border-border/60 bg-background/50 hover:bg-muted/40"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleTeam(team.id)}
                          className="pointer-events-none"
                        />

                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {team.logo_url ? (
                            <img
                              src={team.logo_url || "/placeholder.svg"}
                              alt={team.name}
                              className="h-11 w-11 rounded-full border border-border/60 object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {team.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}

                          <span className="truncate font-medium">{team.name}</span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => setStep("basic")}
                  className="h-12 flex-1 rounded-xl"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
                </Button>

                <Button
                  className="h-12 flex-1 rounded-xl"
                  onClick={() => {
                    if (tournamentType === "groups") {
                      resetGroups()
                      setStep("groups")
                    } else {
                      handleCreateTournament()
                    }
                  }}
                  disabled={!teamsStepValid || loading}
                >
                  {tournamentType === "groups" ? "Continuar a grupos" : loading ? "Creando..." : "Crear torneo"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "groups" && tournamentType === "groups" && (
          <Card className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <CardHeader className="border-b border-border/60 pb-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle className="text-2xl tracking-tight">Organizar grupos</CardTitle>
                  <CardDescription className="mt-2 text-sm sm:text-base">
                    Configura los grupos y distribuye los equipos.
                  </CardDescription>
                </div>

                <div className="inline-flex items-center rounded-full border border-border/60 bg-background/70 px-4 py-2 text-sm text-muted-foreground">
                  {assignedTeamIds.length} / {selectedTeams.length} equipos asignados
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-8 p-6 sm:p-8">
              <div className="grid gap-5 xl:grid-cols-1">
                <div className="rounded-2xl border border-border/60 bg-background/60 p-6 shadow-sm">
                  <div className="mb-5">
                    <h3 className="text-lg font-semibold tracking-tight">Configuración de grupos</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Define el número de grupos y cómo se repartirán los equipos.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-end">
                    <div className="space-y-2">
                      <Label htmlFor="num-groups">Número de grupos</Label>
                      <Input
                        id="num-groups"
                        type="number"
                        min={2}
                        max={8}
                        value={numGroups}
                        onChange={(e) => {
                          const value = Math.max(2, Math.min(8, Number.parseInt(e.target.value) || 2))
                          setNumGroups(value)
                          setGroups({})
                        }}
                        className="h-11 rounded-xl border-border bg-background"
                      />
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <Button variant="outline" onClick={resetGroups} className="h-11 rounded-xl">
                        Restablecer grupos
                      </Button>

                      <Button onClick={distributeTeamsRandomly} className="h-11 rounded-xl">
                        <Shuffle className="mr-2 h-4 w-4" />
                        Distribución aleatoria
                      </Button>
                    </div>
                  </div>
                </div>

                
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Grupos</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Revisa el reparto final. Puedes mover equipos manualmente entre grupos.
                  </p>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  {groupNames.map((groupName) => {
                    const groupTeams = groups[groupName] || []

                    return (
                      <div
                        key={groupName}
                        className="rounded-2xl border border-border/60 bg-background/60 p-5 shadow-sm"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          const teamId = e.dataTransfer.getData("teamId")
                          if (teamId) assignTeamToGroup(teamId, groupName)
                        }}
                      >
                        <div className="mb-5 flex items-center justify-between border-b border-border/60 pb-4">
                          <div>
                            <h4 className="text-lg font-semibold tracking-tight">{groupName}</h4>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {groupTeams.length} {groupTeams.length === 1 ? "equipo" : "equipos"}
                            </p>
                          </div>

                          <div className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                            Grupo
                          </div>
                        </div>

                        <div className="space-y-3">
                          {groupTeams.length > 0 ? (
                            groupTeams
                              .map((teamId) => teams.find((team) => team.id === teamId))
                              .filter(Boolean)
                              .map((team) => (
                                <div
                                  key={team!.id}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData("teamId", team!.id)
                                  }}
                                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 transition-all hover:bg-muted/30"
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    {team!.logo_url ? (
                                      <img
                                        src={team!.logo_url || "/placeholder.svg"}
                                        alt={team!.name}
                                        className="h-10 w-10 rounded-full border border-border/60 object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                        {team!.name.substring(0, 2).toUpperCase()}
                                      </div>
                                    )}

                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">{team!.name}</p>
                                      <p className="text-xs text-muted-foreground">Arrastra para mover</p>
                                    </div>
                                  </div>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeTeamFromGroup(groupName, team!.id)}
                                    className="h-8 rounded-lg px-2 text-muted-foreground hover:text-foreground"
                                  >
                                    Quitar
                                  </Button>
                                </div>
                              ))
                          ) : (
                            <div className="rounded-xl border border-dashed border-border/70 bg-background/50 px-4 py-10 text-center text-sm text-muted-foreground">
                              Este grupo está vacío
                            </div>
                          )}

                          <div className="flex min-h-[56px] items-center justify-center rounded-xl border-2 border-dashed border-border/70 bg-background/40 text-sm text-muted-foreground">
                            Suelta los equipos aquí
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => setStep("teams")}
                  className="h-12 flex-1 rounded-xl"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
                </Button>

                <Button
                  className="h-12 flex-1 rounded-xl"
                  onClick={handleCreateTournament}
                  disabled={loading || !groupsStepValid}
                >
                  {loading ? "Creando torneo..." : "Crear torneo"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "complete" && (
          <Card className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <CardContent className="py-20 text-center">
              <div className="mb-6 flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
              </div>

              <h2 className="text-2xl font-semibold tracking-tight">Torneo creado correctamente</h2>
              <p className="mt-3 text-muted-foreground">Abriendo el panel del torneo...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
