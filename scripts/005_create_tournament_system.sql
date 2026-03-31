-- Sistema de configuración de torneos con grupos y fases

-- Tabla de configuración de torneo
create table if not exists public.tournament_config (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('league', 'groups')),
  points_win integer default 3,
  points_draw integer default 1,
  points_loss integer default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- Tabla de grupos del torneo
create table if not exists public.tournament_groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournament_config(id) on delete cascade,
  name text not null,
  order_number integer not null,
  created_at timestamptz default now()
);

-- Tabla de equipos en grupos
create table if not exists public.group_teams (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.tournament_groups(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  created_at timestamptz default now(),
  unique(group_id, team_id)
);

-- Tabla de fases del torneo (cuartos, semis, final)
create table if not exists public.tournament_phases (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournament_config(id) on delete cascade,
  name text not null,
  phase_order integer not null,
  created_at timestamptz default now()
);

-- Actualizar tabla de partidos para incluir grupo y fase
alter table public.matches 
  add column if not exists group_id uuid references public.tournament_groups(id) on delete set null,
  add column if not exists phase_id uuid references public.tournament_phases(id) on delete set null;

-- Enable RLS
alter table public.tournament_config enable row level security;
alter table public.tournament_groups enable row level security;
alter table public.group_teams enable row level security;
alter table public.tournament_phases enable row level security;

-- Policies para tournament_config
create policy "tournament_config_select_all"
  on public.tournament_config for select
  using (true);

create policy "tournament_config_insert_admin"
  on public.tournament_config for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "tournament_config_update_admin"
  on public.tournament_config for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "tournament_config_delete_admin"
  on public.tournament_config for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Policies para tournament_groups
create policy "tournament_groups_select_all"
  on public.tournament_groups for select
  using (true);

create policy "tournament_groups_insert_admin"
  on public.tournament_groups for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "tournament_groups_update_admin"
  on public.tournament_groups for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "tournament_groups_delete_admin"
  on public.tournament_groups for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Policies para group_teams
create policy "group_teams_select_all"
  on public.group_teams for select
  using (true);

create policy "group_teams_insert_admin"
  on public.group_teams for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "group_teams_update_admin"
  on public.group_teams for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "group_teams_delete_admin"
  on public.group_teams for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Policies para tournament_phases
create policy "tournament_phases_select_all"
  on public.tournament_phases for select
  using (true);

create policy "tournament_phases_insert_admin"
  on public.tournament_phases for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "tournament_phases_update_admin"
  on public.tournament_phases for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "tournament_phases_delete_admin"
  on public.tournament_phases for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
