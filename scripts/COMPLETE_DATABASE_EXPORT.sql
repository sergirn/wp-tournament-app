-- =====================================================
-- WATERPOLO TOURNAMENT MANAGER - COMPLETE DATABASE EXPORT
-- Generated: 2025
-- =====================================================

-- =====================================================
-- 1. EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 2. TABLES
-- =====================================================

-- Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Teams table
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Players table
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cap_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(team_id, cap_number)
);

-- Tournaments table
CREATE TABLE IF NOT EXISTS public.tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT DEFAULT 'league' CHECK (type IN ('league', 'knockout', 'mixed')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
    points_win INTEGER DEFAULT 3,
    points_draw INTEGER DEFAULT 1,
    points_loss INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Tournament teams (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.tournament_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(tournament_id, team_id)
);

-- Groups table
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(tournament_id, name)
);

-- Group members (teams in groups)
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(group_id, team_id)
);

-- Tournament phases (for knockout stages)
CREATE TABLE IF NOT EXISTS public.tournament_phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phase_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Matches table
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    phase_id UUID REFERENCES public.tournament_phases(id) ON DELETE SET NULL,
    team_a_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    team_b_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    team_a_score INTEGER DEFAULT 0,
    team_b_score INTEGER DEFAULT 0,
    match_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    location TEXT,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    comments TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Match events (goals, exclusions, etc.)
CREATE TABLE IF NOT EXISTS public.match_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('goal', 'exclusion', 'penalty', 'timeout')),
    quarter INTEGER CHECK (quarter BETWEEN 1 AND 4),
    time_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Tournament dates/events
CREATE TABLE IF NOT EXISTS public.tournament_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Tournament configuration
CREATE TABLE IF NOT EXISTS public.tournament_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    points_win INTEGER DEFAULT 3,
    points_draw INTEGER DEFAULT 1,
    points_loss INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Tournament users (users specific to a tournament)
CREATE TABLE IF NOT EXISTS public.tournament_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(tournament_id, email)
);

-- =====================================================
-- 3. VIEWS
-- =====================================================

-- Top scorers view
CREATE OR REPLACE VIEW public.top_scorers AS
SELECT 
    p.id,
    p.name,
    p.cap_number,
    t.name AS team_name,
    COUNT(me.id) AS goals
FROM 
    public.players p
    INNER JOIN public.teams t ON p.team_id = t.id
    INNER JOIN public.match_events me ON me.player_id = p.id
WHERE 
    me.event_type = 'goal'
GROUP BY 
    p.id, p.name, p.cap_number, t.name
ORDER BY 
    goals DESC;

-- Top exclusions view
CREATE OR REPLACE VIEW public.top_exclusions AS
SELECT 
    p.id,
    p.name,
    p.cap_number,
    t.name AS team_name,
    COUNT(me.id) AS exclusions
FROM 
    public.players p
    INNER JOIN public.teams t ON p.team_id = t.id
    INNER JOIN public.match_events me ON me.player_id = p.id
WHERE 
    me.event_type = 'exclusion'
GROUP BY 
    p.id, p.name, p.cap_number, t.name
ORDER BY 
    exclusions DESC;

