-- Fix notification system: allow all notification types, remove blocking FKs,
-- and auto-notify followers when someone posts a new story.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'like','comment','follow','follow_request','follow_accepted','verified',
    'broadcast','suspended','story_like','story_reply','reel_like',
    'reel_comment','comment_reply','message','new_story'
  ));

-- post_id / comment_id also hold reel + reel-comment + story ids,
-- so the strict foreign keys made those inserts fail.
alter table public.notifications drop constraint if exists notifications_post_id_fkey;
alter table public.notifications drop constraint if exists notifications_comment_id_fkey;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- New story -> notify all accepted followers
create or replace function public.notify_followers_new_story()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type, post_id)
  select f.follower_id, new.user_id, 'new_story', new.id
  from public.follows f
  where f.following_id = new.user_id
    and f.status = 'accepted'
    and f.follower_id <> new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_notify_followers_new_story on public.stories;
create trigger trg_notify_followers_new_story
  after insert on public.stories
  for each row execute function public.notify_followers_new_story();
