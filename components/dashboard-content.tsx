"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trophy, Plus, Users, Calendar, Trash2, LogOut, ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState } from "react"

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

export function DashboardContent({
  tournaments: initialTournaments,
  profile,
  isAdmin,
}: {
  tournaments: Tournament[]
  profile: Profile | null
  isAdmin: boolean
}) {
  const [tournaments, setTournaments] = useState(initialTournaments)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" })
      if (response.ok) {
        router.replace("/auth/login")
        router.refresh()
      }
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleDeleteTournament = async (tournamentId: string, tournamentName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el torneo "${tournamentName}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        alert(`Error: ${data.error}`)
        return
      }

      window.location.reload()
    } catch (error) {
      console.error("Error deleting tournament:", error)
      alert("Error al eliminar el torneo")
    }
  }

  const handleToggleStatus = async (tournamentId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "finished" : "active"

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(`Error: ${data.error}`)
        return
      }

      setTournaments((prev) => prev.map((t) => (t.id === tournamentId ? { ...t, status: newStatus } : t)))
    } catch (error) {
      console.error("Error updating tournament status:", error)
      alert("Error al actualizar el estado del torneo")
    }
  }

  return (
    <div
      className="min-h-screen bg-background relative"
      style={{
        backgroundImage: "url('/images/2.png')",
        backgroundAttachment: "fixed",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-background/80" />
      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-border bg-card/60 backdrop-blur-xl">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-20 items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-background/80 flex items-center justify-center shadow-lg border border-border p-1.5">
                  <img src="/images/bwmf-logo.png" alt="Waterpolo Pro" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Waterpolo Pro</h1>
                  <p className="text-sm text-muted-foreground">Sistema de Gestión de Torneos</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                {profile?.email && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground text-xs font-bold">
                          {profile.email[0].toUpperCase()}
                        </div>
                        <span className="text-sm max-w-32 truncate hidden sm:inline">{profile.email}</span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem disabled className="cursor-default">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium truncate">{profile.email}</p>
                          {isAdmin && <p className="text-xs text-primary">Administrador</p>}
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
                        <LogOut className="h-4 w-4 mr-2" />
                        {isLoggingOut ? "Cerrando..." : "Cerrar sesión"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-4xl font-bold mb-2">
                <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                  Mis Torneos
                </span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Selecciona un torneo para gestionar partidos y estadísticas
              </p>
            </div>
            {isAdmin && (
              <Link href="/tournaments/create">
                <Button
                  size="lg"
                  className="gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                >
                  <Plus className="h-5 w-5" />
                  Crear Torneo
                </Button>
              </Link>
            )}
          </div>

          {tournaments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
                  <Trophy className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No hay torneos creados</h3>
                <p className="text-muted-foreground mb-6 text-center max-w-md">
                  {isAdmin
                    ? "Crea tu primer torneo para comenzar a gestionar partidos y estadísticas"
                    : "No hay torneos disponibles. Contacta con un administrador."}
                </p>
                {isAdmin && (
                  <Link href="/tournaments/create">
                    <Button size="lg" className="gap-2">
                      <Plus className="h-5 w-5" />
                      Crear Primer Torneo
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tournaments.map((tournament) => (
                <div key={tournament.id} className="relative group">
                  <Link href={`/tournaments/${tournament.id}`}>
                    <Card className="h-full card-hover cursor-pointer overflow-hidden border-border bg-card">
                      <div
                        className={`h-2 ${
                          tournament.status === "active"
                            ? "gradient-primary"
                            : tournament.status === "finished"
                              ? "bg-red-500"
                              : tournament.status === "draft"
                                ? "gradient-secondary"
                                : "bg-muted"
                        }`}
                      />
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-xl">{tournament.name}</CardTitle>
                            <CardDescription className="mt-1">
                              {tournament.type === "league" ? "Liga" : "Torneo por Grupos"}
                            </CardDescription>
                          </div>
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleToggleStatus(tournament.id, tournament.status)
                              }}
                              className="focus:outline-none"
                            >
                              <Badge
                                variant={
                                  tournament.status === "active"
                                    ? "default"
                                    : tournament.status === "finished"
                                      ? "destructive"
                                      : tournament.status === "draft"
                                        ? "outline"
                                        : "secondary"
                                }
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                              >
                                {tournament.status === "active"
                                  ? "Activo"
                                  : tournament.status === "finished"
                                    ? "Finalizado"
                                    : tournament.status === "draft"
                                      ? "Borrador"
                                      : "Desconocido"}
                              </Badge>
                            </button>
                          ) : (
                            <Badge
                              variant={
                                tournament.status === "active"
                                  ? "default"
                                  : tournament.status === "finished"
                                    ? "destructive"
                                    : tournament.status === "draft"
                                      ? "outline"
                                      : "secondary"
                              }
                            >
                              {tournament.status === "active"
                                ? "Activo"
                                : tournament.status === "finished"
                                  ? "Finalizado"
                                  : tournament.status === "draft"
                                    ? "Borrador"
                                    : "Desconocido"}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {tournament.tournament_teams[0]?.count || 0} equipos
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {new Date(tournament.created_at).toLocaleDateString("es-ES")}
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
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        handleDeleteTournament(tournament.id, tournament.name)
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 bg-background/80 backdrop-blur-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
