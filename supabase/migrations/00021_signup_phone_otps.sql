-- Signup ke waqt (logged out) mobile number verify karne ke liye OTP table.
CREATE TABLE IF NOT EXISTS public.signup_phone_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signup_phone_otps_phone_created_idx
  ON public.signup_phone_otps (phone, created_at DESC);

GRANT ALL ON public.signup_phone_otps TO service_role;

ALTER TABLE public.signup_phone_otps ENABLE ROW LEVEL SECURITY;
-- Koi policy nahi: sirf service_role (edge functions) hi access kar sakta hai.
