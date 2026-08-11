
-- Fix: BEFORE trigger fires before the row is inserted, so count is 0 not 1
CREATE OR REPLACE FUNCTION public.promote_first_user_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Count is 0 when BEFORE trigger fires for the very first insert
  IF (SELECT COUNT(*) FROM public.profiles) = 0 THEN
    NEW.is_admin := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
