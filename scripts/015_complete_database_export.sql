-- ============================================
-- COMPLETE DATABASE SCHEMA EXPORT
-- Sistema de Gestión de Torneos de Waterpolo
-- ============================================

-- ============================================
-- TABLES
-- ============================================

-- Tabla de perfiles de usuarios
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user'))
);

-- Tabla de equipos
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabla de jugadores
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cap_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(team_id, cap_number)
);

-- Tabla de torneos
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT DEFAULT 'league' CHECK (type IN ('league', 'knockout', 'mixed')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
    points_win INTEGER DEFAULT 3,
    points_draw INTEGER DEFAULT 1,
    points_loss INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabla de usuarios asociados a torneos específicos
CREATE TABLE IF NOT EXISTS tournament_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(tournament_id, email)
);

-- Tabla de equipos participantes en torneos
CREATE TABLE IF NOT EXISTS tournament_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(tournament_id, team_id)
);

-- Tabla de grupos dentro de torneos
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(tournament_id, name)
);

-- Tabla de miembros de grupos (equipos en grupos)
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(group_id, team_id)
);

-- Tabla de fases de torneo
CREATE TABLE IF NOT EXISTS tournament_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phase_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabla de partidos
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    phase_id UUID REFERENCES tournament_phases(id) ON DELETE SET NULL,
    team_a_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    team_b_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    team_a_score INTEGER DEFAULT 0,
    team_b_score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    match_date TIMESTAMP WITH TIME ZONE,
    location TEXT,
    comments TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabla de eventos de partido (goles, exclusiones, etc.)
CREATE TABLE IF NOT EXISTS match_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('goal', 'exclusion', 'penalty_goal', 'penalty_miss')),
    quarter INTEGER CHECK (quarter BETWEEN 1 AND 4),
    time_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabla de configuración de torneos
CREATE TABLE IF NOT EXISTS tournament_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT DEFAULT 'league',
    points_win INTEGER DEFAULT 3,
    points_draw INTEGER DEFAULT 1,
    points_loss INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabla de fechas importantes del torneo
CREATE TABLE IF NOT EXISTS tournament_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================
-- VIEWS
-- ============================================

