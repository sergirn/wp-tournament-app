import { createClient } from "@/lib/supabase/server"
import { PublicTournamentLive } from "@/components/public-tournament-live"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function PublicHomePage() {
  const supabase = await createClient()
  const { data: tournament } = await supabase.from("tournaments").select("id, name, status, points_win, points_draw, points_loss, created_at").eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle()

  if (!tournament) return <PublicTournamentLive tournament={null} teams={[]} groups={[]} phases={[]} matches={[]} />

  const [{ data: teamRows }, { data: groups }, { data: phases }, { data: matches }] = await Promise.all([
    supabase.from("tournament_teams").select("team:teams(id, name, logo_url)").eq("tournament_id", tournament.id),
    supabase.from("groups").select("id, name, order_number, phase_id, group_members(team_id)").eq("tournament_id", tournament.id).order("order_number"),
    supabase.from("tournament_phases").select("id, name, phase_order, phase_type").eq("tournament_id", tournament.id).order("phase_order"),
    supabase.from("matches").select("id, tournament_id, group_id, phase_id, team_a_id, team_b_id, team_a_score, team_b_score, match_date, location, status, updated_at, team_a:teams!matches_team_a_id_fkey(id, name, logo_url), team_b:teams!matches_team_b_id_fkey(id, name, logo_url)").eq("tournament_id", tournament.id).order("match_date", { ascending: false }),
  ])

  return <PublicTournamentLive tournament={tournament} teams={(teamRows || []).flatMap((row) => row.team ? [row.team] : []) as unknown as Parameters<typeof PublicTournamentLive>[0]["teams"]} groups={(groups || []) as Parameters<typeof PublicTournamentLive>[0]["groups"]} phases={(phases || []) as Parameters<typeof PublicTournamentLive>[0]["phases"]} matches={(matches || []) as unknown as Parameters<typeof PublicTournamentLive>[0]["matches"]} />
}
