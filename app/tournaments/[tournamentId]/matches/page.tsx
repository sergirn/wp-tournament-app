import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { MatchesTabs } from "@/components/matches/matches-tabs"

export default async function MatchesPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { tournamentId } = await params

  const [{ data: matches }, { data: groupPhases }] = await Promise.all([supabase.from("matches").select(`
    id, team_a_score, team_b_score, match_date, location, comments, group_id, created_by,
    team_a:teams!matches_team_a_id_fkey(name, logo_url),
    team_b:teams!matches_team_b_id_fkey(name, logo_url),
    group:groups(name),
    phase:tournament_phases(name, phase_type, phase_order)
  `).eq("tournament_id", tournamentId).neq("status", "scheduled").order("match_date", { ascending: false }), supabase.from("tournament_phases").select("name").eq("tournament_id", tournamentId).eq("phase_type", "group").order("phase_order")])

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const admin = createAdminClient()
  const { data: membership } = admin
    ? await admin.from("tournament_users").select("id").eq("tournament_id", tournamentId).or(`id.eq.${user.id}${user.email ? `,email.eq.${user.email.toLowerCase()}` : ""}`).limit(1).maybeSingle()
    : { data: null }

  return <div className="h-[calc(100dvh-4rem)] overflow-y-auto p-2 sm:p-4 lg:p-5"><MatchesTabs tournamentId={tournamentId} matches={(matches || []) as unknown as Parameters<typeof MatchesTabs>[0]["matches"]} canManage={profile?.role === "admin" || Boolean(membership)} userId={user.id} groupPhaseNames={(groupPhases || []).map((phase) => phase.name)} /></div>
}

export const revalidate = 0
export const dynamic = "force-dynamic"
