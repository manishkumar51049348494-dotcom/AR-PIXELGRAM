
-- RPC to increment reel likes safely
CREATE OR REPLACE FUNCTION public.increment_reel_likes(reel_id UUID)
RETURNS void AS $$
  UPDATE public.reels SET likes_count = likes_count + 1 WHERE id = reel_id;
$$ LANGUAGE SQL SECURITY DEFINER;

-- RPC to decrement reel likes safely
CREATE OR REPLACE FUNCTION public.decrement_reel_likes(reel_id UUID)
RETURNS void AS $$
  UPDATE public.reels SET likes_count = GREATEST(0, likes_count - 1) WHERE id = reel_id;
$$ LANGUAGE SQL SECURITY DEFINER;
