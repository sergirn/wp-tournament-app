-- Migración segura a sistema de múltiples torneos
-- Este script maneja las dependencias correctamente antes de modificar las tablas

-- Paso 1: Eliminar vistas que dependen de las columnas que vamos a modificar
DROP VIEW IF EXISTS public.group_standings CASCADE;
DROP VIEW IF EXISTS public.tournament_standings CASCADE;

-- Paso 2: Crear la tabla principal de torneos
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('league', 'groups')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'finished')),
  points_win INTEGER DEFAULT 3,
  points_draw INTEGER DEFAULT 1,
  points_loss INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Paso 3: Crear tabla de equipos por torneo
CREATE TABLE IF NOT EXISTS public.tournament_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tournament_id, team_id)
);

-- Paso 4: Renombrar tournament_groups a groups
ALTER TABLE IF EXISTS public.tournament_groups RENAME TO groups;

-- Paso 5: Añadir tournament_id a grupos si no existe
ALTER TABLE public.groups 
  ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- Paso 6: Renombrar group_teams a group_members
ALTER TABLE IF EXISTS public.group_teams RENAME TO group_members;

-- Paso 7: Crear tabla de usuarios por torneo
CREATE TABLE IF NOT EXISTS public.tournament_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tournament_id, email)
);

-- Paso 8: Añadir tournament_id a matches (sin eliminar group_id todavía)
ALTER TABLE public.matches 
  ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- Paso 9: Actualizar group_id en matches para referenciar la nueva tabla groups
-- Primero eliminamos la constraint antigua si existe
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_group_id_fkey;
-- Ahora añadimos la nueva constraint
ALTER TABLE public.matches 
  ADD CONSTRAINT matches_group_id_fkey 
  FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;

-- Paso 10: Enable RLS en nuevas tablas
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_users ENABLE ROW LEVEL SECURITY;

-- Paso 11: Policies para tournaments
DROP POLICY IF EXISTS "tournaments_select_all" ON public.tournaments;
CREATE POLICY "tournaments_select_all"
  ON public.tournaments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "tournaments_insert_admin" ON public.tournaments;
CREATE POLICY "tournaments_insert_admin"
  ON public.tournaments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "tournaments_update_admin_or_creator" ON public.tournaments;
CREATE POLICY "tournaments_update_admin_or_creator"
  ON public.tournaments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    ) OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "tournaments_delete_admin" ON public.tournaments;
CREATE POLICY "tournaments_delete_admin"
  ON public.tournaments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Paso 12: Policies para tournament_teams
DROP POLICY IF EXISTS "tournament_teams_select_all" ON public.tournament_teams;
CREATE POLICY "tournament_teams_select_all"
  ON public.tournament_teams FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "tournament_teams_insert_admin" ON public.tournament_teams;
CREATE POLICY "tournament_teams_insert_admin"
  ON public.tournament_teams FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "tournament_teams_delete_admin" ON public.tournament_teams;
CREATE POLICY "tournament_teams_delete_admin"
  ON public.tournament_teams FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Paso 13: Policies para tournament_users
DROP POLICY IF EXISTS "tournament_users_select_admin" ON public.tournament_users;
CREATE POLICY "tournament_users_select_admin"
  ON public.tournament_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "tournament_users_manage_admin" ON public.tournament_users;
CREATE POLICY "tournament_users_manage_admin"
  ON public.tournament_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Paso 14: Recrear vista de clasificaciones
CREATE OR REPLACE VIEW public.tournament_standings AS
SELECT
  gm.group_id,
  g.name AS group_name,
  g.tournament_id,
  t.id AS team_id,
  t.name AS team_name,
  COUNT(m.id) FILTER (WHERE m.status = 'finished') AS matches_played,
  COUNT(m.id) FILTER (
    WHERE m.status = 'finished' AND (
      (m.team_a_id = t.id AND m.team_a_score > m.team_b_score) OR
      (m.team_b_id = t.id AND m.team_b_score > m.team_a_score)
    )
  ) AS wins,
  COUNT(m.id) FILTER (
    WHERE m.status = 'finished' AND m.team_a_score = m.team_b_score
  ) AS draws,
  COUNT(m.id) FILTER (
    WHERE m.status = 'finished' AND (
      (m.team_a_id = t.id AND m.team_a_score < m.team_b_score) OR
      (m.team_b_id = t.id AND m.team_b_score < m.team_a_score)
    )
  ) AS losses,
  COALESCE(SUM(
    CASE 
      WHEN m.team_a_id = t.id THEN m.team_a_score
      WHEN m.team_b_id = t.id THEN m.team_b_score
    END
  ) FILTER (WHERE m.status = 'finished'), 0) AS goals_for,
  COALESCE(SUM(
    CASE 
      WHEN m.team_a_id = t.id THEN m.team_b_score
      WHEN m.team_b_id = t.id THEN m.team_a_score
    END
  ) FILTER (WHERE m.status = 'finished'), 0) AS goals_against,
  COALESCE(SUM(
    CASE 
      WHEN m.team_a_id = t.id THEN m.team_a_score - m.team_b_score
      WHEN m.team_b_id = t.id THEN m.team_b_score - m.team_a_score
    END
  ) FILTER (WHERE m.status = 'finished'), 0) AS goal_difference,
  COALESCE(SUM(
    CASE 
      WHEN m.team_a_id = t.id AND m.team_a_score > m.team_b_score THEN 3
      WHEN m.team_b_id = t.id AND m.team_b_score > m.team_a_score THEN 3
      WHEN m.status = 'finished' AND m.team_a_score = m.team_b_score THEN 1
      ELSE 0
    END
  ) FILTER (WHERE m.status = 'finished'), 0) AS points
FROM public.group_members gm
INNER JOIN public.teams t ON gm.team_id = t.id
INNER JOIN public.groups g ON gm.group_id = g.id
LEFT JOIN public.matches m ON 
  (m.team_a_id = t.id OR m.team_b_id = t.id)
  AND m.group_id = gm.group_id
GROUP BY gm.group_id, g.name, g.tournament_id, t.id, t.name
ORDER BY g.tournament_id, gm.group_id, points DESC, goal_difference DESC, goals_for DESC;
