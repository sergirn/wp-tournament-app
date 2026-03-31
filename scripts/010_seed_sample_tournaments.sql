-- Datos de ejemplo con múltiples torneos

-- Insertar torneo de ejemplo 1
INSERT INTO public.tournaments (name, type, status, points_win, points_draw, points_loss)
VALUES ('Liga Nacional 2025', 'league', 'active', 3, 1, 0)
ON CONFLICT DO NOTHING;

-- Insertar torneo de ejemplo 2
INSERT INTO public.tournaments (name, type, status, points_win, points_draw, points_loss)
VALUES ('Copa de España 2025', 'groups', 'active', 3, 1, 0)
ON CONFLICT DO NOTHING;

-- Asignar equipos al primer torneo
INSERT INTO public.tournament_teams (tournament_id, team_id)
SELECT 
  (SELECT id FROM public.tournaments WHERE name = 'Liga Nacional 2025' LIMIT 1),
  id
FROM public.teams
WHERE name IN ('Real Canoe', 'CN Atlètic Barceloneta', 'CN Sabadell', 'Zodiac CN Atlètic', 'CN Barcelona', 'Astralpool CN Sabadell')
ON CONFLICT DO NOTHING;

-- Asignar equipos al segundo torneo
INSERT INTO public.tournament_teams (tournament_id, team_id)
SELECT 
  (SELECT id FROM public.tournaments WHERE name = 'Copa de España 2025' LIMIT 1),
  id
FROM public.teams
ON CONFLICT DO NOTHING;

-- Crear grupos para el segundo torneo
DO $$
DECLARE
  copa_id UUID;
  group_a_id UUID;
  group_b_id UUID;
BEGIN
  SELECT id INTO copa_id FROM public.tournaments WHERE name = 'Copa de España 2025' LIMIT 1;
  
  IF copa_id IS NOT NULL THEN
    INSERT INTO public.groups (tournament_id, name, order_number)
    VALUES (copa_id, 'Grupo A', 1)
    RETURNING id INTO group_a_id;
    
    INSERT INTO public.groups (tournament_id, name, order_number)
    VALUES (copa_id, 'Grupo B', 2)
    RETURNING id INTO group_b_id;
    
    -- Asignar equipos a Grupo A
    INSERT INTO public.group_members (group_id, team_id)
    SELECT group_a_id, id FROM public.teams 
    WHERE name IN ('Real Canoe', 'CN Atlètic Barceloneta', 'CN Sabadell', 'Zodiac CN Atlètic')
    ON CONFLICT DO NOTHING;
    
    -- Asignar equipos a Grupo B
    INSERT INTO public.group_members (group_id, team_id)
    SELECT group_b_id, id FROM public.teams 
    WHERE name IN ('CN Barcelona', 'Astralpool CN Sabadell', 'CN Terrassa', 'CE Mediterrani')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
