-- Eliminar la vista antigua si existe
DROP VIEW IF EXISTS public.group_standings;
DROP VIEW IF EXISTS public.tournament_standings;

-- Crear vista actualizada para clasificación de torneos
CREATE OR REPLACE VIEW public.tournament_standings AS
SELECT
  g.tournament_id,
  gm.group_id,
  g.name as group_name,
  t.id as team_id,
  t.name as team_name,
  COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'finished') as matches_played,
  COUNT(DISTINCT m.id) FILTER (
    WHERE m.status = 'finished' 
    AND ((m.team_a_id = t.id AND m.team_a_score > m.team_b_score) 
         OR (m.team_b_id = t.id AND m.team_b_score > m.team_a_score))
  ) as wins,
  COUNT(DISTINCT m.id) FILTER (
    WHERE m.status = 'finished' 
    AND m.team_a_score = m.team_b_score
    AND (m.team_a_id = t.id OR m.team_b_id = t.id)
  ) as draws,
  COUNT(DISTINCT m.id) FILTER (
    WHERE m.status = 'finished' 
    AND ((m.team_a_id = t.id AND m.team_a_score < m.team_b_score) 
         OR (m.team_b_id = t.id AND m.team_b_score < m.team_a_score))
  ) as losses,
  COALESCE(SUM(CASE 
    WHEN m.status = 'finished' AND m.team_a_id = t.id THEN m.team_a_score
    WHEN m.status = 'finished' AND m.team_b_id = t.id THEN m.team_b_score
    ELSE 0
  END), 0) as goals_for,
  COALESCE(SUM(CASE 
    WHEN m.status = 'finished' AND m.team_a_id = t.id THEN m.team_b_score
    WHEN m.status = 'finished' AND m.team_b_id = t.id THEN m.team_a_score
    ELSE 0
  END), 0) as goals_against,
  COALESCE(SUM(CASE 
    WHEN m.status = 'finished' AND m.team_a_id = t.id THEN (m.team_a_score - m.team_b_score)
    WHEN m.status = 'finished' AND m.team_b_id = t.id THEN (m.team_b_score - m.team_a_score)
    ELSE 0
  END), 0) as goal_difference,
  COALESCE(SUM(CASE 
    -- Victoria: 3 puntos
    WHEN m.status = 'finished' AND m.team_a_id = t.id AND m.team_a_score > m.team_b_score THEN 3
    WHEN m.status = 'finished' AND m.team_b_id = t.id AND m.team_b_score > m.team_a_score THEN 3
    -- Empate: 1 punto
    WHEN m.status = 'finished' AND m.team_a_score = m.team_b_score AND (m.team_a_id = t.id OR m.team_b_id = t.id) THEN 1
    -- Derrota: 0 puntos
    ELSE 0
  END), 0) as points
FROM
  public.group_members gm
  INNER JOIN public.teams t ON gm.team_id = t.id
  INNER JOIN public.groups g ON gm.group_id = g.id
  LEFT JOIN public.matches m ON 
    (m.team_a_id = t.id OR m.team_b_id = t.id)
    AND m.group_id = gm.group_id
    AND m.tournament_id = g.tournament_id
GROUP BY
  g.tournament_id, gm.group_id, g.name, t.id, t.name
ORDER BY
  g.tournament_id, gm.group_id, points DESC, goal_difference DESC, goals_for DESC;

-- Dar permisos de lectura a todos los usuarios autenticados
GRANT SELECT ON public.tournament_standings TO authenticated;
