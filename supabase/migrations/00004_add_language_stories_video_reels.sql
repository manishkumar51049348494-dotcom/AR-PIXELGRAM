
-- 1. Add preferred_language to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'hi';

-- 2. Add media_type to stories (image or video)
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 3. Create reels table
CREATE TABLE IF NOT EXISTS public.reels (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url    TEXT NOT NULL,
  thumbnail_url TEXT,
  caption      TEXT,
  likes_count  INTEGER DEFAULT 0,
  views_count  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Reels likes table
CREATE TABLE IF NOT EXISTS public.reel_likes (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reel_id  UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, reel_id)
);

-- 5. RLS for reels
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reels viewable by all" ON public.reels FOR SELECT USING (true);
CREATE POLICY "Users insert own reels" ON public.reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reels" ON public.reels FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Reel likes viewable by all" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "Users insert own reel likes" ON public.reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reel likes" ON public.reel_likes FOR DELETE USING (auth.uid() = user_id);

-- 6. Enable realtime for reels
ALTER PUBLICATION supabase_realtime ADD TABLE public.reels;
