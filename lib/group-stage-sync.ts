import type { SupabaseClient } from "@supabase/supabase-js"
import { expectedRoundRobinMatches, rankGroup } from "@/lib/standings"

export async function syncPendingGroupStages(tournamentId: string, admin: SupabaseClient) {
  const [{ data: tournament }, { data: configs }] = await Promise.all([
    admin.from("tournaments").select("points_win, points_draw, points_loss").eq("id", tournamentId).maybeSingle(),
    admin.from("tournament_group_stage_config").select("id, source_phase_id, target_phase_id, status").eq("tournament_id", tournamentId).in("status", ["draft", "generated"]),
  ])
  if (!tournament || !configs?.length) return { resolved: false }

  let resolved = false
  for (const config of configs) {
    if (!config.source_phase_id) continue
    const [{ data: sourceGroups }, { data: sourceMatches }, { data: slots }] = await Promise.all([
      admin.from("groups").select("id, group_members(team_id)").eq("tournament_id", tournamentId).eq("phase_id", config.source_phase_id),
      admin.from("matches").select("group_id, team_a_id, team_b_id, team_a_score, team_b_score, status").eq("tournament_id", tournamentId).eq("phase_id", config.source_phase_id),
      admin.from("tournament_group_stage_slots").select("id, group_id, source_group_id, source_position, team_id").eq("phase_id", config.target_phase_id),
    ])
    if (!sourceGroups?.length || !slots?.length) continue
    const complete = sourceGroups.every((group) => {
      const size = (group.group_members as unknown as Array<{ team_id: string }> || []).length
      return (sourceMatches || []).filter((match) => match.group_id === group.id && match.status === "finished").length >= expectedRoundRobinMatches(size)
    })
    if (!complete) {
      if (config.status === "generated") {
        const targetGroupIds = [...new Set(slots.map((slot) => slot.group_id))]
        await admin.from("group_members").delete().in("group_id", targetGroupIds)
        await admin.from("tournament_group_stage_slots").update({ team_id: null }).eq("phase_id", config.target_phase_id)
        await admin.from("tournament_group_stage_config").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", config.id)
      }
      continue
    }

    const rankings = new Map(sourceGroups.map((group) => {
      const teamIds = (group.group_members as unknown as Array<{ team_id: string }> || []).map((member) => member.team_id)
      return [group.id, rankGroup(teamIds, sourceMatches || [], group.id, { win: tournament.points_win ?? 3, draw: tournament.points_draw ?? 1, loss: tournament.points_loss ?? 0 })]
    }))
    const targetGroupIds = [...new Set(slots.map((slot) => slot.group_id))]
    await admin.from("group_members").delete().in("group_id", targetGroupIds)
    const members: Array<{ group_id: string; team_id: string }> = []
    for (const slot of slots) {
      const teamId = rankings.get(slot.source_group_id)?.[slot.source_position - 1]?.teamId
      if (!teamId) continue
      await admin.from("tournament_group_stage_slots").update({ team_id: teamId }).eq("id", slot.id)
      members.push({ group_id: slot.group_id, team_id: teamId })
    }
    if (members.length !== slots.length) continue
    const { error: membersError } = await admin.from("group_members").insert(members)
    if (membersError) continue
    await admin.from("tournament_group_stage_config").update({ status: "generated", updated_at: new Date().toISOString() }).eq("id", config.id)
    resolved = true
  }
  return { resolved }
}
