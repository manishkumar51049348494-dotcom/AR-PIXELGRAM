-- Media attachments and real group-call state.

insert into storage.buckets (id, name, public)
values ('group-media', 'group-media', true)
on conflict (id) do nothing;

create table if not exists public.group_media (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  message_id uuid references public.group_messages(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('photo','video','file','voice')),
  storage_path text not null,
  public_url text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create table if not exists public.group_calls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  started_by uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('audio','video')),
  status text not null default 'active' check (status in ('active','ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.group_call_participants (
  call_id uuid not null references public.group_calls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (call_id, user_id)
);

create index if not exists group_media_group_idx on public.group_media(group_id, created_at desc);
create index if not exists group_calls_group_idx on public.group_calls(group_id, started_at desc);

alter table public.group_media enable row level security;
alter table public.group_calls enable row level security;
alter table public.group_call_participants enable row level security;

drop policy if exists group_media_member_select on public.group_media;
create policy group_media_member_select on public.group_media for select to authenticated using (public.is_group_member(group_id));
drop policy if exists group_media_member_insert on public.group_media;
create policy group_media_member_insert on public.group_media for insert to authenticated with check (uploader_id = auth.uid() and public.is_group_member(group_id));
drop policy if exists group_media_uploader_delete on public.group_media;
create policy group_media_uploader_delete on public.group_media for delete to authenticated using (uploader_id = auth.uid() or public.is_group_admin(group_id));

drop policy if exists group_calls_member_select on public.group_calls;
create policy group_calls_member_select on public.group_calls for select to authenticated using (public.is_group_member(group_id));
drop policy if exists group_calls_member_insert on public.group_calls;
create policy group_calls_member_insert on public.group_calls for insert to authenticated with check (started_by = auth.uid() and public.group_can(group_id, 'start_calls'));
drop policy if exists group_calls_starter_update on public.group_calls;
create policy group_calls_starter_update on public.group_calls for update to authenticated using (started_by = auth.uid() or public.is_group_admin(group_id));

drop policy if exists group_call_participants_member_all on public.group_call_participants;
create policy group_call_participants_member_all on public.group_call_participants for all to authenticated
using (exists (select 1 from public.group_calls c where c.id = call_id and public.is_group_member(c.group_id)))
with check (user_id = auth.uid() and exists (select 1 from public.group_calls c where c.id = call_id and public.is_group_member(c.group_id)));

-- Storage object paths are group-id/user-id/file-name.
drop policy if exists group_media_storage_read on storage.objects;
create policy group_media_storage_read on storage.objects for select to authenticated
using (bucket_id = 'group-media' and public.is_group_member((storage.foldername(name))[1]::uuid));
drop policy if exists group_media_storage_insert on storage.objects;
create policy group_media_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'group-media' and owner_id = auth.uid() and public.is_group_member((storage.foldername(name))[1]::uuid));
drop policy if exists group_media_storage_delete on storage.objects;
create policy group_media_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'group-media' and (owner_id = auth.uid() or public.is_group_admin((storage.foldername(name))[1]::uuid)));

do $$ begin
  alter publication supabase_realtime add table public.group_media;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.group_calls;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.group_call_participants;
exception when duplicate_object then null;
end $$;
