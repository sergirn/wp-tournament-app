-- Add admin role to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Update existing users (first user becomes admin)
UPDATE profiles SET role = 'admin' WHERE id = (SELECT id FROM profiles ORDER BY created_at LIMIT 1);

-- Update RLS policies to check for admin role
DROP POLICY IF EXISTS "Allow admin to manage teams" ON teams;
CREATE POLICY "Allow admin to manage teams"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "Allow admin to manage tournament config" ON tournament_config;
CREATE POLICY "Allow admin to manage tournament config"
  ON tournament_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "Allow admin to manage groups" ON tournament_groups;
CREATE POLICY "Allow admin to manage groups"
  ON tournament_groups
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "Allow admin to manage group teams" ON group_teams;
CREATE POLICY "Allow admin to manage group teams"
  ON group_teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Allow everyone to view
DROP POLICY IF EXISTS "Allow all to view teams" ON teams;
CREATE POLICY "Allow all to view teams"
  ON teams
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow all to view tournament config" ON tournament_config;
CREATE POLICY "Allow all to view tournament config"
  ON tournament_config
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow all to view groups" ON tournament_groups;
CREATE POLICY "Allow all to view groups"
  ON tournament_groups
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow all to view group teams" ON group_teams;
CREATE POLICY "Allow all to view group teams"
  ON group_teams
  FOR SELECT
  TO authenticated
  USING (true);
