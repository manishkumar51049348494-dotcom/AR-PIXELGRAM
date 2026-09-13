-- Make group invites joinable and keep admin permissions consistent.

create or replace function public.join_group_by_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_group_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_group_id from public.groups
  where invite_enabled = true and invite_token = trim(p_token);
  if v_group_id is null then raise exception 'Invite link is invalid or disabled'; end if;
  insert into public.group_members(group_id, user_id)
  values (v_group_id, auth.uid())
  on conflict (group_id, user_id) do nothing;
  return v_group_id;
end;
$$;

grant execute on function public.join_group_by_invite(text) to authenticated;

update public.group_members set can_invite = true where role in ('owner', 'admin');

create or replace function public.add_group_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.group_can(p_group_id, 'add_members') then raise exception 'You cannot add members'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'User not found'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_user_id) then
    insert into public.group_members(group_id, user_id, can_invite)
    values (p_group_id, p_user_id, false);
    insert into public.notifications(user_id, actor_id, type, message, group_id)
    values (p_user_id, auth.uid(), 'message', 'You were added to a group', p_group_id);
  end if;
end;
$$;
