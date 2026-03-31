import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TournamentCreationFlow } from "@/components/tournament-creation-flow"

export default async function CreateTournamentPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    redirect("/")
  }

  const { data: teams } = await supabase.from("teams").select("*").order("name")

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed dark:bg-gradient-to-br dark:from-slate-950 dark:via-blue-950 dark:to-slate-900"
      style={{ backgroundImage: "url('/images/2.png')" }}
    >
      <div className="absolute inset-0 bg-black/40 dark:bg-black/50"></div>
      <div className="relative z-10">
        <TournamentCreationFlow teams={teams || []} />
      </div>
    </div>
  )
}
