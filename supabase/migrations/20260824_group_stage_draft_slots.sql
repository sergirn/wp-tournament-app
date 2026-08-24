begin;

alter table public.tournament_group_stage_slots
  alter column team_id drop not null;

commit;
notify pgrst, 'reload schema';
