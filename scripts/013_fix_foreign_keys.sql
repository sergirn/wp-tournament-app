-- Fix foreign key constraints to point to the tournaments table
-- Drop old foreign key constraints that may be causing issues

-- Fix groups table foreign key
ALTER TABLE groups 
DROP CONSTRAINT IF EXISTS tournament_groups_tournament_id_fkey;

ALTER TABLE groups
ADD CONSTRAINT groups_tournament_id_fkey 
FOREIGN KEY (tournament_id) 
REFERENCES tournaments(id) 
ON DELETE CASCADE;

-- Fix group_members table foreign keys
ALTER TABLE group_members
DROP CONSTRAINT IF EXISTS group_teams_group_id_fkey;

ALTER TABLE group_members
ADD CONSTRAINT group_members_group_id_fkey 
FOREIGN KEY (group_id) 
REFERENCES groups(id) 
ON DELETE CASCADE;

ALTER TABLE group_members
DROP CONSTRAINT IF EXISTS group_teams_team_id_fkey;

ALTER TABLE group_members
ADD CONSTRAINT group_members_team_id_fkey 
FOREIGN KEY (team_id) 
REFERENCES teams(id) 
ON DELETE CASCADE;

-- Fix matches table foreign keys
ALTER TABLE matches
DROP CONSTRAINT IF EXISTS matches_tournament_id_fkey;

ALTER TABLE matches
ADD CONSTRAINT matches_tournament_id_fkey 
FOREIGN KEY (tournament_id) 
REFERENCES tournaments(id) 
ON DELETE CASCADE;

ALTER TABLE matches
DROP CONSTRAINT IF EXISTS matches_group_id_fkey;

ALTER TABLE matches
ADD CONSTRAINT matches_group_id_fkey 
FOREIGN KEY (group_id) 
REFERENCES groups(id) 
ON DELETE SET NULL;

-- Fix tournament_teams table foreign key
ALTER TABLE tournament_teams
DROP CONSTRAINT IF EXISTS tournament_teams_tournament_id_fkey;

ALTER TABLE tournament_teams
ADD CONSTRAINT tournament_teams_tournament_id_fkey 
FOREIGN KEY (tournament_id) 
REFERENCES tournaments(id) 
ON DELETE CASCADE;

-- Fix tournament_phases table foreign key
ALTER TABLE tournament_phases
DROP CONSTRAINT IF EXISTS tournament_phases_tournament_id_fkey;

ALTER TABLE tournament_phases
ADD CONSTRAINT tournament_phases_tournament_id_fkey 
FOREIGN KEY (tournament_id) 
REFERENCES tournaments(id) 
ON DELETE CASCADE;

-- Fix tournament_users table foreign key
ALTER TABLE tournament_users
DROP CONSTRAINT IF EXISTS tournament_users_tournament_id_fkey;

ALTER TABLE tournament_users
ADD CONSTRAINT tournament_users_tournament_id_fkey 
FOREIGN KEY (tournament_id) 
REFERENCES tournaments(id) 
ON DELETE CASCADE;
