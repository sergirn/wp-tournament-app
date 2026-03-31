"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, UserPlus, Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface TournamentUser {
  id: string
  name: string
  email: string
  created_at: string
}

export function AdminPanel({
  tournamentId,
  tournamentUsers,
}: {
  tournamentId: string
  tournamentUsers: TournamentUser[]
}) {
  const [users, setUsers] = useState(tournamentUsers)
  const [newUserName, setNewUserName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleCreateUser = async () => {
    if (!newUserName || !newUserEmail || !newUserPassword) {
      alert("Por favor completa todos los campos")
      return
    }

    if (newUserPassword.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres")
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al crear usuario")
      }

      console.log("[v0] User created successfully:", data.user)

      setUsers([data.user, ...users])
      setNewUserName("")
      setNewUserEmail("")
      setNewUserPassword("")
      alert("Usuario creado correctamente")
    } catch (error) {
      console.error("[v0] Error creating user:", error)
      alert(error instanceof Error ? error.message : "Error al crear usuario")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("¿Estás seguro de eliminar este usuario?")) return

    setLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.from("tournament_users").delete().eq("id", userId)

      if (error) throw error

      setUsers(users.filter((u) => u.id !== userId))
      alert("Usuario eliminado correctamente")
    } catch (error) {
      console.error("Error deleting user:", error)
      alert("Error al eliminar usuario")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2 p-3 sm:p-4 md:p-6">
      {/* Create User Card */}
      <Card className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <UserPlus className="h-5 w-5 text-primary" />
            Crear Usuario de Torneo
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Los usuarios creados podrán acceder al torneo sin confirmación de email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">
              Nombre completo
            </Label>
            <Input
              id="name"
              placeholder="Ej: Juan Pérez"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="bg-background/50 h-11 md:h-12 text-base touch-manipulation"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@ejemplo.com"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="bg-background/50 h-11 md:h-12 text-base touch-manipulation"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm">
              Contraseña
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="bg-background/50 pr-11 md:pr-12 h-11 md:h-12 text-base touch-manipulation"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-11 md:h-12 w-11 md:w-12 touch-manipulation"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Button
            onClick={handleCreateUser}
            disabled={loading}
            className="w-full sport-gradient h-11 md:h-12 text-base touch-manipulation"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Crear Usuario
          </Button>
        </CardContent>
      </Card>

      {/* Users List Card */}
      <Card className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Usuarios del Torneo</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            {users.length} usuario{users.length !== 1 ? "s" : ""} con acceso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[300px] md:max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/40 scrollbar-track-transparent pr-2">
            {users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No hay usuarios creados aún</div>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-background/70 active:bg-background/80 transition-colors touch-manipulation"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-medium truncate text-sm md:text-base">{user.name}</p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteUser(user.id)}
                    disabled={loading}
                    className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9 touch-manipulation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
