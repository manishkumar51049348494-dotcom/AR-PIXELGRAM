
-- 1. Account status on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active','suspended','locked','permanently_disabled')),
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

-- 2. Story likes + views
CREATE TABLE IF NOT EXISTS public.story_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, user_id)
);
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS views_count INT DEFAULT 0;

-- 3. Story views tracking
CREATE TABLE IF NOT EXISTS public.story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, viewer_id)
);

-- 4. Message seen status + block
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_seen BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- 5. Online status
CREATE TABLE IF NOT EXISTS public.online_status (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved')),
  admin_action TEXT CHECK (admin_action IN ('suspended','locked','permanently_disabled','no_action')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Appeals table
CREATE TABLE IF NOT EXISTS public.appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  appeal_text TEXT NOT NULL,
  appeal_photo_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Problem reports (from settings)
CREATE TABLE IF NOT EXISTS public.problem_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  problem_type TEXT,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Story reply — messages with story_id reference
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS story_id UUID REFERENCES public.stories(id) ON DELETE SET NULL;

-- 10. Auto-delete stories after 24h (cron-style via DB function)
CREATE OR REPLACE FUNCTION public.delete_expired_stories()
RETURNS void AS $$
  DELETE FROM public.stories WHERE created_at < NOW() - INTERVAL '24 hours';
$$ LANGUAGE SQL SECURITY DEFINER;

-- RLS for new tables
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "story_likes_all" ON public.story_likes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "story_views_all" ON public.story_views FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "blocks_all" ON public.blocks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "online_status_all" ON public.online_status FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "reports_select" ON public.reports FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "reports_insert" ON public.reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "appeals_all" ON public.appeals FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "problem_reports_all" ON public.problem_reports FOR ALL USING (auth.role() = 'authenticated');

-- RPCs
CREATE OR REPLACE FUNCTION public.increment_story_likes(story_id UUID)
RETURNS void AS $$ UPDATE public.stories SET likes_count = likes_count + 1 WHERE id = story_id; $$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.decrement_story_likes(story_id UUID)
RETURNS void AS $$ UPDATE public.stories SET likes_count = GREATEST(0, likes_count - 1) WHERE id = story_id; $$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_story_views(story_id UUID)
RETURNS void AS $$ UPDATE public.stories SET views_count = views_count + 1 WHERE id = story_id; $$ LANGUAGE SQL SECURITY DEFINER;

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.online_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocks;
