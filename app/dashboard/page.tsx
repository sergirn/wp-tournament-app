import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardContent } from "@/components/dashboard-content"

async function getTournaments() {
  const supabase = await createClient()
  const { data } = await supabase.from("tournaments").select(`*, tournament_teams(count), matches(count)`).order("created_at", { ascending: false })
  return data || []
}

async function getUserProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  return profile
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [tournaments, profile, recentResult, teamsResult, incidentsResult, matchesResult] = await Promise.all([
    getTournaments(), getUserProfile(),
    supabase.from("matches").select("id, tournament_id, team_a_score, team_b_score, updated_at, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name), tournament:tournaments(name)").eq("status", "finished").order("updated_at", { ascending: false }).limit(5),
    supabase.from("teams").select("id", { count: "exact", head: true }),
    supabase.from("matches").select("id", { count: "exact", head: true }).not("comments", "is", null),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "finished"),
  ])

  return <DashboardContent tournaments={tournaments} profile={profile} isAdmin={profile?.role === "admin"} recentActivity={(recentResult.data || []) as unknown as Parameters<typeof DashboardContent>[0]["recentActivity"]} totals={{ teams: teamsResult.count || 0, incidents: incidentsResult.count || 0, matches: matchesResult.count || 0 }} />
}
