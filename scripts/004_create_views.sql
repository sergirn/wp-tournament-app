-- Vista para estadísticas de goleadores
create or replace view public.top_scorers as
select 
  p.id,
  p.name,
  p.cap_number,
  t.name as team_name,
  count(me.id) as goals
from public.players p
left join public.teams t on p.team_id = t.id
left join public.match_events me on p.id = me.player_id and me.event_type = 'goal'
group by p.id, p.name, p.cap_number, t.name
order by goals desc;

-- Vista para estadísticas de exclusiones
create or replace view public.top_exclusions as
select 
  p.id,
  p.name,
  p.cap_number,
  t.name as team_name,
  count(me.id) as exclusions
from public.players p
left join public.teams t on p.team_id = t.id
left join public.match_events me on p.id = me.player_id and me.event_type = 'exclusion'
group by p.id, p.name, p.cap_number, t.name
order by exclusions desc;
