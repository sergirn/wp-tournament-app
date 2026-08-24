import type { SupabaseClient } from "@supabase/supabase-js"
import { expectedRoundRobinMatches, rankGroup } from "@/lib/standings"

export async function syncBracketTemplate(tournamentId: string, admin: SupabaseClient) {
  const [{ data: config }, { data: tournament }, { data: seeds }] = await Promise.all([
    admin.from("tournament_qualification_config").select("source_phase_id, status").eq("tournament_id", tournamentId).maybeSingle(),
    admin.from("tournaments").select("points_win, points_draw, points_loss").eq("id", tournamentId).maybeSingle(),
    admin.from("tournament_bracket_seed_slots").select("id, node_id, node_slot, source_group_id, source_position, team_id").eq("tournament_id", tournamentId),
  ])
  if (!config?.source_phase_id || !tournament || !seeds?.length || config.status === "locked") return { resolved: false }
  const [{ data: groups }, { data: matches }] = await Promise.all([
    admin.from("groups").select("id, group_members(team_id)").eq("tournament_id", tournamentId).eq("phase_id", config.source_phase_id),
    admin.from("matches").select("group_id, team_a_id, team_b_id, team_a_score, team_b_score, status").eq("tournament_id", tournamentId).eq("phase_id", config.source_phase_id),
  ])
  if (!groups?.length) return { resolved: false }
  const complete = groups.every((group) => {
    const size = (group.group_members as unknown as Array<{ team_id: string }> || []).length
    return size > 0 && (matches || []).filter((match) => match.group_id === group.id && match.status === "finished").length >= expectedRoundRobinMatches(size)
  })
  if (!complete) return { resolved: false }
  const rankings = new Map(groups.map((group) => {
    const ids = (group.group_members as unknown as Array<{ team_id: string }> || []).map((member) => member.team_id)
    return [group.id, rankGroup(ids, matches || [], group.id, { win: tournament.points_win ?? 3, draw: tournament.points_draw ?? 1, loss: tournament.points_loss ?? 0 })]
  }))
  const resolved = seeds.map((seed) => ({ ...seed, teamId: rankings.get(seed.source_group_id)?.[seed.source_position - 1]?.teamId }))
  if (resolved.some((seed) => !seed.teamId)) return { resolved: false }
  await admin.from("tournament_qualified_teams").delete().eq("tournament_id", tournamentId)
  const qualified = resolved.map((seed) => ({ tournament_id: tournamentId, group_id: seed.source_group_id, team_id: seed.teamId!, group_position: seed.source_position }))
  const { error: qualifiedError } = await admin.from("tournament_qualified_teams").insert(qualified)
  if (qualifiedError) return { resolved: false }
  for (const seed of resolved) {
    await admin.from("tournament_bracket_seed_slots").update({ team_id: seed.teamId, updated_at: new Date().toISOString() }).eq("id", seed.id)
    await admin.from("tournament_bracket_nodes").update(seed.node_slot === "A" ? { team_a_id: seed.teamId } : { team_b_id: seed.teamId }).eq("id", seed.node_id)
  }
  const nodeIds = [...new Set(resolved.map((seed) => seed.node_id))]
  const { data: nodes } = await admin.from("tournament_bracket_nodes").select("id, team_a_id, team_b_id").in("id", nodeIds)
  for (const node of nodes || []) await admin.from("tournament_bracket_nodes").update({ status: node.team_a_id && node.team_b_id ? "ready" : "bye", winner_team_id: node.team_a_id && !node.team_b_id ? node.team_a_id : !node.team_a_id && node.team_b_id ? node.team_b_id : null }).eq("id", node.id)
  return { resolved: true }
}
