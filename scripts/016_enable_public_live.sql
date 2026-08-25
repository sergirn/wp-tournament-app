-- Habilita los cambios de marcador y acta en Supabase Realtime.
-- Es seguro ejecutar este bloque más de una vez.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'match_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;
  END IF;
END $$;
