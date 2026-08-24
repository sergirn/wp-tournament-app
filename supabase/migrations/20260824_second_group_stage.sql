begin;

alter table public.groups
  add column if not exists phase_id uuid references public.tournament_phases(id) on delete cascade;

alter table public.tournament_qualification_config
  add column if not exists source_phase_id uuid references public.tournament_phases(id) on delete set null;

create table if not exists public.tournament_group_stage_config (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  source_phase_id uuid references public.tournament_phases(id) on delete cascade,
  target_phase_id uuid not null references public.tournament_phases(id) on delete cascade,
  qualifiers_per_group integer not null default 2 check (qualifiers_per_group > 0),
  status text not null default 'generated' check (status in ('draft', 'generated', 'locked')),
  configured_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, target_phase_id)
);

create table if not exists public.tournament_group_stage_slots (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  phase_id uuid not null references public.tournament_phases(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  slot_order integer not null check (slot_order > 0),
  source_group_id uuid not null references public.groups(id) on delete cascade,
  source_position integer not null check (source_position > 0),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, slot_order),
  unique (phase_id, source_group_id, source_position),
  unique (phase_id, team_id)
);

create index if not exists groups_tournament_phase_idx
  on public.groups(tournament_id, phase_id);
create index if not exists matches_tournament_phase_group_idx
  on public.matches(tournament_id, phase_id, group_id);
create index if not exists group_stage_slots_phase_idx
  on public.tournament_group_stage_slots(phase_id, group_id);

-- Convierte los grupos antiguos en la primera fase sin alterar sus miembros ni partidos.
do $$
declare
  tournament_row record;
  new_phase_id uuid;
begin
  for tournament_row in
    select distinct g.tournament_id
    from public.groups g
    where g.phase_id is null
  loop
    select tp.id into new_phase_id
    from public.tournament_phases tp
    where tp.tournament_id = tournament_row.tournament_id
      and tp.phase_type = 'group'
    order by tp.phase_order
    limit 1;

    if new_phase_id is null then
      insert into public.tournament_phases (tournament_id, name, phase_order, phase_type)
      values (tournament_row.tournament_id, 'Fase de grupos 1', 1, 'group')
      returning id into new_phase_id;
    end if;

    update public.groups
    set phase_id = new_phase_id
    where tournament_id = tournament_row.tournament_id
      and phase_id is null;

    update public.matches m
    set phase_id = new_phase_id
    where m.tournament_id = tournament_row.tournament_id
      and m.group_id is not null
      and m.phase_id is null;
  end loop;
end $$;

commit;

-- Obliga a PostgREST/Supabase a detectar inmediatamente las nuevas columnas.
notify pgrst, 'reload schema';
