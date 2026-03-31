-- Vista para calcular la clasificación de equipos por grupo

create or replace view public.group_standings as
select
  gt.group_id,
  tg.name as group_name,
  t.id as team_id,
  t.name as team_name,
  count(m.id) as matches_played,
  sum(case 
    when m.team_a_id = t.id and m.team_a_score > m.team_b_score then 1
    when m.team_b_id = t.id and m.team_b_score > m.team_a_score then 1
    else 0
  end) as wins,
  sum(case 
    when m.status = 'finished' and m.team_a_score = m.team_b_score then 1
    else 0
  end) as draws,
  sum(case 
    when m.team_a_id = t.id and m.team_a_score < m.team_b_score then 1
    when m.team_b_id = t.id and m.team_b_score < m.team_a_score then 1
    else 0
  end) as losses,
  sum(case 
    when m.team_a_id = t.id then m.team_a_score
    when m.team_b_id = t.id then m.team_b_score
    else 0
  end) as goals_for,
  sum(case 
    when m.team_a_id = t.id then m.team_b_score
    when m.team_b_id = t.id then m.team_a_score
    else 0
  end) as goals_against,
  sum(case 
    when m.team_a_id = t.id then m.team_a_score - m.team_b_score
    when m.team_b_id = t.id then m.team_b_score - m.team_a_score
    else 0
  end) as goal_difference,
  sum(case 
    when m.team_a_id = t.id and m.team_a_score > m.team_b_score then 3
    when m.team_b_id = t.id and m.team_b_score > m.team_a_score then 3
    when m.status = 'finished' and m.team_a_score = m.team_b_score then 1
    else 0
  end) as points
from
  public.group_teams gt
  inner join public.teams t on gt.team_id = t.id
  inner join public.tournament_groups tg on gt.group_id = tg.id
  left join public.matches m on 
    (m.team_a_id = t.id or m.team_b_id = t.id)
    and m.group_id = gt.group_id
    and m.status = 'finished'
group by
  gt.group_id, tg.name, t.id, t.name
order by
  gt.group_id, points desc, goal_difference desc, goals_for desc;
