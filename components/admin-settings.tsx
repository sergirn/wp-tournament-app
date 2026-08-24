"use client"

import { useMemo, useState } from "react"
import { Plus, Search, Pencil, Trash2, X } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { TeamLogo } from "@/components/team-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Player { id?: string; name: string; cap_number: number }
interface Team { id: string; name: string; logo_url: string | null; players: Player[] }
interface User { id: string; email: string; full_name: string | null; role: string; created_at: string }

export function AdminSettings({ initialTeams, initialUsers, currentUserId }: { initialTeams: Team[]; initialUsers: User[]; currentUserId: string }) {
  const [teams, setTeams] = useState(initialTeams)
  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState("")
  const [teamDialog, setTeamDialog] = useState(false)
  const [userDialog, setUserDialog] = useState(false)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [teamName, setTeamName] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [players, setPlayers] = useState<Player[]>([])
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("user")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const query = search.trim().toLowerCase()
  const filteredTeams = useMemo(() => teams.filter((team) => !query || team.name.toLowerCase().includes(query) || team.players.some((player) => player.name.toLowerCase().includes(query))), [teams, query])
  const filteredUsers = useMemo(() => users.filter((user) => !query || user.email.toLowerCase().includes(query) || user.full_name?.toLowerCase().includes(query) || user.role.includes(query)), [users, query])

  const openTeam = (team?: Team) => { setEditingTeamId(team?.id || null); setTeamName(team?.name || ""); setLogoUrl(team?.logo_url || ""); setPlayers(team?.players.map((player) => ({ ...player })) || Array.from({ length: 15 }, (_, index) => ({ name: `Equipo player ${index + 1}`, cap_number: index + 1 }))); setError(null); setTeamDialog(true) }
  const changeTeamName = (name: string) => {
    setTeamName(name)
    if (!editingTeamId) {
      const teamLabel = name.trim() || "Equipo"
      setPlayers((current) => current.map((player) => /^Equipo player \d+$/.test(player.name) || / player \d+$/.test(player.name) ? { ...player, name: `${teamLabel} player ${player.cap_number}` } : player))
    }
  }
  const openUser = (user?: User) => { setEditingUserId(user?.id || null); setUserName(user?.full_name || ""); setUserEmail(user?.email || ""); setPassword(""); setRole(user?.role || "user"); setError(null); setUserDialog(true) }

  const saveTeam = async () => {
    setLoading(true); setError(null)
    try {
      const response = await fetch(editingTeamId ? `/api/admin/teams/${editingTeamId}` : "/api/admin/teams", { method: editingTeamId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: teamName, logoUrl, players: players.map((player) => ({ id: player.id, name: player.name, capNumber: Number(player.cap_number) })) }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "No se pudo guardar el equipo")
      setTeams((current) => editingTeamId ? current.map((team) => team.id === editingTeamId ? result.team : team) : [...current, result.team].sort((a, b) => a.name.localeCompare(b.name)))
      setTeamDialog(false)
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar el equipo") } finally { setLoading(false) }
  }
  const deleteTeam = async (team: Team) => { if (!confirm(`¿Eliminar ${team.name} y todos sus jugadores?`)) return; const response = await fetch(`/api/admin/teams/${team.id}`, { method: "DELETE" }); const result = await response.json(); if (!response.ok) return alert(result.error); setTeams((current) => current.filter((item) => item.id !== team.id)) }

  const saveUser = async () => {
    setLoading(true); setError(null)
    try {
      const response = await fetch(editingUserId ? `/api/admin/users/${editingUserId}` : "/api/admin/users", { method: editingUserId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: userName, email: userEmail, password, role }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "No se pudo guardar el usuario")
      setUsers((current) => editingUserId ? current.map((user) => user.id === editingUserId ? result.user : user) : [result.user, ...current]); setUserDialog(false)
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar el usuario") } finally { setLoading(false) }
  }
  const deleteUser = async (user: User) => { if (!confirm(`¿Eliminar la cuenta ${user.email}?`)) return; const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" }); const result = await response.json(); if (!response.ok) return alert(result.error); setUsers((current) => current.filter((item) => item.id !== user.id)) }

  return <main className="container mx-auto max-w-6xl space-y-6 px-4 py-8"><div><h1 className="text-3xl font-bold">Admin settings</h1><p className="text-muted-foreground">Gestión global de equipos, jugadores y usuarios.</p></div><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar equipos, jugadores, usuarios o roles..." className="pl-9" /></div><Tabs defaultValue="teams"><TabsList><TabsTrigger value="teams">Equipos ({filteredTeams.length})</TabsTrigger><TabsTrigger value="users">Usuarios ({filteredUsers.length})</TabsTrigger></TabsList><TabsContent value="teams" className="space-y-4"><Button onClick={() => openTeam()}><Plus className="mr-2 h-4 w-4" />Crear equipo</Button><div className="grid gap-3 md:grid-cols-2">{filteredTeams.map((team) => <Card key={team.id}><CardContent className="flex items-center gap-3 p-4"><TeamLogo name={team.name} logoUrl={team.logo_url} className="h-12 w-12" /><div className="min-w-0 flex-1"><p className="font-semibold">{team.name}</p><p className="text-sm text-muted-foreground">{team.players.length} jugadores</p></div><Button size="icon" variant="ghost" onClick={() => openTeam(team)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={() => void deleteTeam(team)}><Trash2 className="h-4 w-4" /></Button></CardContent></Card>)}</div></TabsContent><TabsContent value="users" className="space-y-4"><Button onClick={() => openUser()}><Plus className="mr-2 h-4 w-4" />Crear usuario</Button><div className="space-y-3">{filteredUsers.map((user) => <Card key={user.id}><CardContent className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="font-semibold">{user.full_name || user.email}</p><p className="truncate text-sm text-muted-foreground">{user.email} · {user.role}{user.id === currentUserId ? " · Tú" : ""}</p></div><Button size="icon" variant="ghost" onClick={() => openUser(user)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" disabled={user.id === currentUserId} onClick={() => void deleteUser(user)}><Trash2 className="h-4 w-4" /></Button></CardContent></Card>)}</div></TabsContent></Tabs>
  <Dialog open={teamDialog} onOpenChange={setTeamDialog}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editingTeamId ? "Editar equipo" : "Crear equipo"}</DialogTitle><DialogDescription>Gestiona el equipo y sus jugadores.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Nombre</Label><Input value={teamName} onChange={(e) => changeTeamName(e.target.value)} /></div><div><Label>URL del logo</Label><Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} /></div><div className="flex items-center justify-between"><Label>Jugadores</Label><Button size="sm" variant="outline" onClick={() => setPlayers((current) => [...current, { name: "", cap_number: current.length + 1 }])}><Plus className="mr-1 h-4 w-4" />Añadir</Button></div>{players.map((player, index) => <div key={player.id || index} className="grid grid-cols-[90px_1fr_auto] gap-2"><Input type="number" min={1} max={99} value={player.cap_number} onChange={(e) => setPlayers((current) => current.map((item, i) => i === index ? { ...item, cap_number: Number(e.target.value) } : item))} /><Input placeholder="Nombre del jugador" value={player.name} onChange={(e) => setPlayers((current) => current.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} /><Button size="icon" variant="ghost" onClick={() => setPlayers((current) => current.filter((_, i) => i !== index))}><X className="h-4 w-4" /></Button></div>)}{error && <p className="text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={loading} onClick={() => void saveTeam()}>{loading ? "Guardando..." : "Guardar equipo"}</Button></div></DialogContent></Dialog>
  <Dialog open={userDialog} onOpenChange={setUserDialog}><DialogContent><DialogHeader><DialogTitle>{editingUserId ? "Editar usuario" : "Crear usuario"}</DialogTitle><DialogDescription>Gestiona los datos y permisos de la cuenta.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Nombre</Label><Input value={userName} onChange={(e) => setUserName(e.target.value)} /></div><div><Label>Email</Label><Input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} /></div><div><Label>{editingUserId ? "Nueva contraseña (opcional)" : "Contraseña"}</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div><div><Label>Rol</Label><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">Usuario</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent></Select></div>{error && <p className="text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={loading} onClick={() => void saveUser()}>{loading ? "Guardando..." : "Guardar usuario"}</Button></div></DialogContent></Dialog></main>
}
