
-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text,
  bio text,
  avatar_url text,
  dob date,
  is_private boolean not null default false,
  is_verified boolean not null default false,
  is_admin boolean not null default false,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now()
);

-- Posts table
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  image_url text not null,
  caption text,
  created_at timestamptz not null default now()
);

-- Stories table
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  image_url text not null,
  caption text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

-- Follows table
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  unique(follower_id, following_id)
);

-- Likes table
create table public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, post_id)
);

-- Comments table
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Saved posts table
create table public.saved_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, post_id)
);

-- Messages table
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  is_seen boolean not null default false,
  created_at timestamptz not null default now()
);

-- Notifications table
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('like','comment','follow','follow_request','follow_accepted','verified','broadcast','suspended')),
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Verification requests table
create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id)
);

-- Reports table
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  report_type text not null check (report_type in ('post','user','story','bug')),
  target_id uuid,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','reviewed','resolved')),
  created_at timestamptz not null default now()
);

-- Broadcast notifications table
create table public.broadcast_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Activity logs table
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  details text,
  created_at timestamptz not null default now()
);

-- ===================== STORAGE BUCKETS =====================
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
insert into storage.buckets (id, name, public) values ('posts', 'posts', true);
insert into storage.buckets (id, name, public) values ('stories', 'stories', true);

-- ===================== RLS POLICIES =====================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.stories enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.saved_posts enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.verification_requests enable row level security;
alter table public.reports enable row level security;
alter table public.broadcast_notifications enable row level security;
alter table public.activity_logs enable row level security;

-- Helper: check if user is admin
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select coalesce((select is_admin from public.profiles where user_id = auth.uid()), false)
$$;

-- Helper: check if a user is suspended
create or replace function public.is_suspended(uid uuid)
returns boolean language sql security definer stable as $$
  select coalesce((select is_suspended from public.profiles where user_id = uid), false)
$$;

-- Helper: check mutual follow
create or replace function public.are_mutual_follows(user_a uuid, user_b uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1 from public.follows where follower_id = user_a and following_id = user_b and status = 'accepted'
  ) and exists(
    select 1 from public.follows where follower_id = user_b and following_id = user_a and status = 'accepted'
  )
$$;

-- PROFILES policies
create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);
create policy "Users can insert their own profile" on public.profiles
  for insert with check (user_id = auth.uid());
create policy "Users can update their own profile" on public.profiles
  for update using (user_id = auth.uid());
create policy "Admin can update any profile" on public.profiles
  for update using (public.is_admin());
create policy "Admin can delete profiles" on public.profiles
  for delete using (public.is_admin());

-- POSTS policies
create policy "Posts are viewable by everyone" on public.posts
  for select using (true);
create policy "Authenticated users can insert posts" on public.posts
  for insert with check (auth.uid() is not null);
create policy "Users can update their own posts" on public.posts
  for update using (user_id = auth.uid());
create policy "Users can delete their own posts" on public.posts
  for delete using (user_id = auth.uid() or public.is_admin());

-- STORIES policies
create policy "Stories are viewable by everyone" on public.stories
  for select using (true);
create policy "Authenticated users can insert stories" on public.stories
  for insert with check (auth.uid() is not null);
create policy "Users can delete their own stories" on public.stories
  for delete using (user_id = auth.uid() or public.is_admin());

-- FOLLOWS policies
create policy "Follows are viewable by authenticated users" on public.follows
  for select using (auth.uid() is not null);
create policy "Users can follow others" on public.follows
  for insert with check (follower_id = auth.uid());
create policy "Users can update their own follow requests" on public.follows
  for update using (following_id = auth.uid() or follower_id = auth.uid());
create policy "Users can delete their own follows" on public.follows
  for delete using (follower_id = auth.uid() or following_id = auth.uid());

-- LIKES policies
create policy "Likes are viewable by authenticated users" on public.likes
  for select using (auth.uid() is not null);
create policy "Users can like posts" on public.likes
  for insert with check (user_id = auth.uid());
create policy "Users can unlike posts" on public.likes
  for delete using (user_id = auth.uid());

-- COMMENTS policies
create policy "Comments are viewable by authenticated users" on public.comments
  for select using (auth.uid() is not null);
create policy "Users can add comments" on public.comments
  for insert with check (user_id = auth.uid());
create policy "Users can delete their own comments" on public.comments
  for delete using (user_id = auth.uid() or public.is_admin());

-- SAVED POSTS policies
create policy "Users can view their own saved posts" on public.saved_posts
  for select using (user_id = auth.uid());
create policy "Users can save posts" on public.saved_posts
  for insert with check (user_id = auth.uid());
create policy "Users can unsave posts" on public.saved_posts
  for delete using (user_id = auth.uid());

-- MESSAGES policies
create policy "Users can view their own messages" on public.messages
  for select using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "Users can send messages to mutual follows" on public.messages
  for insert with check (sender_id = auth.uid());
create policy "Users can update seen status" on public.messages
  for update using (receiver_id = auth.uid() or sender_id = auth.uid());

-- NOTIFICATIONS policies
create policy "Users can view their own notifications" on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());
create policy "Authenticated users can create notifications" on public.notifications
  for insert with check (auth.uid() is not null);
create policy "Users can update their own notifications" on public.notifications
  for update using (user_id = auth.uid());
create policy "Admin can delete notifications" on public.notifications
  for delete using (public.is_admin());

-- VERIFICATION REQUESTS policies
create policy "Users can view own verification request" on public.verification_requests
  for select using (user_id = auth.uid() or public.is_admin());
create policy "Users can submit verification request" on public.verification_requests
  for insert with check (user_id = auth.uid());
create policy "Admin can update verification requests" on public.verification_requests
  for update using (public.is_admin());

-- REPORTS policies
create policy "Users can view their own reports" on public.reports
  for select using (reporter_id = auth.uid() or public.is_admin());
create policy "Users can submit reports" on public.reports
  for insert with check (reporter_id = auth.uid());
create policy "Admin can update reports" on public.reports
  for update using (public.is_admin());

-- BROADCAST NOTIFICATIONS policies
create policy "Everyone can view broadcast notifications" on public.broadcast_notifications
  for select using (true);
create policy "Admin can create broadcast notifications" on public.broadcast_notifications
  for insert with check (public.is_admin());

-- ACTIVITY LOGS policies
create policy "Admin can view activity logs" on public.activity_logs
  for select using (public.is_admin());
create policy "Authenticated users can insert activity logs" on public.activity_logs
  for insert with check (auth.uid() is not null);

-- Storage policies
create policy "Anyone can view avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Authenticated users can upload avatars" on storage.objects for insert with check (bucket_id = 'avatars' and auth.uid() is not null);
create policy "Users can update their own avatars" on storage.objects for update using (bucket_id = 'avatars' and auth.uid() is not null);
create policy "Users can delete their own avatars" on storage.objects for delete using (bucket_id = 'avatars' and auth.uid() is not null);

create policy "Anyone can view posts" on storage.objects for select using (bucket_id = 'posts');
create policy "Authenticated users can upload posts" on storage.objects for insert with check (bucket_id = 'posts' and auth.uid() is not null);
create policy "Users can delete their own post images" on storage.objects for delete using (bucket_id = 'posts' and auth.uid() is not null);

create policy "Anyone can view stories" on storage.objects for select using (bucket_id = 'stories');
create policy "Authenticated users can upload stories" on storage.objects for insert with check (bucket_id = 'stories' and auth.uid() is not null);
create policy "Users can delete their own story images" on storage.objects for delete using (bucket_id = 'stories' and auth.uid() is not null);

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.follows;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
