-- Reel view counter: call this once per viewer per reel to increment
-- reels.views_count. Mirrors increment_story_views (00008 migration).
-- Run this in the Supabase SQL Editor.

create table if not exists public.reel_views (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (reel_id, viewer_id)
);

alter table public.reel_views enable row level security;

create policy "Users can record their own reel views"
  on public.reel_views for insert
  with check (auth.uid() = viewer_id);

create policy "Reel owners can see who viewed"
  on public.reel_views for select
  using (
    auth.uid() = viewer_id
    or auth.uid() = (select user_id from public.reels where id = reel_id)
  );

create or replace function public.increment_reel_views(reel_id_input uuid)
returns void
language sql
security definer
as $$
  insert into public.reel_views (reel_id, viewer_id)
  values (reel_id_input, auth.uid())
  on conflict (reel_id, viewer_id) do nothing;

  update public.reels
  set views_count = (select count(*) from public.reel_views where reel_id = reel_id_input)
  where id = reel_id_input;
$$;

grant execute on function public.increment_reel_views(uuid) to authenticated;