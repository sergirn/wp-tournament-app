-- Datos de ejemplo para el torneo

-- Insertar equipos de ejemplo
insert into public.teams (name) values
  ('Real Canoe'),
  ('CN Atlètic Barceloneta'),
  ('CN Sabadell'),
  ('Zodiac CN Atlètic'),
  ('CN Barcelona'),
  ('Astralpool CN Sabadell')
on conflict do nothing;

-- Insertar jugadores de ejemplo para cada equipo
-- Team 1: Real Canoe
insert into public.players (team_id, name, cap_number)
select id, 'Jugador ' || generate_series::text, generate_series
from public.teams, generate_series(1, 13)
where name = 'Real Canoe'
on conflict do nothing;

-- Team 2: CN Atlètic Barceloneta
insert into public.players (team_id, name, cap_number)
select id, 'Jugador ' || generate_series::text, generate_series
from public.teams, generate_series(1, 13)
where name = 'CN Atlètic Barceloneta'
on conflict do nothing;

-- Insertar fechas del torneo
insert into public.tournament_dates (title, date, description) values
  ('Jornada 1', now() + interval '1 day', 'Primera jornada del torneo'),
  ('Jornada 2', now() + interval '8 days', 'Segunda jornada del torneo'),
  ('Jornada 3', now() + interval '15 days', 'Tercera jornada del torneo'),
  ('Semifinales', now() + interval '22 days', 'Semifinales del torneo'),
  ('Final', now() + interval '29 days', 'Final del torneo')
on conflict do nothing;

-- Insertar algunos partidos de ejemplo
insert into public.matches (team_a_id, team_b_id, team_a_score, team_b_score, match_date, status)
select 
  (select id from public.teams where name = 'Real Canoe'),
  (select id from public.teams where name = 'CN Atlètic Barceloneta'),
  8, 7, now() - interval '7 days', 'finished';

insert into public.matches (team_a_id, team_b_id, team_a_score, team_b_score, match_date, status)
select 
  (select id from public.teams where name = 'CN Sabadell'),
  (select id from public.teams where name = 'Zodiac CN Atlètic'),
  10, 9, now() - interval '6 days', 'finished';