-- Vista de clasificación por torneos
CREATE OR REPLACE VIEW tournament_standings AS
SELECT
    t.id as tournament_id,
    g.id as group_id,
    g.name as group_name,
    tm.id as team_id,
    tm.name as team_name,
    COALESCE(COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed'), 0) as matches_played,
    COALESCE(COUNT(*) FILTER (WHERE m.status = 'completed' AND 
        ((m.team_a_id = tm.id AND m.team_a_score > m.team_b_score) OR 
         (m.team_b_id = tm.id AND m.team_b_score > m.team_a_score))), 0) as wins,
    COALESCE(COUNT(*) FILTER (WHERE m.status = 'completed' AND 
        m.team_a_score = m.team_b_score), 0) as draws,
    COALESCE(COUNT(*) FILTER (WHERE m.status = 'completed' AND 
        ((m.team_a_id = tm.id AND m.team_a_score < m.team_b_score) OR 
         (m.team_b_id = tm.id AND m.team_b_score < m.team_a_score))), 0) as losses,
    COALESCE(SUM(CASE 
        WHEN m.team_a_id = tm.id THEN m.team_a_score
        WHEN m.team_b_id = tm.id THEN m.team_b_score
        ELSE 0
    END) FILTER (WHERE m.status = 'completed'), 0) as goals_for,
    COALESCE(SUM(CASE 
        WHEN m.team_a_id = tm.id THEN m.team_b_score
        WHEN m.team_b_id = tm.id THEN m.team_a_score
        ELSE 0
    END) FILTER (WHERE m.status = 'completed'), 0) as goals_against,
    COALESCE(SUM(CASE 
        WHEN m.team_a_id = tm.id THEN m.team_a_score - m.team_b_score
        WHEN m.team_b_id = tm.id THEN m.team_b_score - m.team_a_score
        ELSE 0
    END) FILTER (WHERE m.status = 'completed'), 0) as goal_difference,
    COALESCE(SUM(CASE
        WHEN m.status = 'completed' AND ((m.team_a_id = tm.id AND m.team_a_score > m.team_b_score) OR (m.team_b_id = tm.id AND m.team_b_score > m.team_a_score)) THEN t.points_win
        WHEN m.status = 'completed' AND m.team_a_score = m.team_b_score THEN t.points_draw
        WHEN m.status = 'completed' THEN t.points_loss
        ELSE 0
    END), 0) as points
FROM tournaments t
CROSS JOIN groups g
CROSS JOIN group_members gm
CROSS JOIN teams tm
LEFT JOIN matches m ON m.tournament_id = t.id 
    AND m.group_id = gm.group_id 
    AND (m.team_a_id = tm.id OR m.team_b_id = tm.id)
WHERE g.tournament_id = t.id
    AND gm.group_id = g.id
    AND gm.team_id = tm.id
GROUP BY t.id, g.id, g.name, tm.id, tm.name, t.points_win, t.points_draw, t.points_loss;

-- Vista de máximos goleadores
CREATE OR REPLACE VIEW top_scorers AS
SELECT
    p.id,
    p.name,
    p.cap_number,
    t.name as team_name,
    COUNT(*) as goals
FROM match_events me
JOIN players p ON p.id = me.player_id
JOIN teams t ON t.id = p.team_id
WHERE me.event_type IN ('goal', 'penalty_goal')
GROUP BY p.id, p.name, p.cap_number, t.name
ORDER BY goals DESC;

-- Vista de jugadores con más exclusiones
CREATE OR REPLACE VIEW top_exclusions AS
SELECT
    p.id,
    p.name,
    p.cap_number,
    t.name as team_name,
    COUNT(*) as exclusions
FROM match_events me
JOIN players p ON p.id = me.player_id
JOIN teams t ON t.id = p.team_id
WHERE me.event_type = 'exclusion'
GROUP BY p.id, p.name, p.cap_number, t.name
ORDER BY exclusions DESC;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Función para crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'user'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger para crear perfil al registrar usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_dates ENABLE ROW LEVEL SECURITY;

-- Policies para profiles
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Policies para teams
CREATE POLICY "teams_select_all" ON teams FOR SELECT USING (true);
CREATE POLICY "teams_insert_admin" ON teams FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "teams_update_admin" ON teams FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "teams_delete_admin" ON teams FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Policies para players
CREATE POLICY "players_select_all" ON players FOR SELECT USING (true);
CREATE POLICY "players_insert_admin" ON players FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "players_update_admin" ON players FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "players_delete_admin" ON players FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Policies para tournaments
CREATE POLICY "tournaments_select_all" ON tournaments FOR SELECT USING (true);
CREATE POLICY "tournaments_insert_admin" ON tournaments FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "tournaments_update_admin_or_creator" ON tournaments FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') OR
    created_by = auth.uid()
);
CREATE POLICY "tournaments_delete_admin" ON tournaments FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Policies para tournament_users
CREATE POLICY "tournament_users_select_admin" ON tournament_users FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "tournament_users_manage_admin" ON tournament_users FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Policies para tournament_teams
CREATE POLICY "tournament_teams_select_all" ON tournament_teams FOR SELECT USING (true);
CREATE POLICY "tournament_teams_insert_admin" ON tournament_teams FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "tournament_teams_delete_admin" ON tournament_teams FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Policies para groups
CREATE POLICY "groups_select_all" ON groups FOR SELECT USING (true);
CREATE POLICY "groups_insert_admin" ON groups FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "groups_update_admin" ON groups FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "groups_delete_admin" ON groups FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Policies para group_members
CREATE POLICY "group_members_select_all" ON group_members FOR SELECT USING (true);
CREATE POLICY "group_members_insert_admin" ON group_members FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "group_members_update_admin" ON group_members FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "group_members_delete_admin" ON group_members FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Policies para tournament_phases
CREATE POLICY "tournament_phases_select_all" ON tournament_phases FOR SELECT USING (true);
CREATE POLICY "tournament_phases_insert_admin" ON tournament_phases FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "tournament_phases_update_admin" ON tournament_phases FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "tournament_phases_delete_admin" ON tournament_phases FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Policies para matches
CREATE POLICY "matches_select_all" ON matches FOR SELECT USING (true);
CREATE POLICY "matches_insert_authenticated" ON matches FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "matches_update_own" ON matches FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "matches_delete_own" ON matches FOR DELETE USING (created_by = auth.uid());

-- Policies para match_events
CREATE POLICY "match_events_select_all" ON match_events FOR SELECT USING (true);
CREATE POLICY "match_events_insert_authenticated" ON match_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "match_events_update_authenticated" ON match_events FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "match_events_delete_authenticated" ON match_events FOR DELETE USING (auth.uid() IS NOT NULL);

-- Policies para tournament_config
CREATE POLICY "tournament_config_select_all" ON tournament_config FOR SELECT USING (true);
CREATE POLICY "tournament_config_insert_admin" ON tournament_config FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "tournament_config_update_admin" ON tournament_config FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "tournament_config_delete_admin" ON tournament_config FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Policies para tournament_dates
CREATE POLICY "tournament_dates_select_all" ON tournament_dates FOR SELECT USING (true);
CREATE POLICY "tournament_dates_insert_admin" ON tournament_dates FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "tournament_dates_update_admin" ON tournament_dates FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "tournament_dates_delete_admin" ON tournament_dates FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- INDICES
-- ============================================

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_team_a_id ON matches(team_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_team_b_id ON matches(team_b_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_player_id ON match_events(player_id);
CREATE INDEX IF NOT EXISTS idx_match_events_event_type ON match_events(event_type);
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_team_id ON group_members(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament_id ON tournament_teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_users_tournament_id ON tournament_users(tournament_id);
