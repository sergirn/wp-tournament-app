-- Rediseño completo para múltiples torneos con usuarios específicos por torneo

-- Tabla principal de torneos
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

-- Tabla de equipos participantes en cada torneo
CREATE TABLE IF NOT EXISTS public.tournament_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tournament_id, team_id)
);

-- Tabla de grupos por torneo
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de equipos en grupos
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, team_id)
);

-- Tabla de usuarios con acceso a torneos específicos
CREATE TABLE IF NOT EXISTS public.tournament_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tournament_id, email)
);

-- Actualizar matches para referenciar torneos y grupos nuevos
ALTER TABLE public.matches 
  DROP COLUMN IF EXISTS group_id,
  DROP COLUMN IF EXISTS phase_id,
  ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- Enable RLS en nuevas tablas
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_users ENABLE ROW LEVEL SECURITY;

-- Policies para tournaments - todos pueden ver, solo admins y creadores pueden modificar
CREATE POLICY "tournaments_select_all"
  ON public.tournaments FOR SELECT
  USING (true);

CREATE POLICY "tournaments_insert_admin"
  ON public.tournaments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "tournaments_update_admin_or_creator"
  ON public.tournaments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    ) OR created_by = auth.uid()
  );

CREATE POLICY "tournaments_delete_admin"
  ON public.tournaments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policies para tournament_teams
CREATE POLICY "tournament_teams_select_all"
  ON public.tournament_teams FOR SELECT
  USING (true);

CREATE POLICY "tournament_teams_insert_admin"
  ON public.tournament_teams FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "tournament_teams_delete_admin"
  ON public.tournament_teams FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policies para groups
CREATE POLICY "groups_select_all"
  ON public.groups FOR SELECT
  USING (true);

CREATE POLICY "groups_manage_admin"
  ON public.groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policies para group_members
CREATE POLICY "group_members_select_all"
  ON public.group_members FOR SELECT
  USING (true);

CREATE POLICY "group_members_manage_admin"
  ON public.group_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policies para tournament_users - solo admins pueden gestionar
CREATE POLICY "tournament_users_select_admin"
  ON public.tournament_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "tournament_users_manage_admin"
  ON public.tournament_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Vista actualizada para clasificaciones por grupo
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
