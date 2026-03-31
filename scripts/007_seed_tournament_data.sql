-- Datos de ejemplo para torneos con grupos

-- Crear más equipos de ejemplo
insert into public.teams (name) values
  ('CN Terrassa'),
  ('CE Mediterrani'),
  ('CN Mataró'),
  ('Waterpolo Tenerife Echeyde'),
  ('Club Waterpolo Sevilla'),
  ('CN Pontevedra'),
  ('CN Ciudad de Dos Hermanas'),
  ('CN Granollers'),
  ('Tenerife Echeyde'),
  ('CN Sant Andreu')
on conflict do nothing;

-- Crear jugadores para los equipos nuevos
do $$
declare
  team_record record;
begin
  for team_record in 
    select id, name from public.teams 
    where name in ('CN Terrassa', 'CE Mediterrani', 'CN Mataró', 'Waterpolo Tenerife Echeyde', 
                   'Club Waterpolo Sevilla', 'CN Pontevedra', 'CN Ciudad de Dos Hermanas', 
                   'CN Granollers', 'Tenerife Echeyde', 'CN Sant Andreu')
  loop
    insert into public.players (team_id, name, cap_number)
    select team_record.id, 'Jugador ' || generate_series::text, generate_series
    from generate_series(1, 13)
    on conflict do nothing;
  end loop;
end $$;

-- Crear un torneo de ejemplo con grupos
insert into public.tournament_config (name, type, points_win, points_draw, points_loss, active)
values ('Campeonato Nacional 2025', 'groups', 3, 1, 0, true)
on conflict do nothing;

-- Crear grupos del torneo
do $$
declare
  tournament_id uuid;
  group_a_id uuid;
  group_b_id uuid;
  group_c_id uuid;
  group_d_id uuid;
begin
  -- Obtener el ID del torneo
  select id into tournament_id from public.tournament_config where name = 'Campeonato Nacional 2025' limit 1;
  
  if tournament_id is not null then
    -- Crear grupos
    insert into public.tournament_groups (tournament_id, name, order_number)
    values (tournament_id, 'Grupo A', 1)
    returning id into group_a_id;
    
    insert into public.tournament_groups (tournament_id, name, order_number)
    values (tournament_id, 'Grupo B', 2)
    returning id into group_b_id;
    
    insert into public.tournament_groups (tournament_id, name, order_number)
    values (tournament_id, 'Grupo C', 3)
    returning id into group_c_id;
    
    insert into public.tournament_groups (tournament_id, name, order_number)
    values (tournament_id, 'Grupo D', 4)
    returning id into group_d_id;
    
    -- Asignar equipos a Grupo A
    insert into public.group_teams (group_id, team_id)
    select group_a_id, id from public.teams where name in ('Real Canoe', 'CN Atlètic Barceloneta', 'CN Sabadell', 'Zodiac CN Atlètic')
    on conflict do nothing;
    
    -- Asignar equipos a Grupo B
    insert into public.group_teams (group_id, team_id)
    select group_b_id, id from public.teams where name in ('CN Barcelona', 'Astralpool CN Sabadell', 'CN Terrassa', 'CE Mediterrani')
    on conflict do nothing;
    
    -- Asignar equipos a Grupo C
    insert into public.group_teams (group_id, team_id)
    select group_c_id, id from public.teams where name in ('CN Mataró', 'Waterpolo Tenerife Echeyde', 'Club Waterpolo Sevilla', 'CN Pontevedra')
    on conflict do nothing;
    
    -- Asignar equipos a Grupo D
    insert into public.group_teams (group_id, team_id)
    select group_d_id, id from public.teams where name in ('CN Ciudad de Dos Hermanas', 'CN Granollers', 'Tenerife Echeyde', 'CN Sant Andreu')
    on conflict do nothing;
    
    -- Crear fases del torneo
    insert into public.tournament_phases (tournament_id, name, phase_order)
    values 
      (tournament_id, 'Cuartos de Final', 1),
      (tournament_id, 'Semifinales', 2),
      (tournament_id, 'Final', 3);
  end if;
end $$;
