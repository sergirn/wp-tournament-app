begin;

create table if not exists public.tournament_bracket_seed_slots (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  source_phase_id uuid not null references public.tournament_phases(id) on delete cascade,
  node_id uuid not null references public.tournament_bracket_nodes(id) on delete cascade,
  node_slot text not null check (node_slot in ('A', 'B')),
  source_group_id uuid not null references public.groups(id) on delete cascade,
  source_position integer not null check (source_position > 0),
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (node_id, node_slot),
  unique (tournament_id, source_phase_id, source_group_id, source_position)
);

create index if not exists bracket_seed_slots_source_idx
  on public.tournament_bracket_seed_slots(tournament_id, source_phase_id);

commit;
notify pgrst, 'reload schema';
