"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { LogOut, Menu, ChevronDown } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const navItems = [
  { name: "Home", href: "/" },
  { name: "Match Report", href: "/match-report" },
  { name: "Grupos", href: "/groups" },
  { name: "Resultados", href: "/results" },
  { name: "Estadísticas", href: "/statistics" },
]

function NavLinks({ pathname, onClick }: { pathname?: string; onClick?: () => void }) {
  return (
    <>
      {navItems.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all 
              ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}
            `}
          >
            {item.name}
          </Link>
        )
      })}
    </>
  )
}

export function Navbar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      })

      if (response.ok) {
        router.replace("/auth/login")
        router.refresh()
      } else {
        console.error("[v0] Logout failed")
      }
    } catch (error) {
      console.error("[v0] Logout error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/60 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo + Links */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-lg bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform p-1">
                <img src="/images/bwmf-logo.png" alt="Waterpolo Pro" className="w-full h-full object-contain" />
              </div>
              <span className="text-xl font-bold group-hover:text-primary transition-colors hidden sm:inline">
                Waterpolo Pro
              </span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex gap-1">
              <NavLinks pathname={pathname} />
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-4">
            <ThemeToggle />

            {/* User dropdown (desktop) */}
            {userEmail && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 hidden md:flex">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold">
                      {userEmail[0].toUpperCase()}
                    </div>
                    <span className="text-sm">{userEmail}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem disabled className="cursor-default">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{userEmail}</p>
                      <p className="text-xs text-muted-foreground">Cuenta</p>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={handleLogout} disabled={isLoading}>
                    <LogOut className="h-4 w-4 mr-2" />
                    {isLoading ? "Cerrando sesión..." : "Cerrar sesión"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>

              <SheetContent side="left">
                <div className="flex flex-col gap-4 mt-8">
                  <NavLinks pathname={pathname} onClick={() => {}} />

                  <Button variant="ghost" onClick={handleLogout} disabled={isLoading} className="justify-start">
                    <LogOut className="h-5 w-5 mr-2" />
                    {isLoading ? "Cerrando sesión..." : "Cerrar sesión"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  )
}
