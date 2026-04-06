"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Trophy,
  Home,
  FileText,
  List,
  BarChart3,
  ArrowLeft,
  Settings,
  Menu,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"

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

  const navItems = [
    { name: "Home", href: `/tournaments/${tournament.id}`, icon: Home },
    { name: "Match Report", href: `/tournaments/${tournament.id}/match-report`, icon: FileText },
    { name: "Matches", href: `/tournaments/${tournament.id}/matches`, icon: List },
    { name: "Standings", href: `/tournaments/${tournament.id}/standings`, icon: Trophy },
    { name: "Statistics", href: `/tournaments/${tournament.id}/stats`, icon: BarChart3 },
  ]

  if (isAdmin) {
    navItems.push({
      name: "Admin",
      href: `/tournaments/${tournament.id}/admin`,
      icon: Settings,
    })
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-card/80 backdrop-blur-lg shadow-xl">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex min-h-16 items-center justify-between gap-3 py-2">
          {/* Left side */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
           

            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
              className="hidden sm:inline-flex text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              
            </Button>

            <div className="hidden sm:block h-8 w-px bg-white/10" />
             <div className="flex items-center justify-center rounded-2xl">
                <Image
                  src="/images/bwmf-logo.png"
                  alt="Tournament Manager"
                  width={52}
                  height={42}
                  className="object-contain dark:brightness-0 dark:invert"
                  priority
                />
              </div>

            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-semibold text-foreground text-sm sm:text-base max-w-[120px] xs:max-w-[160px] sm:max-w-[220px] md:max-w-[280px] lg:max-w-none">
                {tournament.name}
              </span>
              <Badge
                variant={tournament.status === "active" ? "default" : "secondary"}
                className="sport-badge shrink-0"
              >
                {tournament.status === "active" ? "Active" : "Draft"}
              </Badge>
            </div>
          </div>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={`gap-2 ${
                      isActive
                        ? "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              )
            })}
          </div>

          {/* Mobile / Tablet actions */}
          <div className="flex items-center gap-2 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              className="sm:hidden"
              aria-label="Go back to tournaments"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile / Tablet menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-white/10 py-3">
            <div className="mb-3 hidden sm:block">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  router.push("/")
                  setMobileOpen(false)
                }}
                className="text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Tournaments
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      className={`w-full justify-start gap-2 ${
                        isActive
                          ? "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </Button>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}