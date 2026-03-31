import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AdminPanel } from "@/components/admin-panel"

export default async function AdminPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>
}) {
  const { tournamentId } = await params
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check if user is admin
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    redirect(`/tournaments/${tournamentId}`)
  }

  // Get tournament data
  const { data: tournament } = await supabase.from("tournaments").select("*").eq("id", tournamentId).single()

  // Get tournament users
  const { data: tournamentUsers } = await supabase
    .from("tournament_users")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="bg-card/80 backdrop-blur-lg border border-primary/30 shadow-xl p-6 rounded-lg">
          <h1 className="sport-gradient-text text-3xl font-bold mb-2">Panel de Administración</h1>
          <p className="text-muted-foreground">Gestiona usuarios de acceso para {tournament?.name}</p>
        </div>

        <AdminPanel tournamentId={tournamentId} tournamentUsers={tournamentUsers || []} />
      </div>
    </div>
  )
}
