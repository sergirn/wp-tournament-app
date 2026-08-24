import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowUpRight, MessageSquareWarning, Settings2, SlidersHorizontal } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { TournamentSettingsFlow } from "@/components/tournament-settings/tournament-settings-flow"
import { SecondGroupStageConfigurator } from "@/components/standings/second-group-stage-configurator"
import { BracketConfigurator } from "@/components/bracket/bracket-configurator"
import { Card, CardContent } from "@/components/ui/card"
import { BracketTemplateConfigurator } from "@/components/tournament-settings/bracket-template-configurator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Team { id: string; name: string; logo_url: string | null }
interface GroupRow { id: string; name: string; phase_id: string | null; group_members: Array<{ team_id: string }> | null }

export default async function TournamentSettingsPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const admin = createAdminClient()
  const dataClient = admin || supabase
  const [{ data: tournament }, { data: config }, { data: phases }, { data: groups }, { data: groupSlots }, { data: stageConfig }, { data: qualification }, { data: qualifiedRows }, { data: bracketRows }, { data: bracketSeeds }, { data: matches }, { data: incidents }, { data: profile }] = await Promise.all([
    dataClient.from("tournaments").select("name, type").eq("id", tournamentId).single(),
    dataClient.from("tournament_format_config").select("progression_mode, qualifiers_from_first_phase, second_stage_group_count, qualifiers_from_second_phase").eq("tournament_id", tournamentId).maybeSingle(),
    dataClient.from("tournament_phases").select("id, name, phase_order, phase_type").eq("tournament_id", tournamentId).order("phase_order"),
    dataClient.from("groups").select("id, name, phase_id, group_members(team_id)").eq("tournament_id", tournamentId).order("order_number"),
    dataClient.from("tournament_group_stage_slots").select("group_id").eq("tournament_id", tournamentId),
    dataClient.from("tournament_group_stage_config").select("target_phase_id, qualifiers_per_group, status").eq("tournament_id", tournamentId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    dataClient.from("tournament_qualification_config").select("qualifiers_per_group, status").eq("tournament_id", tournamentId).maybeSingle(),
    dataClient.from("tournament_qualified_teams").select("team_id, group_position, team:teams(id, name, logo_url)").eq("tournament_id", tournamentId),
    dataClient.from("tournament_bracket_nodes").select("id, phase_id, position, team_a_id, team_b_id, winner_team_id, status, match_id").eq("tournament_id", tournamentId),
    dataClient.from("tournament_bracket_seed_slots").select("id, team_id, source_phase_id").eq("tournament_id", tournamentId),
    dataClient.from("matches").select("id, phase_id, group_id, status, team_a_score, team_b_score").eq("tournament_id", tournamentId),
    dataClient.from("matches").select("id, comments, match_date, team_a_score, team_b_score, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name), phase:tournament_phases(name), group:groups(name)").eq("tournament_id", tournamentId).not("comments", "is", null).order("updated_at", { ascending: false }),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ])
  if (!tournament) redirect("/")
  const { data: membership } = admin ? await admin.from("tournament_users").select("id").eq("tournament_id", tournamentId).or(`id.eq.${user.id}${user.email ? `,email.eq.${user.email.toLowerCase()}` : ""}`).limit(1).maybeSingle() : { data: null }
  const canManage = profile?.role === "admin" || Boolean(membership)
  const groupPhases = (phases || []).filter((phase) => phase.phase_type === "group")
  const knockoutPhases = (phases || []).filter((phase) => phase.phase_type === "knockout")
  const firstPhase = groupPhases[0] || null
  const secondPhase = stageConfig ? groupPhases.find((phase) => phase.id === stageConfig.target_phase_id) || null : null
  const firstGroups = (groups || []).filter((group) => firstPhase ? group.phase_id === firstPhase.id : true)
  const defaultGroupCount = Math.max(1, firstGroups.length)
  const usesSecondStage = config?.progression_mode === "second_group_stage"
  const phaseMap = new Map(knockoutPhases.map((phase) => [phase.id, phase]))
  const bracketTeams = (qualifiedRows || []).flatMap((row) => { const team = row.team as unknown as Team | null; return team ? [{ ...team, groupPosition: row.group_position }] : [] })
  const bracketNodes = (bracketRows || []).flatMap((node) => { const phase = phaseMap.get(node.phase_id); return phase ? [{ id: node.id, phaseId: node.phase_id, phaseName: phase.name, phaseOrder: phase.phase_order, position: node.position, teamAId: node.team_a_id, teamBId: node.team_b_id, winnerTeamId: node.winner_team_id, status: node.status }] : [] })
  const bracketMatchIds = (bracketRows || []).flatMap((node) => node.match_id ? [node.match_id] : [])
  const canResetBracket = (matches || []).filter((match) => bracketMatchIds.includes(match.id)).every((match) => (match.team_a_score || 0) === 0 && (match.team_b_score || 0) === 0)
  const canResetSecond = (matches || []).filter((match) => secondPhase && match.phase_id !== firstPhase?.id).every((match) => (match.team_a_score || 0) === 0 && (match.team_b_score || 0) === 0)
  const groupSize = (group: GroupRow) => {
    const members = (group.group_members as unknown as unknown[] || []).length
    return members || (groupSlots || []).filter((slot) => slot.group_id === group.id).length
  }
  const bracketTemplateExists = Boolean(bracketSeeds?.length)
  const bracketTemplateResolved = Boolean(bracketSeeds?.length && bracketSeeds.every((seed) => seed.team_id))

  const initial = { progressionMode: usesSecondStage ? "second_group_stage" as const : "direct_knockout" as const, qualifiersFromFirstPhase: config?.qualifiers_from_first_phase || 2, secondStageGroupCount: config?.second_stage_group_count || defaultGroupCount, qualifiersFromSecondPhase: config?.qualifiers_from_second_phase || 2 }
  const directContent = <section className="space-y-4"><div><h2 className="text-xl font-semibold">Configurar eliminatorias</h2><p className="text-sm text-muted-foreground">Puedes preparar los cruces por posiciones antes de resolver la primera fase.</p></div><BracketTemplateConfigurator tournamentId={tournamentId} sourcePhaseId={firstPhase?.id || null} groups={firstGroups.map((group) => ({ id: group.id, name: group.name, teamCount: groupSize(group) }))} qualifiersPerGroup={config?.qualifiers_from_first_phase || 2} existing={bracketTemplateExists} resolved={bracketTemplateResolved} canManage={canManage} canReset={canResetBracket} />{bracketTemplateResolved && <BracketConfigurator tournamentId={tournamentId} groupSizes={firstGroups.map(groupSize)} canManage={canManage} config={qualification ? { qualifiersPerGroup: qualification.qualifiers_per_group, status: qualification.status } : null} teams={bracketTeams} nodes={bracketNodes} mode="configuration" canReset={canResetBracket} defaultQualifiersPerGroup={config?.qualifiers_from_first_phase || 2} />}</section>
  const secondGroups = (groups || []).filter((group) => group.phase_id === secondPhase?.id)
  const groupContent = <div className="space-y-8"><section className="space-y-4"><div><h2 className="text-xl font-semibold">Configurar segunda fase de grupos</h2><p className="text-sm text-muted-foreground">Asigna las posiciones de origen sin necesidad de resolver previamente la primera fase.</p></div><SecondGroupStageConfigurator tournamentId={tournamentId} sourcePhaseId={firstPhase?.id || null} sourceGroups={firstGroups.map((group) => ({ id: group.id, name: group.name, teamCount: groupSize(group) }))} existingPhaseId={secondPhase?.id || null} existingStatus={stageConfig?.status} canManage={canManage} canReset={canResetSecond} defaultGroupCount={config?.second_stage_group_count || defaultGroupCount} defaultQualifiers={config?.qualifiers_from_second_phase || 2} /></section><section className="space-y-4"><div><h2 className="text-xl font-semibold">Eliminatorias posteriores</h2><p className="text-sm text-muted-foreground">Una vez generada la segunda fase, decide cuántos equipos pasan de cada grupo y configura sus cruces.</p></div>{secondPhase ? <><BracketTemplateConfigurator tournamentId={tournamentId} sourcePhaseId={secondPhase.id} groups={secondGroups.map((group) => ({ id: group.id, name: group.name, teamCount: groupSize(group) }))} qualifiersPerGroup={qualification?.qualifiers_per_group || config?.qualifiers_from_second_phase || 2} existing={bracketTemplateExists} resolved={bracketTemplateResolved} canManage={canManage} canReset={canResetBracket} chooseQualifiers />{bracketTemplateResolved && <BracketConfigurator tournamentId={tournamentId} groupSizes={secondGroups.map(groupSize)} canManage={canManage} config={qualification ? { qualifiersPerGroup: qualification.qualifiers_per_group, status: qualification.status } : null} teams={bracketTeams} nodes={bracketNodes} mode="configuration" canReset={canResetBracket} defaultQualifiersPerGroup={qualification?.qualifiers_per_group || 2} />}</> : <Card><CardContent className="py-10 text-center text-muted-foreground">Guarda primero la distribución de la segunda fase para decidir sus clasificados.</CardContent></Card>}</section></div>

  const incidentRows = (incidents || []).filter((incident) => incident.comments?.trim())
  const incidentsContent = incidentRows.length ? <div className="grid gap-4">{incidentRows.map((incident) => {
    const teamA = incident.team_a as unknown as { name: string } | null
    const teamB = incident.team_b as unknown as { name: string } | null
    const phase = incident.phase as unknown as { name: string } | null
    const group = incident.group as unknown as { name: string } | null
    return <Card key={incident.id} className="overflow-hidden"><CardContent className="p-0"><div className="border-l-4 border-amber-500 px-5 py-5"><div className="flex items-start gap-3"><MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><p className="whitespace-pre-wrap text-base font-medium leading-7">{incident.comments?.trim()}</p></div><div className="mt-4 flex flex-col gap-2 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><div><span className="font-semibold text-foreground">{teamA?.name || "Equipo A"} {incident.team_a_score ?? 0} – {incident.team_b_score ?? 0} {teamB?.name || "Equipo B"}</span><span className="mx-2">·</span><span>{phase?.name || group?.name || "Partido del torneo"}{group?.name && phase?.name ? ` · ${group.name}` : ""}</span></div><Link href={`/tournaments/${tournamentId}/matches/${incident.id}`} className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline">Ver partido<ArrowUpRight className="h-3.5 w-3.5" /></Link></div></div></CardContent></Card>
  })}</div> : <Card><CardContent className="flex flex-col items-center py-14 text-center"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted"><MessageSquareWarning className="h-5 w-5 text-muted-foreground" /></div><p className="font-semibold">No hay incidencias registradas</p><p className="mt-1 max-w-md text-sm text-muted-foreground">Los comentarios anotados en las actas aparecerán automáticamente en esta pestaña.</p></CardContent></Card>

  return <main className="container mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-8"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Settings2 className="h-5 w-5" /></div><div><h1 className="text-2xl font-bold sm:text-3xl">Ajustes del torneo</h1><p className="mt-1 text-sm text-muted-foreground">Configura el recorrido de {tournament.name} y consulta las incidencias recogidas en sus actas.</p></div></div><Tabs defaultValue="format" className="gap-6"><TabsList className="grid h-11 w-full grid-cols-2 sm:w-fit sm:min-w-[360px]"><TabsTrigger value="format" className="gap-2"><SlidersHorizontal className="h-4 w-4" />Formato y fases</TabsTrigger><TabsTrigger value="incidents" className="gap-2"><MessageSquareWarning className="h-4 w-4" />Incidencias{incidentRows.length ? ` (${incidentRows.length})` : ""}</TabsTrigger></TabsList><TabsContent value="format">{tournament.type === "groups" ? <TournamentSettingsFlow tournamentId={tournamentId} canManage={canManage} initial={initial} directContent={directContent} groupContent={groupContent} /> : <div className="rounded-xl border p-6 text-muted-foreground">Este torneo es una liga y no necesita configurar una transición entre fases.</div>}</TabsContent><TabsContent value="incidents" className="space-y-4"><div><h2 className="text-xl font-semibold">Incidencias de las actas</h2><p className="text-sm text-muted-foreground">Comentarios registrados durante los partidos, ordenados desde el más reciente.</p></div>{incidentsContent}</TabsContent></Tabs></main>
}

export const dynamic = "force-dynamic"
