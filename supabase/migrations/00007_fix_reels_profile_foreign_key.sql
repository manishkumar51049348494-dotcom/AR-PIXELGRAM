
-- Drop old FK to auth.users if exists, add FK to profiles.user_id
-- First ensure profiles has a unique constraint on user_id (needed for FK target)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);

-- Add FK from reels.user_id → profiles.user_id so PostgREST can resolve the join
ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_user_id_fkey;
ALTER TABLE public.reels ADD CONSTRAINT reels_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
