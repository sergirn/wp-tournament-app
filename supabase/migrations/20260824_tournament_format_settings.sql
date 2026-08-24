begin;

create table if not exists public.tournament_format_config (
  tournament_id uuid primary key references public.tournaments(id) on delete cascade,
  progression_mode text not null default 'direct_knockout'
    check (progression_mode in ('direct_knockout', 'second_group_stage')),
  qualifiers_from_first_phase integer not null default 2
    check (qualifiers_from_first_phase > 0),
  second_stage_group_count integer
    check (second_stage_group_count is null or second_stage_group_count > 0),
  qualifiers_from_second_phase integer
    check (qualifiers_from_second_phase is null or qualifiers_from_second_phase > 0),
  configured_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.tournament_format_config (
  tournament_id,
  progression_mode,
  qualifiers_from_first_phase,
  second_stage_group_count,
  qualifiers_from_second_phase
)
select
  t.id,
  case when exists (
    select 1
    from public.tournament_group_stage_config sg
    where sg.tournament_id = t.id
  ) then 'second_group_stage' else 'direct_knockout' end,
  coalesce(q.qualifiers_per_group, 2),
  case when exists (select 1 from public.tournament_group_stage_config sg where sg.tournament_id = t.id) then (
    select count(*)::integer
    from public.groups g
    join public.tournament_group_stage_config sg on sg.target_phase_id = g.phase_id
    where sg.tournament_id = t.id
  ) else null end,
  (
    select sg.qualifiers_per_group
    from public.tournament_group_stage_config sg
    where sg.tournament_id = t.id
    order by sg.created_at desc
    limit 1
  )
from public.tournaments t
left join public.tournament_qualification_config q on q.tournament_id = t.id
where t.type = 'groups'
on conflict (tournament_id) do nothing;

commit;
notify pgrst, 'reload schema';
