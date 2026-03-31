-- Limpiar datos antiguos si existen
DELETE FROM public.group_members WHERE group_id IN (SELECT id FROM public.groups WHERE tournament_id IS NOT NULL);
DELETE FROM public.groups WHERE tournament_id IS NOT NULL;
DELETE FROM public.tournament_teams;
DELETE FROM public.tournaments;

-- Insertar torneo de ejemplo 1
INSERT INTO public.tournaments (name, type, status, points_win, points_draw, points_loss)
VALUES ('Liga Nacional 2025', 'league', 'active', 3, 1, 0);

-- Insertar torneo de ejemplo 2
INSERT INTO public.tournaments (name, type, status, points_win, points_draw, points_loss)
VALUES ('Copa de España 2025', 'groups', 'active', 3, 1, 0);

-- Asignar equipos al primer torneo
INSERT INTO public.tournament_teams (tournament_id, team_id)
SELECT 
  (SELECT id FROM public.tournaments WHERE name = 'Liga Nacional 2025' LIMIT 1),
  id
FROM public.teams
WHERE name IN ('Real Canoe', 'CN Atlètic Barceloneta', 'CN Sabadell', 'Zodiac CN Atlètic', 'CN Barcelona', 'Astralpool CN Sabadell');

-- Asignar equipos al segundo torneo
INSERT INTO public.tournament_teams (tournament_id, team_id)
SELECT 
  (SELECT id FROM public.tournaments WHERE name = 'Copa de España 2025' LIMIT 1),
  id
FROM public.teams;

-- Crear grupos para el segundo torneo
DO $$
DECLARE
  copa_id UUID;
  group_a_id UUID;
  group_b_id UUID;
BEGIN
  SELECT id INTO copa_id FROM public.tournaments WHERE name = 'Copa de España 2025' LIMIT 1;
  
  IF copa_id IS NOT NULL THEN
    -- Insertar Grupo A
    INSERT INTO public.groups (tournament_id, name, order_number)
    VALUES (copa_id, 'Grupo A', 1)
    RETURNING id INTO group_a_id;
    
    -- Insertar Grupo B
    INSERT INTO public.groups (tournament_id, name, order_number)
    VALUES (copa_id, 'Grupo B', 2)
    RETURNING id INTO group_b_id;
    
    -- Asignar equipos a Grupo A (solo si existen)
    IF group_a_id IS NOT NULL THEN
      INSERT INTO public.group_members (group_id, team_id)
      SELECT group_a_id, id FROM public.teams 
      WHERE name IN ('Real Canoe', 'CN Atlètic Barceloneta', 'CN Sabadell', 'Zodiac CN Atlètic')
      AND id IS NOT NULL;
    END IF;
    
    -- Asignar equipos a Grupo B (solo si existen)
    IF group_b_id IS NOT NULL THEN
      INSERT INTO public.group_members (group_id, team_id)
      SELECT group_b_id, id FROM public.teams 
      WHERE name IN ('CN Barcelona', 'Astralpool CN Sabadell', 'CN Terrassa', 'CE Mediterrani')
      AND id IS NOT NULL;
    END IF;
  END IF;
END $$;
