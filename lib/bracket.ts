export function getBracketSize(teamCount: number) {
  return 2 ** Math.ceil(Math.log2(Math.max(2, teamCount)))
}

export function getRoundName(teamCount: number) {
  if (teamCount === 2) return "Final"
  if (teamCount === 4) return "Semifinales"
  if (teamCount === 8) return "Cuartos de final"
  if (teamCount === 16) return "Octavos de final"
  return `Ronda de ${teamCount}`
}
