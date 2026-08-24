import { redirect } from "next/navigation"
import { Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rankGroup } from "@/lib/standings"
import { TeamLogo } from "@/components/team-logo"
import { BracketConfigurator } from "@/components/bracket/bracket-configurator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Team { id: string; name: string; logo_url: string | null }
interface StageGroup { id: string; name: string; teamIds: string[] }
interface Stage { id: string | null; name: string; order: number; groups: StageGroup[] }

export default async function StandingsPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const admin = createAdminClient()
  const dataClient = admin || supabase

  const [{ data: tournament }, { data: teamRows }, { data: phaseRows }, { data: groupRows }, { data: allMatches }, { data: formatConfig }, { data: stageConfig }, { data: qualificationConfig }, { data: qualifiedRows }, { data: bracketRows }] = await Promise.all([
    dataClient.from("tournaments").select("type, points_win, points_draw, points_loss").eq("id", tournamentId).single(),
    dataClient.from("tournament_teams").select("team:teams(id, name, logo_url)").eq("tournament_id", tournamentId),
    dataClient.from("tournament_phases").select("id, name, phase_order, phase_type").eq("tournament_id", tournamentId).order("phase_order"),
    dataClient.from("groups").select("id, name, order_number, phase_id, group_members(team_id)").eq("tournament_id", tournamentId).order("order_number"),
    dataClient.from("matches").select("id, group_id, phase_id, team_a_id, team_b_id, team_a_score, team_b_score, status").eq("tournament_id", tournamentId),
    dataClient.from("tournament_format_config").select("progression_mode, qualifiers_from_first_phase, second_stage_group_count, qualifiers_from_second_phase").eq("tournament_id", tournamentId).maybeSingle(),
    dataClient.from("tournament_group_stage_config").select("source_phase_id, target_phase_id, qualifiers_per_group, status").eq("tournament_id", tournamentId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    dataClient.from("tournament_qualification_config").select("source_phase_id, qualifiers_per_group, status").eq("tournament_id", tournamentId).maybeSingle(),
    dataClient.from("tournament_qualified_teams").select("team_id, group_position, team:teams(id, name, logo_url)").eq("tournament_id", tournamentId),
    dataClient.from("tournament_bracket_nodes").select("id, phase_id, position, team_a_id, team_b_id, winner_team_id, status, match_id").eq("tournament_id", tournamentId),
  ])
  const teams = (teamRows || []).flatMap((row) => row.team ? [row.team as unknown as Team] : [])
  const teamMap = new Map(teams.map((team) => [team.id, team]))
  const groupPhases = (phaseRows || []).filter((phase) => phase.phase_type === "group")
  const knockoutPhases = (phaseRows || []).filter((phase) => phase.phase_type === "knockout")
  const stages: Stage[] = groupPhases.length ? groupPhases.map((phase) => ({ id: phase.id, name: phase.name, order: phase.phase_order, groups: (groupRows || []).filter((group) => group.phase_id === phase.id).map((group) => ({ id: group.id, name: group.name, teamIds: (group.group_members as unknown as Array<{ team_id: string }> || []).map((member) => member.team_id) })) })) : [{ id: null, name: "Fase de grupos 1", order: 1, groups: (groupRows || []).map((group) => ({ id: group.id, name: group.name, teamIds: (group.group_members as unknown as Array<{ team_id: string }> || []).map((member) => member.team_id) })) }]
  const firstStage = stages[0]
  const secondStage = stages[1] || null
  const usesSecondStage = formatConfig?.progression_mode === "second_group_stage" || Boolean(secondStage)
  const qualificationStage = secondStage || firstStage
  const points = { win: tournament?.points_win ?? 3, draw: tournament?.points_draw ?? 1, loss: tournament?.points_loss ?? 0 }
  const phaseMap = new Map(knockoutPhases.map((phase) => [phase.id, phase]))
  const bracketTeams = (qualifiedRows || []).flatMap((row) => { const team = row.team as unknown as Team | null; return team ? [{ ...team, groupPosition: row.group_position }] : [] })
  const bracketNodes = (bracketRows || []).flatMap((node) => { const phase = phaseMap.get(node.phase_id); return phase ? [{ id: node.id, phaseId: node.phase_id, phaseName: phase.name, phaseOrder: phase.phase_order, position: node.position, teamAId: node.team_a_id, teamBId: node.team_b_id, winnerTeamId: node.winner_team_id, status: node.status }] : [] })

  function standingsView(stage: Stage | null, qualifierCount = 0) {
    if (!stage) return <Card><CardContent className="py-12 text-center text-muted-foreground">Todavía no se ha generado esta fase.</CardContent></Card>
    return <div className="grid gap-5">{stage.groups.map((group) => {
      const ranking = rankGroup(group.teamIds, allMatches || [], group.id, points)
      return <Card key={group.id} className="border-primary/20"><CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-cyan-500" />{group.name}</CardTitle></CardHeader><CardContent><div className="-mx-2 overflow-x-auto md:mx-0"><table className="w-full min-w-[640px]"><thead><tr className="border-b text-xs text-muted-foreground"><th className="px-2 py-3 text-left">#</th><th className="px-4 py-3 text-left">Equipo</th>{["PJ", "G", "E", "P", "GF", "GC", "DIF", "PTS"].map((label) => <th key={label} className="px-2 py-3 text-center">{label}</th>)}</tr></thead><tbody>{ranking.map((row, index) => { const team = teamMap.get(row.teamId); const values = [row.played, row.wins, row.draws, row.losses, row.goalsFor, row.goalsAgainst, row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference, row.points]; return <tr key={row.teamId} className={`border-b border-border/40 ${index < qualifierCount ? "bg-cyan-500/5" : ""}`}><td className="px-2 py-3 font-medium">{index + 1}</td><td className="px-4 py-3"><div className="flex items-center gap-3"><TeamLogo name={team?.name} logoUrl={team?.logo_url} className="h-9 w-9" /><strong>{team?.name || "Equipo"}</strong></div></td>{values.map((value, valueIndex) => <td key={valueIndex} className={`px-2 py-3 text-center ${valueIndex === 7 ? "font-bold text-cyan-500" : ""}`}>{value}</td>)}</tr>})}</tbody></table></div></CardContent></Card>
    })}</div>
  }

  return <div className="container mx-auto p-4 md:p-6"><div className="mb-6"><h1 className="text-3xl font-bold sm:text-4xl">Clasificación</h1><p className="text-muted-foreground">Consulta las clasificaciones y el cuadro del torneo. La estructura de fases se gestiona exclusivamente desde Ajustes.</p></div><Tabs defaultValue="phase-1" className="gap-5"><TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto"><TabsTrigger value="phase-1" className="px-5">Fase de grupos 1</TabsTrigger>{usesSecondStage && <TabsTrigger value="phase-2" className="px-5">Fase de grupos 2</TabsTrigger>}<TabsTrigger value="knockout" className="px-5">Eliminatorias</TabsTrigger></TabsList>
    <TabsContent value="phase-1">{standingsView(firstStage, secondStage ? 0 : qualificationConfig?.qualifiers_per_group || formatConfig?.qualifiers_from_first_phase || 0)}</TabsContent>
    {usesSecondStage && <TabsContent value="phase-2" className="space-y-5">{secondStage ? (secondStage.groups.some((group) => group.teamIds.length) ? standingsView(secondStage, qualificationConfig?.qualifiers_per_group || stageConfig?.qualifiers_per_group || formatConfig?.qualifiers_from_second_phase || 0) : <Card><CardContent className="py-12 text-center"><p className="font-semibold">Estructura preparada</p><p className="mt-2 text-sm text-muted-foreground">Los equipos aparecerán automáticamente cuando termine la primera fase.</p></CardContent></Card>) : <Card><CardContent className="py-12 text-center text-muted-foreground">Configura la distribución desde Ajustes del torneo.</CardContent></Card>}</TabsContent>}
    <TabsContent value="knockout" className="space-y-4">{!bracketNodes.length ? <Card><CardContent className="py-12 text-center"><p className="font-semibold">El cuadro todavía no está generado</p><p className="mt-2 text-sm text-muted-foreground">Configúralo desde Ajustes del torneo.</p></CardContent></Card> : <BracketConfigurator tournamentId={tournamentId} groupSizes={(qualificationStage?.groups || []).map((group) => group.teamIds.length)} canManage={false} config={qualificationConfig ? { qualifiersPerGroup: qualificationConfig.qualifiers_per_group, status: qualificationConfig.status } : null} teams={bracketTeams} nodes={bracketNodes} mode="bracket" canReset={false} />}</TabsContent>
  </Tabs></div>
}

export const revalidate = 0
export const dynamic = "force-dynamic"
