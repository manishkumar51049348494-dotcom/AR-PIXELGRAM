-- Call duration logs + naye notification types (new_post / new_reel / new_video)

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  call_type text not null default 'audio' check (call_type in ('audio','video')),
  status text not null default 'answered' check (status in ('answered','missed','declined')),
  duration_sec integer not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

grant select, insert on public.call_logs to authenticated;
grant all on public.call_logs to service_role;

alter table public.call_logs enable row level security;

drop policy if exists "call participants can read" on public.call_logs;
create policy "call participants can read" on public.call_logs
  for select to authenticated
  using (auth.uid() = caller_id or auth.uid() = receiver_id);

drop policy if exists "call participants can insert" on public.call_logs;
create policy "call participants can insert" on public.call_logs
  for insert to authenticated
  with check (auth.uid() = caller_id or auth.uid() = receiver_id);

create index if not exists call_logs_caller_idx on public.call_logs(caller_id, created_at desc);
create index if not exists call_logs_receiver_idx on public.call_logs(receiver_id, created_at desc);

-- notifications.type me naye content types allow karo
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'notifications_type_check' and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications drop constraint notifications_type_check;
  end if;

  alter table public.notifications add constraint notifications_type_check
    check (type in (
      'like','comment','follow','follow_request','follow_accepted','verified','broadcast',
      'suspended','story_like','story_reply','reel_like','reel_comment','comment_reply',
      'message','new_story','new_post','new_reel','new_video'
    ));
end $$;
