-- AR Pixelgram group chat system.
-- Adds isolated group tables and RLS without changing existing private messaging tables.

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  avatar_url text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  invite_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  can_send_messages boolean not null default true,
  can_send_media boolean not null default true,
  can_call boolean not null default true,
  can_invite boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_permissions (
  group_id uuid primary key references public.groups(id) on delete cascade,
  send_messages text not null default 'everyone' check (send_messages in ('everyone','admins')),
  add_members text not null default 'admins' check (add_members in ('everyone','admins')),
  edit_info text not null default 'admins' check (edit_info in ('everyone','admins')),
  create_invites text not null default 'admins' check (create_invites in ('everyone','admins')),
  pin_messages text not null default 'admins' check (pin_messages in ('everyone','admins')),
  start_calls text not null default 'everyone' check (start_calls in ('everyone','admins')),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 5000),
  reply_to_id uuid references public.group_messages(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.group_message_reactions (
  message_id uuid not null references public.group_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('👍','❤️','😂','😮','😢','😡','🙏')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.group_message_pins (
  message_id uuid primary key references public.group_messages(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  pinned_by uuid not null references auth.users(id) on delete cascade,
  pinned_at timestamptz not null default now()
);

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.group_reports (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(trim(reason)) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending','reviewed','resolved')),
  created_at timestamptz not null default now()
);

alter table public.notifications add column if not exists group_id uuid references public.groups(id) on delete cascade;

create index if not exists groups_owner_idx on public.groups(owner_id, created_at desc);
create index if not exists group_members_user_idx on public.group_members(user_id, joined_at desc);
create index if not exists group_messages_group_idx on public.group_messages(group_id, created_at asc);
create index if not exists group_reactions_message_idx on public.group_message_reactions(message_id);
create index if not exists group_invites_token_idx on public.group_invites(token) where revoked_at is null;

create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_user_id)
$$;

create or replace function public.is_group_admin(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id and role in ('owner','admin')
  )
$$;

create or replace function public.group_can(p_group_id uuid, p_permission text, p_user_id uuid default auth.uid())
returns boolean language sql security definer stable set search_path = public as $$
  select case
    when p_permission = 'send_messages' then exists (
      select 1 from public.group_members m left join public.group_permissions p using (group_id)
      where m.group_id = p_group_id and m.user_id = p_user_id and m.can_send_messages
        and (coalesce(p.send_messages, 'everyone') = 'everyone' or m.role in ('owner','admin'))
    )
    when p_permission = 'add_members' then exists (
      select 1 from public.group_members m left join public.group_permissions p using (group_id)
      where m.group_id = p_group_id and m.user_id = p_user_id and m.can_invite
        and (coalesce(p.add_members, 'admins') = 'everyone' or m.role in ('owner','admin'))
    )
    when p_permission = 'pin_messages' then public.is_group_admin(p_group_id, p_user_id)
    else public.is_group_member(p_group_id, p_user_id)
  end
$$;

create or replace function public.touch_group_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists groups_touch_updated_at on public.groups;
create trigger groups_touch_updated_at before update on public.groups
for each row execute function public.touch_group_updated_at();

create or replace function public.create_group(
  p_name text,
  p_description text default null,
  p_avatar_url text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_group_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.groups(name, description, avatar_url, owner_id)
  values (trim(p_name), nullif(trim(p_description), ''), nullif(trim(p_avatar_url), ''), auth.uid())
  returning id into v_group_id;
  insert into public.group_members(group_id, user_id, role, can_invite)
  values (v_group_id, auth.uid(), 'owner', true);
  insert into public.group_permissions(group_id) values (v_group_id);
  insert into public.group_invites(group_id, created_by)
  values (v_group_id, auth.uid());
  return v_group_id;
end;
$$;

create or replace function public.add_group_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.group_can(p_group_id, 'add_members') then raise exception 'You cannot add members'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'User not found'; end if;
  insert into public.group_members(group_id, user_id) values (p_group_id, p_user_id)
  on conflict (group_id, user_id) do nothing;
  insert into public.notifications(user_id, actor_id, type, message, group_id)
  values (p_user_id, auth.uid(), 'message', 'You were added to a group', p_group_id);
end;
$$;

create or replace function public.remove_group_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_admin(p_group_id) then raise exception 'Only admins can remove members'; end if;
  if exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_user_id and role = 'owner') then
    raise exception 'Transfer ownership before removing the owner';
  end if;
  delete from public.group_members where group_id = p_group_id and user_id = p_user_id;
end;
$$;

create or replace function public.leave_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.group_members where group_id = p_group_id and user_id = auth.uid() and role = 'owner') then
    raise exception 'Owner must transfer ownership before leaving';
  end if;
  delete from public.group_members where group_id = p_group_id and user_id = auth.uid();
end;
$$;

create or replace function public.rotate_group_invite(p_group_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not public.is_group_admin(p_group_id) then raise exception 'Only admins can rotate invites'; end if;
  v_token := replace(gen_random_uuid()::text, '-', '');
  update public.groups set invite_token = v_token where id = p_group_id;
  insert into public.group_invites(group_id, token, created_by) values (p_group_id, v_token, auth.uid());
  return v_token;
end;
$$;

grant execute on function public.create_group(text,text,text) to authenticated;
grant execute on function public.add_group_member(uuid,uuid) to authenticated;
grant execute on function public.remove_group_member(uuid,uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.rotate_group_invite(uuid) to authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_permissions enable row level security;
alter table public.group_messages enable row level security;
alter table public.group_message_reactions enable row level security;
alter table public.group_message_pins enable row level security;
alter table public.group_invites enable row level security;
alter table public.group_reports enable row level security;

drop policy if exists groups_member_select on public.groups;
create policy groups_member_select on public.groups for select to authenticated using (public.is_group_member(id));
drop policy if exists groups_owner_update on public.groups;
create policy groups_owner_update on public.groups for update to authenticated using (public.is_group_admin(id)) with check (public.is_group_admin(id));
drop policy if exists groups_owner_delete on public.groups;
create policy groups_owner_delete on public.groups for delete to authenticated using (owner_id = auth.uid());

drop policy if exists group_members_member_select on public.group_members;
create policy group_members_member_select on public.group_members for select to authenticated using (public.is_group_member(group_id));
drop policy if exists group_members_admin_insert on public.group_members;
create policy group_members_admin_insert on public.group_members for insert to authenticated with check (public.is_group_admin(group_id));
drop policy if exists group_members_admin_update on public.group_members;
create policy group_members_admin_update on public.group_members for update to authenticated using (public.is_group_admin(group_id));
drop policy if exists group_members_admin_delete on public.group_members;
create policy group_members_admin_delete on public.group_members for delete to authenticated using (public.is_group_admin(group_id) or user_id = auth.uid());

drop policy if exists group_permissions_member_select on public.group_permissions;
create policy group_permissions_member_select on public.group_permissions for select to authenticated using (public.is_group_member(group_id));
drop policy if exists group_permissions_admin_write on public.group_permissions;
create policy group_permissions_admin_write on public.group_permissions for all to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

drop policy if exists group_messages_member_select on public.group_messages;
create policy group_messages_member_select on public.group_messages for select to authenticated using (public.is_group_member(group_id));
drop policy if exists group_messages_member_insert on public.group_messages;
create policy group_messages_member_insert on public.group_messages for insert to authenticated with check (sender_id = auth.uid() and public.group_can(group_id, 'send_messages'));
drop policy if exists group_messages_sender_update on public.group_messages;
create policy group_messages_sender_update on public.group_messages for update to authenticated using (sender_id = auth.uid() or public.is_group_admin(group_id));
drop policy if exists group_messages_sender_delete on public.group_messages;
create policy group_messages_sender_delete on public.group_messages for delete to authenticated using (sender_id = auth.uid() or public.is_group_admin(group_id));

drop policy if exists group_reactions_member_all on public.group_message_reactions;
create policy group_reactions_member_all on public.group_message_reactions for all to authenticated
using (exists (select 1 from public.group_messages m where m.id = message_id and public.is_group_member(m.group_id)))
with check (user_id = auth.uid() and exists (select 1 from public.group_messages m where m.id = message_id and public.is_group_member(m.group_id)));

drop policy if exists group_pins_member_select on public.group_message_pins;
create policy group_pins_member_select on public.group_message_pins for select to authenticated using (public.is_group_member(group_id));
drop policy if exists group_pins_admin_write on public.group_message_pins;
create policy group_pins_admin_write on public.group_message_pins for all to authenticated using (public.group_can(group_id, 'pin_messages')) with check (public.group_can(group_id, 'pin_messages'));

drop policy if exists group_invites_member_select on public.group_invites;
create policy group_invites_member_select on public.group_invites for select to authenticated using (public.is_group_member(group_id));
drop policy if exists group_reports_member_insert on public.group_reports;
create policy group_reports_member_insert on public.group_reports for insert to authenticated with check (reporter_id = auth.uid() and public.is_group_member(group_id));
drop policy if exists group_reports_reporter_select on public.group_reports;
create policy group_reports_reporter_select on public.group_reports for select to authenticated using (reporter_id = auth.uid() or public.is_group_admin(group_id));

-- Notify group members for newly inserted messages using the existing notification center.
create or replace function public.notify_group_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(user_id, actor_id, type, message, group_id)
  select gm.user_id, new.sender_id, 'message', left(new.content, 120), new.group_id
  from public.group_members gm
  where gm.group_id = new.group_id and gm.user_id <> new.sender_id;
  return new;
end;
$$;

drop trigger if exists group_message_notifications on public.group_messages;
create trigger group_message_notifications after insert on public.group_messages
for each row execute function public.notify_group_message();

-- Supabase Realtime publication; safe for repeated migration runs.
do $$ begin
  alter publication supabase_realtime add table public.groups;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.group_members;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.group_messages;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.group_message_reactions;
exception when duplicate_object then null;
end $$;
