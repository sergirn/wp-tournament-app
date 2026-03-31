"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Trophy, ArrowLeft, ArrowRight, Shuffle, Search, GripVertical } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

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

  // Paso 1: Información básica
  const [tournamentName, setTournamentName] = useState("")
  const [tournamentType, setTournamentType] = useState<"league" | "groups">("groups")

  // Paso 2: Selección de equipos
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [searchTeam, setSearchTeam] = useState("")

  // Paso 3: Configuración de grupos
  const [numGroups, setNumGroups] = useState(2)
  const [groups, setGroups] = useState<{ [key: string]: string[] }>({})

  const [draggedTeam, setDraggedTeam] = useState<{ teamId: string; sourceGroup: string } | null>(null)

  const handleCreateTournament = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // Crear torneo
      const { data: tournament, error: tournamentError } = await supabase
        .from("tournaments")
        .insert({
          name: tournamentName,
          type: tournamentType,
          status: "active",
        })
        .select()
        .single()

      if (tournamentError) throw tournamentError

      // Añadir equipos al torneo
      const tournamentTeamsData = selectedTeams.map((teamId) => ({
        tournament_id: tournament.id,
        team_id: teamId,
      }))

      const { error: teamsError } = await supabase.from("tournament_teams").insert(tournamentTeamsData)

      if (teamsError) throw teamsError

      // Si es torneo por grupos, crear grupos
      if (tournamentType === "groups") {
        const groupEntries = Object.entries(groups)
        for (let i = 0; i < groupEntries.length; i++) {
          const [groupName, teamIds] = groupEntries[i]
          const { data: group, error: groupError } = await supabase
            .from("groups")
            .insert({
              tournament_id: tournament.id,
              name: groupName,
              order_number: i + 1, // Usar el índice + 1 como order_number (1, 2, 3, etc.)
            })
            .select()
            .single()

          if (groupError) throw groupError

          const groupMembersData = teamIds.map((teamId) => ({
            group_id: group.id,
            team_id: teamId,
          }))

          const { error: membersError } = await supabase.from("group_members").insert(groupMembersData)

          if (membersError) throw membersError
        }
      }

      setStep("complete")
      setTimeout(() => {
        router.push(`/tournaments/${tournament.id}`)
      }, 2000)
    } catch (error) {
      console.error("Error creating tournament:", error)
      alert("Error al crear el torneo")
    } finally {
      setLoading(false)
    }
  }

  const distributeTeamsRandomly = () => {
    const shuffled = [...selectedTeams].sort(() => Math.random() - 0.5)
    const newGroups: { [key: string]: string[] } = {}

    for (let i = 0; i < numGroups; i++) {
      newGroups[`Grupo ${String.fromCharCode(65 + i)}`] = []
    }

    shuffled.forEach((teamId, index) => {
      const groupIndex = index % numGroups
      const groupName = `Grupo ${String.fromCharCode(65 + groupIndex)}`
      newGroups[groupName].push(teamId)
    })

    setGroups(newGroups)
  }

  const handleTouchStart = (teamId: string, sourceGroup: string) => {
    setDraggedTeam({ teamId, sourceGroup })
  }

  const handleTouchEnd = () => {
    setDraggedTeam(null)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
  }

  const handleTouchDrop = (targetGroup: string) => {
    if (draggedTeam && draggedTeam.sourceGroup !== targetGroup) {
      setGroups((prev) => ({
        ...prev,
        [draggedTeam.sourceGroup]: prev[draggedTeam.sourceGroup].filter((id) => id !== draggedTeam.teamId),
        [targetGroup]: [...(prev[targetGroup] || []), draggedTeam.teamId],
      }))
    }
    setDraggedTeam(null)
  }

  const filteredTeams = teams.filter((team) => team.name.toLowerCase().includes(searchTeam.toLowerCase()))

  return (
    <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-5xl">
      <div className="mb-6 md:mb-8">
        <Button variant="ghost" onClick={() => router.push("/")} className="mb-4 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 shrink-0">
            <Trophy className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Crear Nuevo Torneo</h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 truncate">
              {step === "basic" && "Paso 1: Información básica"}
              {step === "teams" && "Paso 2: Seleccionar equipos"}
              {step === "groups" && "Paso 3: Organizar grupos"}
              {step === "complete" && "Completado"}
            </p>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="flex gap-2">
          {["basic", "teams", "groups"].map((s, i) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-all ${
                s === step
                  ? "bg-blue-600"
                  : ["basic", "teams", "groups"].indexOf(step) > i
                    ? "bg-blue-400"
                    : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Paso 1: Información básica */}
      {step === "basic" && (
        <Card className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">Información del Torneo</CardTitle>
            <CardDescription className="text-sm">Define el nombre y tipo de torneo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm md:text-base">
                Nombre del Torneo
              </Label>
              <Input
                id="name"
                placeholder="Ej: Liga Nacional 2025"
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
                className="h-11 md:h-12 text-base"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm md:text-base">Tipo de Torneo</Label>
              <RadioGroup value={tournamentType} onValueChange={(v) => setTournamentType(v as any)}>
                <div className="flex items-center space-x-2 p-3 md:p-4 border rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors touch-manipulation">
                  <RadioGroupItem value="league" id="league" />
                  <Label htmlFor="league" className="flex-1 cursor-pointer">
                    <div className="font-semibold text-sm md:text-base">Liga (Todos contra todos)</div>
                    <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                      Cada equipo juega contra todos los demás
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 md:p-4 border rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors touch-manipulation">
                  <RadioGroupItem value="groups" id="groups" />
                  <Label htmlFor="groups" className="flex-1 cursor-pointer">
                    <div className="font-semibold text-sm md:text-base">Torneo por Grupos</div>
                    <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                      Fase de grupos seguida de eliminatorias
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              className="w-full gradient-sport h-11 md:h-12 text-base touch-manipulation"
              onClick={() => setStep("teams")}
              disabled={!tournamentName}
            >
              Siguiente: Seleccionar Equipos
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Paso 2: Selección de equipos */}
      {step === "teams" && (
        <Card className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">Seleccionar Equipos Participantes</CardTitle>
            <CardDescription className="text-sm">
              {selectedTeams.length} de {teams.length} equipos seleccionados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Buscar equipos..."
                value={searchTeam}
                onChange={(e) => setSearchTeam(e.target.value)}
                className="pl-10 h-11 md:h-12 bg-muted/50 border-primary/20 focus:border-primary/50 text-base"
              />
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 max-h-[50vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary/40 scrollbar-track-transparent">
              {filteredTeams.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground text-sm">
                  No se encontraron equipos
                </div>
              ) : (
                filteredTeams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center space-x-3 p-3 md:p-4 border border-primary/20 rounded-lg hover:bg-primary/5 active:bg-primary/10 cursor-pointer transition-all touch-manipulation"
                    onClick={() => {
                      setSelectedTeams((prev) =>
                        prev.includes(team.id) ? prev.filter((id) => id !== team.id) : [...prev, team.id],
                      )
                    }}
                  >
                    <Checkbox
                      checked={selectedTeams.includes(team.id)}
                      onCheckedChange={(checked) => {
                        setSelectedTeams((prev) => (checked ? [...prev, team.id] : prev.filter((id) => id !== team.id)))
                      }}
                      className="shrink-0"
                    />
                    <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                      {team.logo_url ? (
                        <img
                          src={team.logo_url || "/placeholder.svg"}
                          alt={team.name}
                          className="h-8 w-8 md:h-10 md:w-10 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full gradient-sport text-white text-xs font-bold shrink-0">
                          {team.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="font-semibold text-sm md:text-base truncate">{team.name}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("basic")}
                className="flex-1 h-11 md:h-12 touch-manipulation"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Atrás
              </Button>
              <Button
                className="flex-1 h-11 md:h-12 touch-manipulation"
                onClick={() => {
                  if (tournamentType === "groups") {
                    setStep("groups")
                  } else {
                    handleCreateTournament()
                  }
                }}
                disabled={selectedTeams.length < 2}
              >
                {tournamentType === "groups" ? "Siguiente: Organizar Grupos" : "Crear Torneo"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 3: Configuración de grupos */}
      {step === "groups" && tournamentType === "groups" && (
        <Card className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">Organizar Grupos</CardTitle>
            <CardDescription className="text-sm">
              Distribuye los {selectedTeams.length} equipos en {numGroups} grupo(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 md:gap-4">
              <div className="flex-1">
                <Label htmlFor="num-groups" className="text-sm md:text-base">
                  Número de Grupos
                </Label>
                <Input
                  id="num-groups"
                  type="number"
                  min={2}
                  max={8}
                  value={numGroups.toString()}
                  onChange={(e) => {
                    const value = Number.parseInt(e.target.value) || 2
                    setNumGroups(value)
                    setGroups({})
                  }}
                  className="mt-2 h-11 md:h-12 text-base"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setGroups({})}
                className="bg-transparent h-11 md:h-12 text-sm touch-manipulation"
              >
                Organizar Manualmente
              </Button>
              <Button
                onClick={distributeTeamsRandomly}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 h-11 md:h-12 touch-manipulation"
              >
                <Shuffle className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Distribuir </span>Aleatoriamente
              </Button>
            </div>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {Array.from({ length: numGroups }, (_, i) => {
                const groupName = `Grupo ${String.fromCharCode(65 + i)}`
                const groupTeams = groups[groupName] || []

                return (
                  <div key={groupName} className="space-y-3 p-3 md:p-4 rounded-lg border border-primary/20 bg-muted/30">
                    <div className="pb-3 border-b border-primary/20">
                      <h3 className="text-base md:text-lg font-semibold">{groupName}</h3>
                      <p className="text-xs md:text-sm text-muted-foreground">{groupTeams.length} equipos</p>
                    </div>
                    <div className="space-y-2 min-h-40">
                      {teams
                        .filter((t) => groupTeams.includes(t.id))
                        .map((team) => (
                          <div
                            key={team.id}
                            className={`flex items-center justify-between gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20 hover:bg-primary/20 active:bg-primary/30 transition-all cursor-move touch-manipulation ${
                              draggedTeam?.teamId === team.id ? "opacity-50" : ""
                            }`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("teamId", team.id)
                              e.dataTransfer.setData("sourceGroup", groupName)
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault()
                              const teamId = e.dataTransfer.getData("teamId")
                              const sourceGroup = e.dataTransfer.getData("sourceGroup")

                              if (sourceGroup !== groupName) {
                                setGroups((prev) => ({
                                  ...prev,
                                  [sourceGroup]: prev[sourceGroup].filter((id) => id !== teamId),
                                  [groupName]: [...(prev[groupName] || []), teamId],
                                }))
                              }
                            }}
                            onTouchStart={() => handleTouchStart(team.id, groupName)}
                            onTouchEnd={handleTouchEnd}
                            onTouchMove={handleTouchMove}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                              {team.logo_url ? (
                                <img
                                  src={team.logo_url || "/placeholder.svg"}
                                  alt={team.name}
                                  className="h-7 w-7 md:h-8 md:w-8 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <div className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 text-white text-xs font-bold shrink-0">
                                  {team.name.substring(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="text-xs md:text-sm font-medium truncate">{team.name}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setGroups((prev) => ({
                                  ...prev,
                                  [groupName]: prev[groupName].filter((id) => id !== team.id),
                                }))
                              }}
                              className="h-8 w-8 p-0 shrink-0 hover:bg-destructive/10 hover:text-destructive touch-manipulation"
                            >
                              ✕
                            </Button>
                          </div>
                        ))}
                      <div
                        className="flex items-center justify-center min-h-16 border-2 border-dashed border-primary/30 rounded-lg text-muted-foreground text-xs md:text-sm transition-all hover:border-primary/50 hover:bg-primary/5 active:bg-primary/10 touch-manipulation"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          const teamId = e.dataTransfer.getData("teamId")
                          const sourceGroup = e.dataTransfer.getData("sourceGroup")

                          if (sourceGroup !== groupName) {
                            setGroups((prev) => ({
                              ...prev,
                              [sourceGroup]: prev[sourceGroup].filter((id) => id !== teamId),
                              [groupName]: [...(prev[groupName] || []), teamId],
                            }))
                          }
                        }}
                        onTouchEnd={() => handleTouchDrop(groupName)}
                      >
                        {draggedTeam ? "Suelta aquí" : "Arrastra aquí"}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("teams")}
                className="flex-1 h-11 md:h-12 touch-manipulation"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Atrás
              </Button>
              <Button
                className="flex-1 gradient-sport h-11 md:h-12 touch-manipulation"
                onClick={handleCreateTournament}
                disabled={loading || Object.values(groups).every((g) => g.length === 0)}
              >
                {loading ? "Creando..." : "Crear Torneo"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 4: Completado */}
      {step === "complete" && (
        <Card>
          <CardContent className="py-12 md:py-16 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <Trophy className="h-8 w-8 md:h-10 md:w-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h2 className="text-xl md:text-2xl font-bold mb-2">Torneo Creado Exitosamente</h2>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-6">
              Redirigiendo al panel del torneo...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
