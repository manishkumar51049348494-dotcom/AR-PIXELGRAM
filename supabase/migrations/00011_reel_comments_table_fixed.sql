-- Create reel_comments table with correct foreign keys and RLS
CREATE TABLE IF NOT EXISTS public.reel_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.reel_comments(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure reels table has comments_count column
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reels' AND column_name='comments_count') THEN
    ALTER TABLE public.reels ADD COLUMN comments_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Drop constraint if it exists to avoid error, then add it
ALTER TABLE public.reel_comments DROP CONSTRAINT IF EXISTS reel_comments_user_id_fkey;
ALTER TABLE public.reel_comments ADD CONSTRAINT reel_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- RLS Setup
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reel_comments_select" ON public.reel_comments;
CREATE POLICY "reel_comments_select" ON public.reel_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "reel_comments_insert_own" ON public.reel_comments;
CREATE POLICY "reel_comments_insert_own" ON public.reel_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reel_comments_delete_own" ON public.reel_comments;
CREATE POLICY "reel_comments_delete_own" ON public.reel_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger to maintain reels.comments_count
CREATE OR REPLACE FUNCTION public.handle_reel_comment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.reels SET comments_count = COALESCE(comments_count, 0) + 1 WHERE id = NEW.reel_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.reels SET comments_count = GREATEST(0, COALESCE(comments_count, 0) - 1) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_reel_comment_change ON public.reel_comments;
CREATE TRIGGER on_reel_comment_change
  AFTER INSERT OR DELETE ON public.reel_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_reel_comment_change();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel ON public.reel_comments(reel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reel_comments_parent ON public.reel_comments(parent_id);

-- Permissions
GRANT SELECT ON public.reel_comments TO anon, authenticated;
GRANT INSERT, DELETE ON public.reel_comments TO authenticated;
GRANT ALL ON public.reel_comments TO service_role;