-- Tournament standings view (comprehensive)
CREATE OR REPLACE VIEW public.tournament_standings AS
SELECT
    gm.team_id,
    g.id AS group_id,
    g.tournament_id,
    g.name AS group_name,
    t.name AS team_name,
    COALESCE(COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed'), 0)::BIGINT AS matches_played,
    COALESCE(COUNT(DISTINCT m.id) FILTER (
        WHERE m.status = 'completed' 
        AND ((m.team_a_id = gm.team_id AND m.team_a_score > m.team_b_score) 
             OR (m.team_b_id = gm.team_id AND m.team_b_score > m.team_a_score))
    ), 0)::BIGINT AS wins,
    COALESCE(COUNT(DISTINCT m.id) FILTER (
        WHERE m.status = 'completed' 
        AND m.team_a_score = m.team_b_score
    ), 0)::BIGINT AS draws,
    COALESCE(COUNT(DISTINCT m.id) FILTER (
        WHERE m.status = 'completed' 
        AND ((m.team_a_id = gm.team_id AND m.team_a_score < m.team_b_score) 
             OR (m.team_b_id = gm.team_id AND m.team_b_score < m.team_a_score))
    ), 0)::BIGINT AS losses,
    COALESCE(SUM(CASE 
        WHEN m.team_a_id = gm.team_id THEN m.team_a_score 
        WHEN m.team_b_id = gm.team_id THEN m.team_b_score 
        ELSE 0 
    END) FILTER (WHERE m.status = 'completed'), 0)::BIGINT AS goals_for,
    COALESCE(SUM(CASE 
        WHEN m.team_a_id = gm.team_id THEN m.team_b_score 
        WHEN m.team_b_id = gm.team_id THEN m.team_a_score 
        ELSE 0 
    END) FILTER (WHERE m.status = 'completed'), 0)::BIGINT AS goals_against,
    COALESCE(SUM(CASE 
        WHEN m.team_a_id = gm.team_id THEN (m.team_a_score - m.team_b_score)
        WHEN m.team_b_id = gm.team_id THEN (m.team_b_score - m.team_a_score)
        ELSE 0 
    END) FILTER (WHERE m.status = 'completed'), 0)::BIGINT AS goal_difference,
    COALESCE(SUM(CASE 
        WHEN m.status = 'completed' AND ((m.team_a_id = gm.team_id AND m.team_a_score > m.team_b_score) OR (m.team_b_id = gm.team_id AND m.team_b_score > m.team_a_score)) 
            THEN 3
        WHEN m.status = 'completed' AND m.team_a_score = m.team_b_score 
            THEN 1
        ELSE 0 
    END), 0)::BIGINT AS points
FROM
    public.group_members gm
    INNER JOIN public.groups g ON gm.group_id = g.id
    INNER JOIN public.teams t ON gm.team_id = t.id
    LEFT JOIN public.matches m ON 
        (m.team_a_id = gm.team_id OR m.team_b_id = gm.team_id)
        AND m.group_id = gm.group_id
        AND m.tournament_id = g.tournament_id
GROUP BY
    gm.team_id, g.id, g.tournament_id, g.name, t.name
ORDER BY
    g.tournament_id, g.name, points DESC, goal_difference DESC, goals_for DESC;

-- =====================================================
-- 4. FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    RETURN NEW;
END;
$$;

-- Trigger to automatically create profile for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for tournaments updated_at
DROP TRIGGER IF EXISTS update_tournaments_updated_at ON public.tournaments;
CREATE TRIGGER update_tournaments_updated_at
    BEFORE UPDATE ON public.tournaments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for matches updated_at
DROP TRIGGER IF EXISTS update_matches_updated_at ON public.matches;
CREATE TRIGGER update_matches_updated_at
    BEFORE UPDATE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_users ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY profiles_select_all ON public.profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Teams policies
CREATE POLICY teams_select_all ON public.teams FOR SELECT USING (true);
CREATE POLICY teams_insert_admin ON public.teams FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY teams_update_admin ON public.teams FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY teams_delete_admin ON public.teams FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Players policies
CREATE POLICY players_select_all ON public.players FOR SELECT USING (true);
CREATE POLICY players_insert_admin ON public.players FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY players_update_admin ON public.players FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY players_delete_admin ON public.players FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Tournaments policies
CREATE POLICY tournaments_select_all ON public.tournaments FOR SELECT USING (true);
CREATE POLICY tournaments_insert_admin ON public.tournaments FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY tournaments_update_admin_or_creator ON public.tournaments FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR created_by = auth.uid()
);
CREATE POLICY tournaments_delete_admin ON public.tournaments FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Tournament teams policies
CREATE POLICY tournament_teams_select_all ON public.tournament_teams FOR SELECT USING (true);
CREATE POLICY tournament_teams_insert_admin ON public.tournament_teams FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY tournament_teams_delete_admin ON public.tournament_teams FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Groups policies
CREATE POLICY groups_select_all ON public.groups FOR SELECT USING (true);
CREATE POLICY groups_insert_admin ON public.groups FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY groups_update_admin ON public.groups FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY groups_delete_admin ON public.groups FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Group members policies
CREATE POLICY group_members_select_all ON public.group_members FOR SELECT USING (true);
CREATE POLICY group_members_insert_admin ON public.group_members FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY group_members_update_admin ON public.group_members FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY group_members_delete_admin ON public.group_members FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Tournament phases policies
CREATE POLICY tournament_phases_select_all ON public.tournament_phases FOR SELECT USING (true);
CREATE POLICY tournament_phases_insert_admin ON public.tournament_phases FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY tournament_phases_update_admin ON public.tournament_phases FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY tournament_phases_delete_admin ON public.tournament_phases FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Matches policies
CREATE POLICY matches_select_all ON public.matches FOR SELECT USING (true);
CREATE POLICY matches_insert_authenticated ON public.matches FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY matches_update_own ON public.matches FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY matches_delete_own ON public.matches FOR DELETE USING (created_by = auth.uid());

