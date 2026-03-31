import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardContent } from "@/components/dashboard-content"

async function getTournaments() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("tournaments")
    .select(`
      *,
      tournament_teams(count)
    `)
    .order("created_at", { ascending: false })
  return data || []
}

async function getUserProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  return profile
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const [tournaments, profile] = await Promise.all([getTournaments(), getUserProfile()])

  const isAdmin = profile?.role === "admin"

  return <DashboardContent tournaments={tournaments} profile={profile} isAdmin={isAdmin} />
}
