
-- Function: automatically make the very first registered user an admin
CREATE OR REPLACE FUNCTION public.promote_first_user_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is the first profile ever created, make them admin
  IF (SELECT COUNT(*) FROM public.profiles) = 1 THEN
    NEW.is_admin := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: runs BEFORE insert so we can modify the row
DROP TRIGGER IF EXISTS trg_promote_first_admin ON public.profiles;
CREATE TRIGGER trg_promote_first_admin
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.promote_first_user_as_admin();
