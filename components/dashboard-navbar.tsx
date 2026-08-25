"use client"

import Link from "next/link"
import Image from "next/image"
import { ChevronDown, LayoutDashboard, Settings } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function DashboardNavbar({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  return <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6"><Link href="/dashboard" className="flex items-center gap-3"><Image src="/images/bwmf-logo.png" alt="Waterpolo Pro" width={44} height={40} className="h-10 w-auto object-contain dark:brightness-0 dark:invert" /><span className="hidden text-lg font-bold sm:inline">Waterpolo Pro</span></Link><div className="flex items-center gap-2"><Button asChild variant="ghost" className="hidden gap-2 sm:flex"><Link href="/dashboard"><LayoutDashboard className="h-4 w-4" />Dashboard</Link></Button><ThemeToggle /><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{email[0]?.toUpperCase()}</span><span className="hidden max-w-48 truncate md:inline">{email}</span><ChevronDown className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60"><div className="border-b px-3 py-3"><p className="truncate text-sm font-medium">{email}</p><p className="text-xs text-muted-foreground">{isAdmin ? "Administrador" : "Usuario"}</p></div>{isAdmin && <DropdownMenuItem asChild><Link href="/admin/settings"><Settings className="mr-2 h-4 w-4" />Admin settings</Link></DropdownMenuItem>}<DropdownMenuSeparator /><DropdownMenuItem asChild><form action="/auth/sign-out" method="post" className="w-full"><button type="submit" className="w-full text-left">Cerrar sesión</button></form></DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div></header>
}
