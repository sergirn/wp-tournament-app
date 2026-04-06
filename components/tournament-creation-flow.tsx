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
    return Array.from({ length: numGroups }, (_, i) => `Group ${String.fromCharCode(65 + i)}`)
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
        return "Step 1: Basic information"
      case "teams":
        return "Step 2: Select teams"
      case "groups":
        return "Step 3: Organize groups"
      case "complete":
        return "Completed"
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
    const supabase = createClient()

    try {
      const { data: tournament, error: tournamentError } = await supabase
        .from("tournaments")
        .insert({
          name: tournamentName.trim(),
          type: tournamentType,
          status: "active",
        })
        .select()
        .single()

      if (tournamentError) throw tournamentError

      const tournamentTeamsData = selectedTeams.map((teamId) => ({
        tournament_id: tournament.id,
        team_id: teamId,
      }))

      const { error: teamsError } = await supabase.from("tournament_teams").insert(tournamentTeamsData)

      if (teamsError) throw teamsError

      if (tournamentType === "groups") {
        const validGroupEntries = groupNames
          .map((groupName) => [groupName, groups[groupName] || []] as const)
          .filter(([, teamIds]) => teamIds.length > 0)

        for (let i = 0; i < validGroupEntries.length; i++) {
          const [groupName, teamIds] = validGroupEntries[i]

          const { data: group, error: groupError } = await supabase
            .from("groups")
            .insert({
              tournament_id: tournament.id,
              name: groupName,
              order_number: i + 1,
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
      }, 1600)
    } catch (error: any) {
      console.error("Error creating tournament:")
      console.error(JSON.stringify(error, null, 2))
      console.error(error)
      alert(error?.message || "Error creating tournament")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.04] dark:opacity-[0.1]"
          style={{ backgroundImage: "url('/images/2.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-muted/40" />
        <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[260px] w-[260px] rounded-full bg-foreground/5 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-[220px] w-[220px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8 space-y-5">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="rounded-xl text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-border/60 bg-background/70 px-4 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur-md">
                Tournament creation
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
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Create tournament</h1>
                  <p className="mt-1 text-sm text-muted-foreground sm:text-base">{getStepLabel(step)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-medium">Progress</span>
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
                <span>Basic</span>
                <span className="text-center">Teams</span>
                <span className="text-right">Groups</span>
              </div>
            </div>
          </div>
        </div>

        {step === "basic" && (
          <Card className="overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-xl backdrop-blur-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl tracking-tight">Tournament details</CardTitle>
              <CardDescription>Choose the tournament name and the competition format.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-8">
              <div className="space-y-2">
                <Label htmlFor="name">Tournament name</Label>
                <Input
                  id="name"
                  placeholder="Example: National League 2026"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  className="h-12 rounded-xl border-border bg-background/70"
                />
              </div>

              <div className="space-y-3">
                <Label>Tournament type</Label>

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
                        <div className="font-semibold">League</div>
                        <p className="text-sm text-muted-foreground">
                          Every team plays against all the others.
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
                        <div className="font-semibold">Group stage</div>
                        <p className="text-sm text-muted-foreground">
                          Teams are divided into groups before the next phase.
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
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "teams" && (
          <Card className="overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-xl backdrop-blur-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl tracking-tight">Select participating teams</CardTitle>
              <CardDescription>
                {selectedTeams.length} selected out of {teams.length} available teams.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search teams..."
                  value={searchTeam}
                  onChange={(e) => setSearchTeam(e.target.value)}
                  className="h-12 rounded-xl border-border bg-background/70 pl-10"
                />
              </div>

              <div className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {filteredTeams.length === 0 ? (
                  <div className="col-span-2 rounded-2xl border border-dashed border-border/60 py-10 text-center text-muted-foreground">
                    No teams found
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
                  Back
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
                  {tournamentType === "groups" ? "Continue to groups" : loading ? "Creating..." : "Create tournament"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "groups" && tournamentType === "groups" && (
          <Card className="overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-xl backdrop-blur-2xl">
            <CardHeader className="border-b border-border/60 pb-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle className="text-2xl tracking-tight">Organize groups</CardTitle>
                  <CardDescription className="mt-2 text-sm sm:text-base">
                    Configure the groups first, then distribute teams below.
                  </CardDescription>
                </div>

                <div className="inline-flex items-center rounded-full border border-border/60 bg-background/70 px-4 py-2 text-sm text-muted-foreground">
                  {assignedTeamIds.length} / {selectedTeams.length} teams assigned
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-8 p-6 sm:p-8">
              <div className="grid gap-5 xl:grid-cols-1">
                <div className="rounded-2xl border border-border/60 bg-background/60 p-6 shadow-sm">
                  <div className="mb-5">
                    <h3 className="text-lg font-semibold tracking-tight">Group configuration</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Define the number of groups and choose how teams should be distributed.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-end">
                    <div className="space-y-2">
                      <Label htmlFor="num-groups">Number of groups</Label>
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
                        Reset groups
                      </Button>

                      <Button onClick={distributeTeamsRandomly} className="h-11 rounded-xl">
                        <Shuffle className="mr-2 h-4 w-4" />
                        Random distribution
                      </Button>
                    </div>
                  </div>
                </div>

                
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Groups</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Review the final distribution below. You can move teams between groups manually.
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
                              {groupTeams.length} {groupTeams.length === 1 ? "team" : "teams"}
                            </p>
                          </div>

                          <div className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                            Pool
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
                                      <p className="text-xs text-muted-foreground">Drag to move</p>
                                    </div>
                                  </div>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeTeamFromGroup(groupName, team!.id)}
                                    className="h-8 rounded-lg px-2 text-muted-foreground hover:text-foreground"
                                  >
                                    Remove
                                  </Button>
                                </div>
                              ))
                          ) : (
                            <div className="rounded-xl border border-dashed border-border/70 bg-background/50 px-4 py-10 text-center text-sm text-muted-foreground">
                              This group is empty
                            </div>
                          )}

                          <div className="flex min-h-[56px] items-center justify-center rounded-xl border-2 border-dashed border-border/70 bg-background/40 text-sm text-muted-foreground">
                            Drop teams here
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
                  Back
                </Button>

                <Button
                  className="h-12 flex-1 rounded-xl"
                  onClick={handleCreateTournament}
                  disabled={loading || !groupsStepValid}
                >
                  {loading ? "Creating tournament..." : "Create tournament"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "complete" && (
          <Card className="overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-xl backdrop-blur-2xl">
            <CardContent className="py-20 text-center">
              <div className="mb-6 flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
              </div>

              <h2 className="text-2xl font-semibold tracking-tight">Tournament created successfully</h2>
              <p className="mt-3 text-muted-foreground">Redirecting to the tournament dashboard...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}