-- ============================================================
-- Long-form videos (YouTube jaisa) — reels se alag feature
-- videos + video_likes + video_comments + 'videos' storage bucket
-- ============================================================

CREATE TABLE IF NOT EXISTS public.videos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  video_url     TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_sec  INTEGER,
  visibility    TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  views_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.video_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id   UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (video_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.video_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id   UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS videos_user_idx ON public.videos (user_id);
CREATE INDEX IF NOT EXISTS videos_created_idx ON public.videos (created_at DESC);
CREATE INDEX IF NOT EXISTS video_comments_video_idx ON public.video_comments (video_id);
CREATE INDEX IF NOT EXISTS video_likes_video_idx ON public.video_likes (video_id);

-- Data API access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT SELECT ON public.videos TO anon;
GRANT ALL ON public.videos TO service_role;

GRANT SELECT, INSERT, DELETE ON public.video_likes TO authenticated;
GRANT SELECT ON public.video_likes TO anon;
GRANT ALL ON public.video_likes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_comments TO authenticated;
GRANT SELECT ON public.video_comments TO anon;
GRANT ALL ON public.video_comments TO service_role;

-- RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public videos viewable, private only by owner" ON public.videos;
CREATE POLICY "Public videos viewable, private only by owner" ON public.videos
  FOR SELECT USING (visibility = 'public' OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own videos" ON public.videos;
CREATE POLICY "Users insert own videos" ON public.videos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own videos" ON public.videos;
CREATE POLICY "Users update own videos" ON public.videos
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own videos" ON public.videos;
CREATE POLICY "Users delete own videos" ON public.videos
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Video likes viewable by all" ON public.video_likes;
CREATE POLICY "Video likes viewable by all" ON public.video_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own video likes" ON public.video_likes;
CREATE POLICY "Users insert own video likes" ON public.video_likes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own video likes" ON public.video_likes;
CREATE POLICY "Users delete own video likes" ON public.video_likes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Video comments viewable by all" ON public.video_comments;
CREATE POLICY "Video comments viewable by all" ON public.video_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own video comments" ON public.video_comments;
CREATE POLICY "Users insert own video comments" ON public.video_comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own video comments" ON public.video_comments;
CREATE POLICY "Users delete own video comments" ON public.video_comments
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- View counter
CREATE OR REPLACE FUNCTION public.increment_video_views(video_id_input UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.videos SET views_count = views_count + 1 WHERE id = video_id_input;
$$;

GRANT EXECUTE ON FUNCTION public.increment_video_views(UUID) TO anon, authenticated;

-- Storage bucket — bade video (film/gaana) ke liye 5GB limit
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('videos', 'videos', true, 5368709120)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5368709120;

DROP POLICY IF EXISTS "Public videos read" ON storage.objects;
CREATE POLICY "Public videos read" ON storage.objects
  FOR SELECT USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "Auth users upload videos" ON storage.objects;
CREATE POLICY "Auth users upload videos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'videos');

DROP POLICY IF EXISTS "Users update own video files" ON storage.objects;
CREATE POLICY "Users update own video files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own video files" ON storage.objects;
CREATE POLICY "Users delete own video files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Purane post/reel media hamesha dikhein: buckets public rahein
UPDATE storage.buckets SET public = true WHERE id IN ('posts', 'stories', 'avatars', 'reels', 'videos');
-- Reels ka size limit bada karo (pehle 100MB tha)
UPDATE storage.buckets SET file_size_limit = 1073741824 WHERE id = 'reels';
