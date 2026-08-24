"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import {
  ArrowLeft,
  BarChart3,
  FileText,
  Home,
  List,
  Menu,
  Settings,
  Trophy,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"

interface Tournament {
  id: string
  name: string
  type: string
  status: string
}

export function TournamentNav({
  tournament,
  isAdmin,
}: {
  tournament: Tournament
  isAdmin?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const mainNavItems = [
    {
      name: "Inicio",
      href: `/tournaments/${tournament.id}`,
      icon: Home,
    },
    {
      name: "Actas",
      href: `/tournaments/${tournament.id}/match-report`,
      icon: FileText,
    },
    {
      name: "Partidos",
      href: `/tournaments/${tournament.id}/matches`,
      icon: List,
    },
    {
      name: "Clasificación",
      href: `/tournaments/${tournament.id}/standings`,
      icon: Trophy,
    },
    {
      name: "Estadísticas",
      href: `/tournaments/${tournament.id}/stats`,
      icon: BarChart3,
    },
    {
      name: "Ajustes",
      href: `/tournaments/${tournament.id}/settings`,
      icon: Settings,
    },
  ]

  const isActive = (href: string) => {
    const tournamentHome = `/tournaments/${tournament.id}`

    if (href === tournamentHome) {
      return pathname === href
    }

    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const statusLabel =
    tournament.status === "active"
      ? "Activo"
      : tournament.status === "finished"
        ? "Finalizado"
        : "Borrador"

  const statusDot =
    tournament.status === "active"
      ? "bg-emerald-500"
      : tournament.status === "finished"
        ? "bg-muted-foreground"
        : "bg-amber-500"

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6">
        <div className="flex h-16 items-center gap-4">

          {/* IZQUIERDA */}
          <div className="flex min-w-0 shrink-0 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              className="h-9 w-9 shrink-0"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="h-6 w-px bg-border" />

            <Image
              src="/images/bwmf-logo.png"
              alt="Tournament Manager"
              width={44}
              height={36}
              className="h-9 w-auto shrink-0 object-contain dark:brightness-0 dark:invert"
              priority
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="max-w-[150px] truncate text-sm font-semibold sm:max-w-[220px] xl:max-w-[300px]">
                  {tournament.name}
                </span>

                <div className="hidden items-center gap-1.5 sm:flex">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${statusDot}`}
                  />

                  <span className="text-xs text-muted-foreground">
                    {statusLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* DESKTOP NAV */}
          <div className="hidden min-w-0 flex-1 items-stretch justify-end lg:flex">
            <div className="flex h-16 items-stretch">
              {mainNavItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      relative flex items-center gap-2 px-3
                      text-sm transition-colors
                      ${
                        active
                          ? "font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }
                    `}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        active ? "text-foreground" : ""
                      }`}
                    />

                    <span>{item.name}</span>

                    {active && (
                      <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-foreground" />
                    )}
                  </Link>
                )
              })}

              {false && isAdmin && (
                <>
                  <div className="mx-2 my-auto h-5 w-px bg-border" />

                  <Link
                    href={`/tournaments/${tournament.id}/admin`}
                    className={`
                      relative flex items-center gap-2 px-3
                      text-sm transition-colors
                      ${
                        isActive(
                          `/tournaments/${tournament.id}/admin`
                        )
                          ? "font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }
                    `}
                  >
                    <Settings className="h-4 w-4" />
                    <span>Admin</span>

                    {isActive(
                      `/tournaments/${tournament.id}/admin`
                    ) && (
                      <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-foreground" />
                    )}
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* MOBILE */}
          <div className="ml-auto lg:hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() =>
                setMobileOpen((current) => !current)
              }
              aria-label={
                mobileOpen ? "Cerrar menú" : "Abrir menú"
              }
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* MOBILE MENU */}
        {mobileOpen && (
          <div className="border-t py-2 lg:hidden">
            <div className="flex flex-col">
              {mainNavItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`
                      flex items-center gap-3 rounded-md px-3 py-2.5
                      text-sm transition-colors
                      ${
                        active
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }
                    `}
                  >
                    <Icon className="h-4 w-4" />

                    <span>{item.name}</span>

                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-foreground" />
                    )}
                  </Link>
                )
              })}

              {false && isAdmin && (
                <>
                  <div className="my-2 border-t" />

                  <Link
                    href={`/tournaments/${tournament.id}/admin`}
                    onClick={() => setMobileOpen(false)}
                    className={`
                      flex items-center gap-3 rounded-md px-3 py-2.5
                      text-sm transition-colors
                      ${
                        isActive(
                          `/tournaments/${tournament.id}/admin`
                        )
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }
                    `}
                  >
                    <Settings className="h-4 w-4" />

                    <span>Administración</span>

                    {isActive(
                      `/tournaments/${tournament.id}/admin`
                    ) && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-foreground" />
                    )}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
