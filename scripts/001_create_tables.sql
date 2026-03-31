-- Tabla de perfiles de usuario
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text default 'user' check (role in ('admin', 'user')),
  created_at timestamptz default now()
);

-- Tabla de equipos
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  created_at timestamptz default now()
);

-- Tabla de jugadores
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  name text not null,
  cap_number integer not null,
  created_at timestamptz default now(),
  unique(team_id, cap_number)
);

-- Tabla de partidos
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  team_a_id uuid references public.teams(id) on delete cascade,
  team_b_id uuid references public.teams(id) on delete cascade,
  team_a_score integer default 0,
  team_b_score integer default 0,
  match_date timestamptz not null,
  location text,
  status text default 'scheduled' check (status in ('scheduled', 'in_progress', 'finished')),
  comments text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabla de eventos de partido (goles, expulsiones)
create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade,
  player_id uuid references public.players(id) on delete cascade,
  event_type text not null check (event_type in ('goal', 'exclusion')),
  quarter integer check (quarter between 1 and 4),
  time_minutes integer,
  created_at timestamptz default now()
);

-- Tabla de fechas del torneo (para calendario)
create table if not exists public.tournament_dates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date timestamptz not null,
  description text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
alter table public.tournament_dates enable row level security;

-- Policies para profiles
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Policies para teams (todos pueden ver, solo admins pueden modificar)
create policy "teams_select_all"
  on public.teams for select
  using (true);

create policy "teams_insert_admin"
  on public.teams for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "teams_update_admin"
  on public.teams for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "teams_delete_admin"
  on public.teams for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Policies para players
create policy "players_select_all"
  on public.players for select
  using (true);

create policy "players_insert_admin"
  on public.players for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "players_update_admin"
  on public.players for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "players_delete_admin"
  on public.players for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Policies para matches
create policy "matches_select_all"
  on public.matches for select
  using (true);

create policy "matches_insert_authenticated"
  on public.matches for insert
  with check (auth.uid() = created_by);

create policy "matches_update_own"
  on public.matches for update
  using (auth.uid() = created_by);

create policy "matches_delete_own"
  on public.matches for delete
  using (auth.uid() = created_by);

-- Policies para match_events
create policy "match_events_select_all"
  on public.match_events for select
  using (true);

create policy "match_events_insert_authenticated"
  on public.match_events for insert
  with check (
    exists (
      select 1 from public.matches
      where id = match_id and created_by = auth.uid()
    )
  );

create policy "match_events_update_authenticated"
  on public.match_events for update
  using (
    exists (
      select 1 from public.matches
      where id = match_id and created_by = auth.uid()
    )
  );

create policy "match_events_delete_authenticated"
  on public.match_events for delete
  using (
    exists (
      select 1 from public.matches
      where id = match_id and created_by = auth.uid()
    )
  );

-- Policies para tournament_dates
create policy "tournament_dates_select_all"
  on public.tournament_dates for select
  using (true);

create policy "tournament_dates_insert_admin"
  on public.tournament_dates for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "tournament_dates_update_admin"
  on public.tournament_dates for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "tournament_dates_delete_admin"
  on public.tournament_dates for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