-- Match events policies
CREATE POLICY match_events_select_all ON public.match_events FOR SELECT USING (true);
CREATE POLICY match_events_insert_authenticated ON public.match_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY match_events_update_authenticated ON public.match_events FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY match_events_delete_authenticated ON public.match_events FOR DELETE USING (auth.uid() IS NOT NULL);

-- Tournament dates policies
CREATE POLICY tournament_dates_select_all ON public.tournament_dates FOR SELECT USING (true);
CREATE POLICY tournament_dates_insert_admin ON public.tournament_dates FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY tournament_dates_update_admin ON public.tournament_dates FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY tournament_dates_delete_admin ON public.tournament_dates FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Tournament config policies
CREATE POLICY tournament_config_select_all ON public.tournament_config FOR SELECT USING (true);
CREATE POLICY tournament_config_insert_admin ON public.tournament_config FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY tournament_config_update_admin ON public.tournament_config FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY tournament_config_delete_admin ON public.tournament_config FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Tournament users policies
CREATE POLICY tournament_users_select_admin ON public.tournament_users FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY tournament_users_manage_admin ON public.tournament_users FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =====================================================
-- 6. INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for players
CREATE INDEX IF NOT EXISTS idx_players_team_id ON public.players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_cap_number ON public.players(cap_number);

-- Indexes for tournaments
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON public.tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_by ON public.tournaments(created_by);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_at ON public.tournaments(created_at DESC);

-- Indexes for tournament_teams
CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament_id ON public.tournament_teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_team_id ON public.tournament_teams(team_id);

-- Indexes for groups
CREATE INDEX IF NOT EXISTS idx_groups_tournament_id ON public.groups(tournament_id);

-- Indexes for group_members
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_team_id ON public.group_members(team_id);

-- Indexes for matches
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON public.matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_group_id ON public.matches(group_id);
CREATE INDEX IF NOT EXISTS idx_matches_phase_id ON public.matches(phase_id);
CREATE INDEX IF NOT EXISTS idx_matches_team_a_id ON public.matches(team_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_team_b_id ON public.matches(team_b_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_match_date ON public.matches(match_date DESC);

-- Indexes for match_events
CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON public.match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_player_id ON public.match_events(player_id);
CREATE INDEX IF NOT EXISTS idx_match_events_event_type ON public.match_events(event_type);

-- Indexes for tournament_users
CREATE INDEX IF NOT EXISTS idx_tournament_users_tournament_id ON public.tournament_users(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_users_email ON public.tournament_users(email);

-- =====================================================
-- END OF EXPORT
-- =====================================================

-- To restore this database:
-- 1. Create a new Supabase project or PostgreSQL database
-- 2. Run this SQL script
-- 3. Configure authentication settings in Supabase dashboard
-- 4. Set up storage buckets if needed for team logos
-- 5. Update environment variables in your application
