-- Reels music (Instagram-style "add song to reel") + saved songs

-- 1. Music info on reels
ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS music_track_id     TEXT,
  ADD COLUMN IF NOT EXISTS music_title        TEXT,
  ADD COLUMN IF NOT EXISTS music_artist       TEXT,
  ADD COLUMN IF NOT EXISTS music_artwork_url  TEXT,
  ADD COLUMN IF NOT EXISTS music_preview_url  TEXT,
  ADD COLUMN IF NOT EXISTS music_start_ms     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS music_duration_ms  INTEGER,
  ADD COLUMN IF NOT EXISTS mute_original      BOOLEAN DEFAULT FALSE;

-- 2. Saved songs (user ke "saved" gaane)
CREATE TABLE IF NOT EXISTS public.saved_songs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id    TEXT NOT NULL,
  title       TEXT NOT NULL,
  artist      TEXT NOT NULL,
  artwork_url TEXT,
  preview_url TEXT NOT NULL,
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, track_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_songs TO authenticated;
GRANT ALL ON public.saved_songs TO service_role;

ALTER TABLE public.saved_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own saved songs" ON public.saved_songs;
CREATE POLICY "Users read own saved songs" ON public.saved_songs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own saved songs" ON public.saved_songs;
CREATE POLICY "Users insert own saved songs" ON public.saved_songs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own saved songs" ON public.saved_songs;
CREATE POLICY "Users update own saved songs" ON public.saved_songs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own saved songs" ON public.saved_songs;
CREATE POLICY "Users delete own saved songs" ON public.saved_songs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS saved_songs_user_idx ON public.saved_songs(user_id, created_at DESC);
