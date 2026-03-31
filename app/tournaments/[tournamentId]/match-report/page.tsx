import { createClient } from "@/lib/supabase/server"
import { MatchReportForm } from "@/components/match-report-form"

export default async function MatchReportPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>
}) {
  const { tournamentId } = await params
  const supabase = await createClient()

  const { data: teams } = await supabase
    .from("tournament_teams")
    .select("team:teams(*)")
    .eq("tournament_id", tournamentId)

  const teamsData = teams?.map((item: any) => item.team) || []

  return (
    <main>
      <MatchReportForm teams={teamsData} tournamentId={tournamentId} />
    </main>
  )
}
