"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Plus,
  Users,
  Calendar,
  Trash2,
  Sun,
  Moon,
  ShieldCheck,
  ChevronDown,
  Settings,
  Search,
  Activity,
  MessageSquareWarning,
  MoreHorizontal,
  Trophy,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Tournament {
  id: string
  name: string
  type: string
  status: string
  created_at: string
  tournament_teams: Array<{ count: number }>
  matches: Array<{ count: number }>
}

interface RecentActivity { id: string; tournament_id: string; team_a_score: number | null; team_b_score: number | null; updated_at: string; team_a: { name: string } | null; team_b: { name: string } | null; tournament: { name: string } | null }

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
  recentActivity,
  totals,
}: {
  tournaments: Tournament[]
  profile: Profile | null
  isAdmin: boolean
  recentActivity: RecentActivity[]
  totals: { teams: number; incidents: number; matches: number }
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [localTournaments, setLocalTournaments] = useState<Tournament[]>(tournaments)
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null)
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | TournamentStatus>("all")

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
        return "Activo"
      case "finished":
        return "Finalizado"
      default:
        return "Borrador"
    }
  }

  const getTypeLabel = (type: string) => {
    return type === "league" ? "Liga" : "Torneo por grupos"
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
  const filteredTournaments = localTournaments.filter((tournament) => tournament.name.toLowerCase().includes(search.trim().toLowerCase()) && (statusFilter === "all" || tournament.status === statusFilter))

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
      const response = await fetch(`/api/tournaments/${tournamentId}`, {
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
        throw new Error(data?.error || "No se pudo actualizar el estado del torneo")
      }
    } catch (error) {
      console.error("Error updating tournament status:", error)
      setLocalTournaments(previousTournaments)
      alert(error instanceof Error ? error.message : "Error al actualizar el estado del torneo")
    } finally {
      setStatusLoadingId(null)
    }
  }

  const handleDeleteTournament = async (tournamentId: string, tournamentName: string) => {
    if (!confirm(`¿Seguro que quieres eliminar "${tournamentName}"?`)) {
      return
    }

    setDeleteLoadingId(tournamentId)

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        alert(`Error: ${data?.error || "No se pudo eliminar el torneo"}`)
        return
      }

      setLocalTournaments((prev) => prev.filter((t) => t.id !== tournamentId))
    } catch (error) {
      console.error("Error deleting tournament:", error)
      alert("Error al eliminar el torneo")
    } finally {
      setDeleteLoadingId(null)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.035] via-background to-background" />
      <div className="absolute left-1/2 top-0 h-72 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl" />

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
                  <h1 className="text-xl">Gestión de torneos</h1>
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
                        aria-label="Cambiar tema"
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
                        {isAdmin ? "Administrador" : "Usuario"}
                      </p>
                    </div>

                    {isAdmin && <><DropdownMenuItem asChild className="cursor-pointer"><Link href="/admin/settings"><Settings className="mr-2 h-4 w-4" />Administración</Link></DropdownMenuItem><DropdownMenuSeparator /></>}

                    <DropdownMenuItem asChild className="cursor-pointer">
                      <form action="/auth/sign-out" method="post" className="w-full">
                        <button type="submit" className="w-full text-left">
                          Cerrar sesión
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
                Panel principal
              </div>

              <div>
                <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">Mis torneos</h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Gestiona competiciones, equipos, actas y resultados desde un único lugar.
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
                    Crear torneo
                  </Button>
                </Link>
              )}
            </div>
          </section>

          <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[{ label: "Torneos activos", value: localTournaments.filter((item) => item.status === "active").length, icon: Trophy, tone: "text-emerald-600 bg-emerald-500/10" }, { label: "Equipos registrados", value: totals.teams, icon: Users, tone: "text-primary bg-primary/10" }, { label: "Partidos disputados", value: totals.matches, icon: Activity, tone: "text-blue-600 bg-blue-500/10" }, { label: "Incidencias", value: totals.incidents, icon: MessageSquareWarning, tone: "text-amber-600 bg-amber-500/10" }].map((stat) => { const Icon = stat.icon; return <Card key={stat.label} className="gap-0 py-0"><CardContent className="flex items-center gap-4 p-4"><div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.tone}`}><Icon className="h-5 w-5" /></div><div><p className="text-2xl font-bold tabular-nums">{stat.value}</p><p className="text-xs text-muted-foreground">{stat.label}</p></div></CardContent></Card> })}
          </section>

          {localTournaments.length > 0 && <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar torneos..." className="h-11 bg-background pl-9" /></div><div className="flex gap-2 overflow-x-auto pb-1">{([['all','Todos'],['active','Activos'],['draft','Borradores'],['finished','Finalizados']] as const).map(([value, label]) => <Button key={value} size="sm" variant={statusFilter === value ? "default" : "outline"} onClick={() => setStatusFilter(value)}>{label}</Button>)}</div></section>}

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

                <h3 className="text-2xl font-semibold tracking-tight">Todavía no hay torneos</h3>
                <p className="mt-3 max-w-md text-muted-foreground">
                  {isAdmin
                    ? "Crea tu primer torneo para comenzar a gestionar partidos, equipos y estadísticas."
                    : "No hay torneos disponibles. Contacta con un administrador."}
                </p>

                {isAdmin && (
                  <Link href="/tournaments/create" className="mt-8">
                    <Button size="lg" className="h-12 rounded-xl px-6">
                      <Plus className="mr-2 h-5 w-5" />
                      Crear primer torneo
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {filteredTournaments.map((tournament) => (
                <div key={tournament.id} className="group relative">
                    <Card role="link" tabIndex={0} onClick={() => router.push(`/tournaments/${tournament.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(`/tournaments/${tournament.id}`) } }} className="h-full cursor-pointer overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                      <div className={`h-1.5 w-full ${getTopBarClasses(tournament.status)}`} />

                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between gap-4 pr-10">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="truncate text-xl font-semibold tracking-tight">
                              <Link href={`/tournaments/${tournament.id}`} className="hover:text-primary hover:underline">{tournament.name}</Link>
                            </CardTitle>
                            <CardDescription className="mt-2 text-sm">
                              {getTypeLabel(tournament.type)}
                            </CardDescription>
                          </div>

                        </div>
                      </CardHeader>

                      <CardContent className="pt-0 pb-4">
                        <div className="grid gap-3">
                          <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/50 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                                <Users className="h-4 w-4 text-primary" />
                              </div>
                              <span className="text-sm text-muted-foreground">Equipos</span>
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {tournament.tournament_teams[0]?.count || 0}
                            </span>
                          </div>

                          <button type="button" onClick={(event) => { event.stopPropagation(); void handleStatusChange(tournament.id) }} onKeyDown={(event) => event.stopPropagation()} disabled={!isAdmin || statusLoadingId === tournament.id} className="flex w-full items-center justify-between rounded-2xl border border-border/50 bg-background/50 px-4 py-3 text-left transition-colors enabled:hover:border-primary/30 enabled:hover:bg-primary/5 disabled:cursor-default"><div className="flex items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tournament.status === "active" ? "bg-emerald-500/10 text-emerald-600" : tournament.status === "finished" ? "bg-red-500/10 text-red-600" : "bg-primary/10 text-primary"}`}><Trophy className="h-4 w-4" /></div><div><span className="text-sm text-muted-foreground">Estado</span>{isAdmin && <p className="text-[10px] text-muted-foreground">Pulsa para cambiar</p>}</div></div><Badge className={getStatusClasses(tournament.status)}>{statusLoadingId === tournament.id ? "Actualizando..." : getStatusLabel(tournament.status)}</Badge></button>

                          <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/50 px-4 py-3">
                            <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><Activity className="h-4 w-4 text-primary" /></div><span className="text-sm text-muted-foreground">Partidos</span></div><span className="text-sm font-medium tabular-nums">{tournament.matches[0]?.count || 0}</span>
                          </div>

                          <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/50 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                                <Calendar className="h-4 w-4 text-primary" />
                              </div>
                              <span className="text-sm text-muted-foreground">Creado</span>
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {new Date(tournament.created_at).toLocaleDateString("es-ES")}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                  {isAdmin && <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="icon" className="absolute right-4 top-15 z-20 h-9 w-9 bg-background shadow-sm" aria-label={`Acciones de ${tournament.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void handleDeleteTournament(tournament.id, tournament.name)} disabled={deleteLoadingId === tournament.id}><Trash2 className="mr-2 h-4 w-4" />Eliminar torneo</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
                </div>
              ))}
            </section>
          )}

          {localTournaments.length > 0 && filteredTournaments.length === 0 && <Card><CardContent className="py-12 text-center"><p className="font-semibold">No hay torneos que coincidan</p><p className="mt-1 text-sm text-muted-foreground">Prueba otro término o cambia el filtro de estado.</p></CardContent></Card>} 

          {recentActivity.length > 0 && <section className="mt-10 space-y-4"><div><h3 className="text-xl font-semibold">Actividad reciente</h3><p className="text-sm text-muted-foreground">Últimos resultados registrados en tus torneos.</p></div><Card className="gap-0 py-0"><CardContent className="divide-y p-0">{recentActivity.map((activity) => <Link key={activity.id} href={`/tournaments/${activity.tournament_id}/matches/${activity.id}`} className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/30 sm:px-5"><div className="min-w-0"><p className="truncate font-medium">{activity.team_a?.name || "Equipo A"} <span className="mx-1 font-bold tabular-nums">{activity.team_a_score ?? 0}–{activity.team_b_score ?? 0}</span> {activity.team_b?.name || "Equipo B"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{activity.tournament?.name || "Torneo"} · {new Date(activity.updated_at).toLocaleDateString("es-ES")}</p></div><ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-muted-foreground" /></Link>)}</CardContent></Card></section>}
        </main>
      </div>
    </div>
  )
}
