-- Facebook-style password reset: email par 6-digit OTP, koi reset link nahi.
create table if not exists public.password_reset_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_otps_user_idx on public.password_reset_otps (user_id, created_at desc);
create index if not exists password_reset_otps_email_idx on public.password_reset_otps (email, created_at desc);

-- Sirf service_role (edge functions) ise chhu sakta hai.
grant all on public.password_reset_otps to service_role;
alter table public.password_reset_otps enable row level security;
