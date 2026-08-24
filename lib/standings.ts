export interface RankingMatch {
  group_id: string | null
  phase_id?: string | null
  team_a_id: string | null
  team_b_id: string | null
  team_a_score: number | null
  team_b_score: number | null
  status?: string | null
}

export interface RankedTeam {
  teamId: string
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

export function rankGroup(
  teamIds: string[],
  matches: RankingMatch[],
  groupId: string,
  points: { win: number; draw: number; loss: number },
) {
  return teamIds.map((teamId): RankedTeam => {
    let played = 0, wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0
    for (const match of matches) {
      if (match.group_id !== groupId || (match.status && match.status !== "finished")) continue
      if (match.team_a_id !== teamId && match.team_b_id !== teamId) continue
      played += 1
      const isA = match.team_a_id === teamId
      const own = (isA ? match.team_a_score : match.team_b_score) || 0
      const rival = (isA ? match.team_b_score : match.team_a_score) || 0
      goalsFor += own
      goalsAgainst += rival
      if (own > rival) wins += 1
      else if (own === rival) draws += 1
      else losses += 1
    }
    return {
      teamId, played, wins, draws, losses, goalsFor, goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
      points: wins * points.win + draws * points.draw + losses * points.loss,
    }
  }).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.teamId.localeCompare(b.teamId))
}

export function expectedRoundRobinMatches(teamCount: number) {
  return teamCount < 2 ? 0 : (teamCount * (teamCount - 1)) / 2
}
