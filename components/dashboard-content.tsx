"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Users,
  Calendar,
  Trash2,
  Sun,
  Moon,
  ShieldCheck,
  ChevronDown,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Tournament {
  id: string
  name: string
  type: string
  status: string
  created_at: string
  tournament_teams: Array<{ count: number }>
}

interface Profile {
  id: string
  email: string
  role: string
}

type TournamentStatus = "draft" | "active" | "finished"

export function DashboardContent({
  tournaments,
  profile,
  isAdmin,
}: {
  tournaments: Tournament[]
  profile: Profile | null
  isAdmin: boolean
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [localTournaments, setLocalTournaments] = useState<Tournament[]>(tournaments)
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null)
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setLocalTournaments(tournaments)
  }, [tournaments])

  const getNextStatus = (status: string): TournamentStatus => {
    if (status === "draft") return "active"
    if (status === "active") return "finished"
    return "draft"
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active"
      case "finished":
        return "Finished"
      default:
        return "Draft"
    }
  }

  const getTypeLabel = (type: string) => {
    return type === "league" ? "League" : "Group tournament"
  }

  const getStatusClasses = (status: string) => {
    switch (status) {
      case "active":
        return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      case "finished":
        return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
      default:
        return "border-primary/20 bg-primary/10 text-primary"
    }
  }

  const getTopBarClasses = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-500"
      case "finished":
        return "bg-red-500"
      default:
        return "bg-primary"
    }
  }

  const handleStatusChange = async (tournamentId: string) => {
    const currentTournament = localTournaments.find((t) => t.id === tournamentId)
    if (!currentTournament) return

    const nextStatus = getNextStatus(currentTournament.status)

    setStatusLoadingId(tournamentId)

    const previousTournaments = localTournaments
    setLocalTournaments((prev) =>
      prev.map((t) => (t.id === tournamentId ? { ...t, status: nextStatus } : t))
    )

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || "Failed to update tournament status")
      }
    } catch (error) {
      console.error("Error updating tournament status:", error)
      setLocalTournaments(previousTournaments)
      alert(error instanceof Error ? error.message : "Error updating tournament status")
    } finally {
      setStatusLoadingId(null)
    }
  }

  const handleDeleteTournament = async (tournamentId: string, tournamentName: string) => {
    if (!confirm(`Are you sure you want to delete "${tournamentName}"?`)) {
      return
    }

    setDeleteLoadingId(tournamentId)

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        alert(`Error: ${data?.error || "Failed to delete tournament"}`)
        return
      }

      setLocalTournaments((prev) => prev.filter((t) => t.id !== tournamentId))
    } catch (error) {
      console.error("Error deleting tournament:", error)
      alert("Error deleting tournament")
    } finally {
      setDeleteLoadingId(null)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.05] dark:opacity-[0.12]"
          style={{
            backgroundImage: "url('/images/2.png')",
            backgroundAttachment: "fixed",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-muted/40" />
        <div className="absolute left-1/2 top-0 h-[440px] w-[440px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[260px] w-[260px] rounded-full bg-foreground/5 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-[220px] w-[220px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-2xl">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex min-h-20 items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-15 items-center justify-center rounded-2xl">
                  <Image
                    src="/images/bwmf-logo.png"
                    alt="Waterpolo Pro"
                    width={74}
                    height={74}
                    className="object-contain dark:brightness-0 dark:invert"
                    priority
                  />
                </div>

                <div>
                  <h1 className="text-xl">Tournament management system</h1>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {mounted && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                    className="h-10 w-10 rounded-xl border-border/60 bg-background/70 backdrop-blur-sm"
                    aria-label="Toggle theme"
                  >
                    {resolvedTheme === "dark" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-10 rounded-xl border-border/60 bg-background/70 px-3 backdrop-blur-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className="hidden text-right sm:block">
                          <p className="max-w-[220px] truncate text-sm">{profile?.email}</p>
                        </div>
                        {isAdmin && (
                          <Badge className="hidden border-primary/20 bg-primary/10 text-primary hover:bg-primary/10 sm:inline-flex">
                            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                            Admin
                          </Badge>
                        )}
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-64 rounded-xl">
                    <div className="border-b border-border px-3 py-3">
                      <p className="truncate text-sm font-medium">{profile?.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isAdmin ? "Administrator" : "Standard user"}
                      </p>
                    </div>

                    <DropdownMenuItem asChild className="cursor-pointer">
                      <form action="/auth/sign-out" method="post" className="w-full">
                        <button type="submit" className="w-full text-left">
                          Log out
                        </button>
                      </form>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <section className="mb-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-border/60 bg-background/70 px-4 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur-md">
                Main dashboard
              </div>

              <div>
                <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">My tournaments</h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Manage competitions, teams, and results from a cleaner, more polished interface.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              {isAdmin && (
                <Link href="/tournaments/create">
                  <Button
                    size="lg"
                    className="h-12 rounded-xl px-6 shadow-lg shadow-primary/15 transition-all hover:scale-[1.01]"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Create tournament
                  </Button>
                </Link>
              )}
            </div>
          </section>

          {localTournaments.length === 0 ? (
            <Card className="overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-xl backdrop-blur-xl">
              <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-border/60 bg-muted/50">
                  <Image
                    src="/images/bwmf-logo.png"
                    alt="Waterpolo Pro"
                    width={52}
                    height={52}
                    className="object-contain dark:brightness-0 dark:invert"
                  />
                </div>

                <h3 className="text-2xl font-semibold tracking-tight">No tournaments yet</h3>
                <p className="mt-3 max-w-md text-muted-foreground">
                  {isAdmin
                    ? "Create your first tournament to start managing matches, teams, and statistics."
                    : "There are no tournaments available right now. Please contact an administrator."}
                </p>

                {isAdmin && (
                  <Link href="/tournaments/create" className="mt-8">
                    <Button size="lg" className="h-12 rounded-xl px-6">
                      <Plus className="mr-2 h-5 w-5" />
                      Create first tournament
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {localTournaments.map((tournament) => (
                <div key={tournament.id} className="group relative">
                  <Link href={`/tournaments/${tournament.id}`} className="block h-full">
                    <Card className="h-full overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                      <div className={`h-1.5 w-full ${getTopBarClasses(tournament.status)}`} />

                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="truncate text-xl font-semibold tracking-tight">
                              {tournament.name}
                            </CardTitle>
                            <CardDescription className="mt-2 text-sm">
                              {getTypeLabel(tournament.type)}
                            </CardDescription>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (!isAdmin || statusLoadingId === tournament.id) return
                              handleStatusChange(tournament.id)
                            }}
                            disabled={!isAdmin || statusLoadingId === tournament.id}
                            className="rounded-full"
                            title={isAdmin ? "Click to change status" : "Status"}
                          >
                            <Badge
                              className={`${getStatusClasses(tournament.status)} cursor-pointer transition-opacity hover:opacity-80`}
                            >
                              {statusLoadingId === tournament.id
                                ? "Updating..."
                                : getStatusLabel(tournament.status)}
                            </Badge>
                          </button>
                        </div>
                      </CardHeader>

                      <CardContent className="pt-0">
                        <div className="grid gap-3">
                          <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/50 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                                <Users className="h-4 w-4 text-primary" />
                              </div>
                              <span className="text-sm text-muted-foreground">Teams</span>
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {tournament.tournament_teams[0]?.count || 0}
                            </span>
                          </div>

                          <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/50 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                                <Calendar className="h-4 w-4 text-primary" />
                              </div>
                              <span className="text-sm text-muted-foreground">Created</span>
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {new Date(tournament.created_at).toLocaleDateString("en-GB")}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  {isAdmin && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDeleteTournament(tournament.id, tournament.name)
                      }}
                      disabled={deleteLoadingId === tournament.id}
                      className="absolute right-4 top-4 h-9 w-9 rounded-xl border-border/60 bg-background/80 opacity-0 backdrop-blur-sm transition-all group-hover:opacity-100 hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive disabled:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}