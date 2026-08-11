-- Account Center: ek hi account par extra email aur phone number add karne ka
-- support (Facebook ke "Accounts Center" jaisa). Har identifier OTP se verify
-- hota hai, aur verify hone ke baad usse login bhi kiya ja sakta hai.
-- Limit: har user ke paas max 5 email + 5 phone.

CREATE TABLE IF NOT EXISTS public.account_identifiers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('email', 'phone')),
  value       TEXT NOT NULL,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (type, value)
);

GRANT SELECT, DELETE ON public.account_identifiers TO authenticated;
GRANT ALL ON public.account_identifiers TO service_role;

ALTER TABLE public.account_identifiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own identifiers" ON public.account_identifiers;
CREATE POLICY "Users read own identifiers" ON public.account_identifiers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Insert sirf server (edge function) karta hai, OTP verify hone ke baad.
DROP POLICY IF EXISTS "Users delete own non-primary identifiers" ON public.account_identifiers;
CREATE POLICY "Users delete own non-primary identifiers" ON public.account_identifiers
  FOR DELETE TO authenticated USING (auth.uid() = user_id AND is_primary = FALSE);

CREATE INDEX IF NOT EXISTS account_identifiers_user_idx ON public.account_identifiers(user_id, type);

-- Max 5 email + 5 phone per account.
CREATE OR REPLACE FUNCTION public.enforce_identifier_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing INTEGER;
BEGIN
  SELECT COUNT(*) INTO existing
  FROM public.account_identifiers
  WHERE user_id = NEW.user_id AND type = NEW.type;

  IF existing >= 5 THEN
    RAISE EXCEPTION 'identifier_limit_reached';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_identifiers_limit ON public.account_identifiers;
CREATE TRIGGER account_identifiers_limit
  BEFORE INSERT ON public.account_identifiers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_identifier_limit();

-- OTP store. Client ko koi access nahi — sirf service role (edge functions).
CREATE TABLE IF NOT EXISTS public.account_identifier_otps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('email', 'phone')),
  value       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT ALL ON public.account_identifier_otps TO service_role;
ALTER TABLE public.account_identifier_otps ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS account_identifier_otps_lookup
  ON public.account_identifier_otps(user_id, type, value, created_at DESC);

-- Purane accounts ka signup email primary identifier ke roop me daal do.
INSERT INTO public.account_identifiers (user_id, type, value, is_primary)
SELECT id, 'email', LOWER(email), TRUE
FROM auth.users
WHERE email IS NOT NULL AND email <> ''
ON CONFLICT (type, value) DO NOTHING;

-- Naye signup par bhi primary email apne aap add ho jaye.
CREATE OR REPLACE FUNCTION public.add_primary_email_identifier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    INSERT INTO public.account_identifiers (user_id, type, value, is_primary)
    VALUES (NEW.id, 'email', LOWER(NEW.email), TRUE)
    ON CONFLICT (type, value) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_add_identifier ON auth.users;
CREATE TRIGGER on_auth_user_created_add_identifier
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.add_primary_email_identifier();
