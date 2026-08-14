import { supabase } from '@/db/supabase';
import type { Profile, Post, Story, Comment, Message, Notification, VerificationRequest, Report, BroadcastNotification, ActivityLog } from '@/types/types';

// ===================== PROFILES =====================
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  // Network/RLS error ko "profile nahi mila" mat samjho — warna app account
  // delete hua dikhata hai. Error throw karo taaki UI retry dikha sake.
  if (error) throw error;
  return data;
}

export async function getProfileById(profileId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<void> {
  await supabase.from('profiles').update(updates).eq('user_id', userId);
}

export async function checkUsernameAvailable(username: string, currentUserId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('username', username.toLowerCase().trim())
    .neq('user_id', currentUserId)
    .maybeSingle();
  return !data; // true = available
}

export async function searchProfiles(query: string, limit = 10): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
    .order('username')
    .limit(limit);
  return Array.isArray(data) ? data : [];
}

export async function getAllProfiles(page = 0, pageSize = 20): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  return Array.isArray(data) ? data : [];
}

// ===================== POSTS =====================
export async function createPost(imageUrl: string, caption: string | null): Promise<void> {
  await supabase.from('posts').insert({ image_url: imageUrl, caption });
}

// posts.user_id ka foreign key auth.users par hai, profiles par nahi — isliye
// PostgREST ka embedded join (profiles!posts_user_id_fkey) fail ho jata tha aur
// poora feed khaali aata tha. Profiles ko alag query se attach karte hain.
async function attachProfiles<T extends { user_id: string }>(rows: T[]): Promise<(T & { profile?: Profile })[]> {
  if (rows.length === 0) return [];
  const userIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)));
  const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', userIds);
  const map = Object.fromEntries((profiles || []).map((pr: Profile) => [pr.user_id, pr]));
  return rows.map(r => ({ ...r, profile: map[r.user_id] }));
}

// Attaches real like/comment counts + is_liked/is_saved to a batch of posts.
// posts.likes_count/comments_count were never populated anywhere before —
// PostCard always showed 0, since there's no denormalized count column;
// counts live in the separate likes/comments tables.
async function attachPostSocialMeta(rows: Post[], currentUserId?: string): Promise<Post[]> {
  if (rows.length === 0) return [];
  const ids = rows.map(r => r.id);
  const [likesRes, commentsRes, likedRes, savedRes] = await Promise.all([
    supabase.from('likes').select('post_id').in('post_id', ids),
    supabase.from('comments').select('post_id').in('post_id', ids),
    currentUserId
      ? supabase.from('likes').select('post_id').in('post_id', ids).eq('user_id', currentUserId)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
    currentUserId
      ? supabase.from('saved_posts').select('post_id').in('post_id', ids).eq('user_id', currentUserId)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
  ]);
  const likeCounts = new Map<string, number>();
  (likesRes.data || []).forEach((r: { post_id: string }) => likeCounts.set(r.post_id, (likeCounts.get(r.post_id) || 0) + 1));
  const commentCounts = new Map<string, number>();
  (commentsRes.data || []).forEach((r: { post_id: string }) => commentCounts.set(r.post_id, (commentCounts.get(r.post_id) || 0) + 1));
  const likedSet = new Set((likedRes.data || []).map((r: { post_id: string }) => r.post_id));
  const savedSet = new Set((savedRes.data || []).map((r: { post_id: string }) => r.post_id));
  return rows.map(r => ({
    ...r,
    likes_count: likeCounts.get(r.id) || 0,
    comments_count: commentCounts.get(r.id) || 0,
    is_liked: likedSet.has(r.id),
    is_saved: savedSet.has(r.id),
  }));
}

export async function getPostById(postId: string, currentUserId?: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .maybeSingle();
  if (error || !data) return null;
  const [post] = await attachProfiles([data as Post]);
  const [withMeta] = await attachPostSocialMeta([post], currentUserId);
  return withMeta;
}

export async function getHomeFeed(userId: string, page = 0, pageSize = 10): Promise<Post[]> {
  // Get followed user IDs
  const { data: followData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
    .eq('status', 'accepted');
  const followedIds = (followData || []).map((f: { following_id: string }) => f.following_id);
  // Home feed = people you follow + your own posts (so a freshly-created
  // post always shows up immediately, even before you follow anyone).
  const feedIds = Array.from(new Set([...followedIds, userId]));

  const { data } = await supabase
    .from('posts')
    .select('*')
    .in('user_id', feedIds)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  const posts = await attachProfiles(Array.isArray(data) ? (data as Post[]) : []);
  return attachPostSocialMeta(posts, userId);
}

export async function getUserPosts(userId: string, currentUserId?: string): Promise<Post[]> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  const posts = await attachProfiles(Array.isArray(data) ? (data as Post[]) : []);
  return attachPostSocialMeta(posts, currentUserId);
}

export async function deletePost(postId: string): Promise<void> {
  await supabase.from('posts').delete().eq('id', postId);
}

export async function getAllPosts(page = 0, pageSize = 20, currentUserId?: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) throw error;
  const posts = await attachProfiles(Array.isArray(data) ? (data as Post[]) : []);
  return attachPostSocialMeta(posts, currentUserId);
}

// ===================== LIKES =====================
export async function likePost(postId: string): Promise<void> {
  await supabase.from('likes').insert({ post_id: postId });
}

export async function unlikePost(postId: string, userId: string): Promise<void> {
  await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
}

export async function getLikesCount(postId: string): Promise<number> {
  const { count } = await supabase.from('likes').select('id', { count: 'exact', head: true }).eq('post_id', postId);
  return count || 0;
}

export async function isLiked(postId: string, userId: string): Promise<boolean> {
  const { data } = await supabase.from('likes').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle();
  return !!data;
}

// ===================== COMMENTS =====================
export async function addComment(postId: string, content: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) throw new Error('Comment karne ke liye login karein');
  const { error } = await supabase.from('comments').insert({ post_id: postId, user_id: uid, content });
  if (error) throw error;
}

export async function getComments(postId: string): Promise<Comment[]> {
  const { data } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(50);
  return attachProfiles(Array.isArray(data) ? (data as Comment[]) : []) as Promise<Comment[]>;
}

export async function deleteComment(commentId: string): Promise<void> {
  await supabase.from('comments').delete().eq('id', commentId);
}

// ===================== SAVED POSTS =====================
export async function savePost(postId: string): Promise<void> {
  await supabase.from('saved_posts').insert({ post_id: postId });
}

export async function unsavePost(postId: string, userId: string): Promise<void> {
  await supabase.from('saved_posts').delete().eq('post_id', postId).eq('user_id', userId);
}

export async function isSaved(postId: string, userId: string): Promise<boolean> {
  const { data } = await supabase.from('saved_posts').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle();
  return !!data;
}

// ===================== STORIES =====================
export async function createStory(imageUrl: string, caption: string | null): Promise<void> {
  await supabase.from('stories').insert({ image_url: imageUrl, caption });
}

export async function getFeedStories(userId: string): Promise<Story[]> {
  const { data: followData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
    .eq('status', 'accepted');
  const followedIds = (followData || []).map((f: { following_id: string }) => f.following_id);
  const ids = [userId, ...followedIds];

  const { data } = await supabase
    .from('stories')
    .select('*')
    .in('user_id', ids)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(50);
  if (!Array.isArray(data) || data.length === 0) return [];
  const profileIds = [...new Set(data.map((s: { user_id: string }) => s.user_id))];
  const { data: profileData } = await supabase.from('profiles').select('*').in('user_id', profileIds);
  const profileMap = Object.fromEntries((profileData || []).map((p: Profile) => [p.user_id, p]));
  return data.map(s => ({ ...s, profile: profileMap[s.user_id] || null }));
}

export async function deleteStory(storyId: string): Promise<void> {
  await supabase.from('stories').delete().eq('id', storyId);
}

export async function getAllStories(page = 0, pageSize = 20): Promise<Story[]> {
  const { data } = await supabase
    .from('stories')
    .select('*')
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (!Array.isArray(data) || data.length === 0) return [];
  const profileIds = [...new Set(data.map((s: { user_id: string }) => s.user_id))];
  const { data: profileData } = await supabase.from('profiles').select('*').in('user_id', profileIds);
  const profileMap = Object.fromEntries((profileData || []).map((p: Profile) => [p.user_id, p]));
  return data.map(s => ({ ...s, profile: profileMap[s.user_id] || null }));
}

// ===================== FOLLOWS =====================
export async function followUser(followingId: string, isPrivate: boolean): Promise<void> {
  const status = isPrivate ? 'pending' : 'accepted';
  await supabase.from('follows').insert({ following_id: followingId, status });
}

export async function unfollowUser(followingId: string, followerId: string): Promise<void> {
  await supabase.from('follows').delete().eq('follower_id', followerId).eq('following_id', followingId);
}

export async function getFollowStatus(followerId: string, followingId: string): Promise<'accepted' | 'pending' | null> {
  const { data } = await supabase
    .from('follows')
    .select('status')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();
  return data ? data.status : null;
}

export async function getFollowers(userId: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', userId)
    .eq('status', 'accepted')
    .limit(200);
  if (!Array.isArray(data) || data.length === 0) return [];
  const ids = data.map((f: any) => f.follower_id).filter(Boolean);
  const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', ids);
  return Array.isArray(profiles) ? (profiles as Profile[]) : [];
}

export async function getFollowing(userId: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
    .eq('status', 'accepted')
    .limit(200);
  if (!Array.isArray(data) || data.length === 0) return [];
  const ids = data.map((f: any) => f.following_id).filter(Boolean);
  const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', ids);
  return Array.isArray(profiles) ? (profiles as Profile[]) : [];
}

export async function getPendingFollowRequests(userId: string): Promise<{ id: string; follower_id: string; profile: Profile }[]> {
  const { data } = await supabase
    .from('follows')
    .select('id, follower_id, profiles!follows_follower_id_fkey(*)')
    .eq('following_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);
  return Array.isArray(data) ? (data as any[]).map(f => ({ id: f.id as string, follower_id: f.follower_id as string, profile: f.profiles as Profile })) : [];
}

export async function acceptFollowRequest(requestId: string): Promise<void> {
  await supabase.from('follows').update({ status: 'accepted' }).eq('id', requestId);
}

export async function rejectFollowRequest(requestId: string): Promise<void> {
  await supabase.from('follows').delete().eq('id', requestId);
}

export async function getFollowersCount(userId: string): Promise<number> {
  const { count } = await supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId).eq('status', 'accepted');
  return count || 0;
}

export async function getFollowingCount(userId: string): Promise<number> {
  const { count } = await supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId).eq('status', 'accepted');
  return count || 0;
}

// ===================== MESSAGES =====================
export async function sendMessage(receiverId: string, content: string): Promise<void> {
  await supabase.from('messages').insert({ receiver_id: receiverId, content });
}

export async function getMessages(userAId: string, userBId: string): Promise<Message[]> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${userAId},receiver_id.eq.${userBId}),and(sender_id.eq.${userBId},receiver_id.eq.${userAId})`)
    .order('created_at', { ascending: true })
    .limit(100);
  return Array.isArray(data) ? data : [];
}

export async function markMessagesAsSeen(senderId: string, receiverId: string): Promise<void> {
  await supabase.from('messages').update({ is_seen: true }).eq('sender_id', senderId).eq('receiver_id', receiverId).eq('is_seen', false);
}

export async function getMutualFollows(userId: string): Promise<Profile[]> {
  const { data: following } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
    .eq('status', 'accepted');
  const followingIds = (following || []).map((f: { following_id: string }) => f.following_id);
  if (followingIds.length === 0) return [];

  const { data: followers } = await supabase
    .from('follows')
    .select('follower_id, profiles!follows_follower_id_fkey(*)')
    .eq('following_id', userId)
    .eq('status', 'accepted')
    .in('follower_id', followingIds);
  return Array.isArray(followers) ? (followers as any[]).map(f => f.profiles as Profile).filter(Boolean) : [];
}

export async function getMessagedProfiles(userId: string): Promise<Profile[]> {
  const { data: msgs } = await supabase
    .from('messages')
    .select('sender_id, receiver_id')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(500);
  const otherIds = Array.from(
    new Set(
      (msgs || [])
        .map((m: { sender_id: string; receiver_id: string }) =>
          m.sender_id === userId ? m.receiver_id : m.sender_id,
        )
        .filter((id: string) => id && id !== userId),
    ),
  );
  if (otherIds.length === 0) return [];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('user_id', otherIds);
  return Array.isArray(profiles) ? (profiles as Profile[]) : [];
}

export async function getUnreadCount(receiverId: string, senderId: string): Promise<number> {
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('receiver_id', receiverId)
    .eq('sender_id', senderId)
    .eq('is_seen', false);
  return count || 0;
}

// ===================== NOTIFICATIONS =====================
export async function getNotifications(userId: string, page = 0): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(page * 20, (page + 1) * 20 - 1);
  if (error) { console.error('getNotifications failed', error); return []; }
  const rows = Array.isArray(data) ? data : [];
  const actorIds = Array.from(new Set(rows.map(n => n.actor_id).filter(Boolean))) as string[];
  if (actorIds.length === 0) return rows as Notification[];
  const { data: profs } = await supabase
    .from('profiles')
    .select('*')
    .in('user_id', actorIds);
  const byId = new Map((profs || []).map(pr => [pr.user_id, pr]));
  return rows.map(n => ({ ...n, actor: n.actor_id ? byId.get(n.actor_id) : undefined })) as Notification[];
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
}

export async function createNotification(
  userId: string,
  type: Notification['type'],
  actorId?: string,
  postId?: string,
  commentId?: string,
  message?: string
): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    actor_id: actorId || null,
    type,
    post_id: postId || null,
    comment_id: commentId || null,
    message: message || null,
  });
  if (error) throw error;

  const actor = actorId ? await getProfile(actorId) : null;
  const who = actor?.username || 'Someone';
  const titles: Partial<Record<Notification['type'], string>> = {
    like: `${who} liked your post`,
    reel_like: `${who} liked your reel`,
    story_like: `${who} liked your story`,
    comment: `${who} commented on your post`,
    reel_comment: `${who} commented on your reel`,
    comment_reply: `${who} replied to your comment`,
    follow: `${who} followed you`,
    follow_request: `${who} sent a follow request`,
    follow_accepted: `${who} accepted your follow request`,
    message: `New message from ${who}`,
    new_story: `${who} added a new story`,
  };
  const title = titles[type];
  if (!title || message?.startsWith('📞') || message?.startsWith('📵')) return;
  const isReelComment = type === 'reel_comment' || type === 'comment_reply';
  const isReelType = type.startsWith('reel_') || type === 'comment_reply';
  const reelUrl = postId
    ? `/reels?r=${postId}${isReelComment ? '&comments=1' : ''}`
    : '/reels';
  supabase.functions.invoke('send-call-push', {
    body: {
      receiverId: userId,
      title,
      body: message || '',
      tag: `${type}-${postId || commentId || actorId || Date.now()}`,
      data: {
        url: type === 'message' && actorId
          ? `/chat/${actorId}`
          : type === 'new_story' && actorId
            ? `/stories?u=${actorId}`
            : isReelType ? reelUrl : '/notifications',
        icon: actor?.avatar_url || '/images/logo/logo-icon.svg',
      },
    },
  }).catch(() => {});
}

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return count || 0;
}

// ===================== VERIFICATION =====================
export async function submitVerificationRequest(reason: string): Promise<void> {
  await supabase.from('verification_requests').upsert({ reason, status: 'pending' }, { onConflict: 'user_id' });
}

export async function getMyVerificationRequest(userId: string): Promise<VerificationRequest | null> {
  const { data } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function getAllVerificationRequests(status?: string): Promise<VerificationRequest[]> {
  let query = supabase
    .from('verification_requests')
    .select('id, user_id, reason, status, reviewed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (status) query = query.eq('status', status);
  const { data } = await query;
  if (!Array.isArray(data) || data.length === 0) return [];

  const userIds = [...new Set(data.map((v: any) => v.user_id).filter(Boolean))];
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('user_id, username, avatar_url, is_verified')
    .in('user_id', userIds);
  const profileMap: Record<string, any> = {};
  (profileRows || []).forEach((p: any) => { profileMap[p.user_id] = p; });

  return data.map((v: any) => ({ ...v, profile: profileMap[v.user_id] || null }));
}

export async function approveVerification(requestId: string, userId: string): Promise<void> {
  await supabase.from('verification_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', requestId);
  await supabase.from('profiles').update({ is_verified: true }).eq('user_id', userId);
  await createNotification(userId, 'verified', undefined, undefined, undefined, 'Congratulations! Your account has been verified. 🎉');
}

export async function rejectVerification(requestId: string, userId: string): Promise<void> {
  await supabase.from('verification_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', requestId);
  await createNotification(userId, 'verified', undefined, undefined, undefined, 'Your verification request has been rejected.');
}

// ===================== BLOCK / UNBLOCK =====================
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  await supabase.from('blocks').upsert({ blocker_id: blockerId, blocked_id: blockedId });
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await supabase.from('blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
}

export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const { data } = await supabase.from('blocks').select('id').eq('blocker_id', blockerId).eq('blocked_id', blockedId).maybeSingle();
  return !!data;
}

// ===================== ONLINE STATUS =====================
export async function setOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
  await supabase.from('online_status').upsert({ user_id: userId, is_online: isOnline, last_seen_at: new Date().toISOString() });
}

export async function getOnlineStatus(userId: string): Promise<{ is_online: boolean; last_seen_at: string } | null> {
  const { data } = await supabase.from('online_status').select('is_online, last_seen_at').eq('user_id', userId).maybeSingle();
  return data;
}

// ===================== STORY LIKES & VIEWS =====================
export async function toggleStoryLike(storyId: string, userId: string, isLiked: boolean): Promise<void> {
  if (isLiked) {
    await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', userId);
    await supabase.rpc('decrement_story_likes', { story_id: storyId });
  } else {
    await supabase.from('story_likes').upsert({ story_id: storyId, user_id: userId });
    await supabase.rpc('increment_story_likes', { story_id: storyId });
  }
}

export async function isStoryLiked(storyId: string, userId: string): Promise<boolean> {
  const { data } = await supabase.from('story_likes').select('id').eq('story_id', storyId).eq('user_id', userId).maybeSingle();
  return !!data;
}

export async function getStoryLikers(storyId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('story_likes')
    .select('profiles!story_likes_user_id_fkey(*)')
    .eq('story_id', storyId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((r: any) => r.profiles).filter(Boolean);
}

export async function recordStoryView(storyId: string, viewerId: string): Promise<void> {
  const { error } = await supabase.from('story_views').upsert({ story_id: storyId, viewer_id: viewerId });
  if (!error) await supabase.rpc('increment_story_views', { story_id: storyId });
}

// ===================== MARK MESSAGES SEEN (enhanced) =====================
export async function markConversationSeen(senderId: string, receiverId: string): Promise<void> {
  await supabase.from('messages')
    .update({ is_seen: true, seen_at: new Date().toISOString() })
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .eq('is_seen', false);
}

// ===================== USER REPORTS (new table) =====================
export async function reportUserProfile(reporterId: string, reportedUserId: string, reason: string, description: string): Promise<void> {
  // report_type is NOT NULL — must include 'user' as default value
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    report_type: 'user',
    reason,
    description: description || null,
    status: 'pending',
  });
  if (error) throw error;
}

export async function getUserReports(status?: string): Promise<any[]> {
  let query = supabase
    .from('reports')
    .select('id, reason, description, status, admin_action, admin_note, created_at, reporter_id, reported_user_id')
    .order('created_at', { ascending: false })
    .limit(100);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data } = await query;
  if (!Array.isArray(data) || data.length === 0) return [];

  // Fetch reporter + reported profiles separately to avoid FK name issues
  const allUserIds = [...new Set([
    ...data.map((r: any) => r.reporter_id).filter(Boolean),
    ...data.map((r: any) => r.reported_user_id).filter(Boolean),
  ])];
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('user_id, username, avatar_url, account_status')
    .in('user_id', allUserIds);
  const profileMap: Record<string, any> = {};
  (profileRows || []).forEach((p: any) => { profileMap[p.user_id] = p; });

  return data.map((r: any) => ({
    ...r,
    reporter: r.reporter_id ? profileMap[r.reporter_id] || null : null,
    reported: r.reported_user_id ? { ...(profileMap[r.reported_user_id] || {}), user_id: r.reported_user_id } : null,
  }));
}

export async function updateUserReportStatus(
  reportId: string,
  status: string,
  action?: string,
  adminNote?: string
): Promise<void> {
  await supabase.from('reports').update({ status, admin_action: action || null, admin_note: adminNote || null }).eq('id', reportId);
}

// ===================== ACCOUNT STATUS =====================
export async function setAccountStatus(
  userId: string,
  status: 'active' | 'suspended' | 'locked' | 'permanently_disabled',
  reason?: string,
  reporterId?: string  // if set, notify the reporter too
): Promise<void> {
  await supabase.from('profiles').update({
    account_status: status,
    is_suspended: status !== 'active',
    status_reason: reason || null,
    status_updated_at: new Date().toISOString(),
  }).eq('user_id', userId);

  if (status !== 'active') {
    const msgMap: Record<string, string> = {
      suspended: 'आपका अकाउंट अस्थायी रूप से निलंबित किया गया है।',
      locked: 'आपका अकाउंट समीक्षा के लिए लॉक किया गया है।',
      permanently_disabled: 'आपका अकाउंट स्थायी रूप से बंद कर दिया गया है।',
    };
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'suspended',
      message: msgMap[status] || 'अकाउंट स्टेटस बदला गया।',
    });
  } else {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'broadcast',
      message: 'आपका अकाउंट बहाल कर दिया गया है। ✅',
    });
  }

  // Notify reporter that action was taken (without revealing details)
  if (reporterId) {
    await supabase.from('notifications').insert({
      user_id: reporterId,
      type: 'broadcast',
      message: status === 'active'
        ? 'जिस account को आपने report किया था, उसे restore किया गया।'
        : 'आपकी report की समीक्षा की गई और उचित कार्रवाई की गई। धन्यवाद! 🙏',
    });
  }
}

// ===================== APPEALS =====================
export async function submitAppeal(userId: string, appealText: string, appealPhotoUrl?: string): Promise<void> {
  await supabase.from('appeals').upsert({ user_id: userId, appeal_text: appealText, appeal_photo_url: appealPhotoUrl || null, status: 'pending' }, { onConflict: 'user_id' });
}

export async function getAllAppeals(status?: string): Promise<any[]> {
  let query = supabase
    .from('appeals')
    .select('id, user_id, appeal_text, appeal_photo_url, status, admin_note, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data } = await query;
  if (!Array.isArray(data) || data.length === 0) return [];

  const userIds = [...new Set(data.map((a: any) => a.user_id).filter(Boolean))];
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('user_id, username, avatar_url, account_status')
    .in('user_id', userIds);
  const profileMap: Record<string, any> = {};
  (profileRows || []).forEach((p: any) => { profileMap[p.user_id] = p; });

  return data.map((a: any) => ({ ...a, profile: profileMap[a.user_id] || null }));
}

export async function reviewAppeal(appealId: string, approved: boolean, userId: string, adminNote?: string): Promise<void> {
  await supabase.from('appeals').update({ status: approved ? 'approved' : 'rejected', admin_note: adminNote || null }).eq('id', appealId);
  if (approved) {
    await setAccountStatus(userId, 'active', 'Appeal approved');
    await supabase.from('notifications').insert({
      user_id: userId, type: 'broadcast', message: 'आपकी अपील स्वीकार की गई। अकाउंट बहाल कर दिया गया है। ✅',
    });
  } else {
    await supabase.from('notifications').insert({
      user_id: userId, type: 'broadcast', message: 'आपकी अपील अस्वीकार कर दी गई।',
    });
  }
}

// ===================== PROBLEM REPORTS (settings) =====================
export async function submitProblemReport(userId: string, problemType: string, description: string): Promise<void> {
  await supabase.from('problem_reports').insert({ user_id: userId, problem_type: problemType, description });
}

export async function getProblemReports(status?: string): Promise<any[]> {
  let query = supabase
    .from('problem_reports')
    .select('id, user_id, problem_type, description, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data } = await query;
  if (!Array.isArray(data) || data.length === 0) return [];

  const userIds = [...new Set(data.map((p: any) => p.user_id).filter(Boolean))];
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('user_id, username, avatar_url')
    .in('user_id', userIds);
  const profileMap: Record<string, any> = {};
  (profileRows || []).forEach((p: any) => { profileMap[p.user_id] = p; });

  return data.map((p: any) => ({ ...p, profile: profileMap[p.user_id] || null }));
}

// ===================== REPORTS (old — kept for compatibility) =====================
export async function submitReport(reportType: Report['report_type'], targetId: string | null, reason: string): Promise<void> {
  await supabase.from('reports').insert({ report_type: reportType, target_id: targetId, reason });
}

export async function getAllReports(status?: string): Promise<Report[]> {
  let query = supabase
    .from('reports')
    .select('*, profiles!reports_reporter_id_fkey(*)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (status) query = query.eq('status', status);
  const { data } = await query;
  return Array.isArray(data) ? data.map(r => ({ ...r, reporter: r.profiles })) : [];
}

export async function updateReportStatus(reportId: string, status: Report['status']): Promise<void> {
  await supabase.from('reports').update({ status }).eq('id', reportId);
}

// ===================== BROADCAST =====================
export async function createBroadcast(title: string, message: string): Promise<void> {
  // 1) broadcast_notifications table में save करो
  const { error: broadcastErr } = await supabase.from('broadcast_notifications').insert({ title, message });
  if (broadcastErr) throw broadcastErr;

  // 2) सभी users को notifications भेजो (100 per batch to avoid Supabase limits)
  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('user_id')
    .limit(1000);
  if (profilesErr || !profiles) return;

  const CHUNK = 100;
  for (let i = 0; i < profiles.length; i += CHUNK) {
    const chunk = profiles.slice(i, i + CHUNK);
    const notifs = chunk.map((p: { user_id: string }) => ({
      user_id: p.user_id,
      type: 'broadcast' as const,
      message: `📢 ${title}: ${message}`,
    }));
    await supabase.from('notifications').insert(notifs);
  }
}

export async function getBroadcasts(): Promise<BroadcastNotification[]> {
  const { data } = await supabase
    .from('broadcast_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  return Array.isArray(data) ? data : [];
}

// ===================== ACTIVITY LOGS =====================
export async function logActivity(action: string, targetType?: string, targetId?: string, details?: string): Promise<void> {
  await supabase.from('activity_logs').insert({ action, target_type: targetType || null, target_id: targetId || null, details: details || null });
}

export async function getActivityLogs(page = 0): Promise<ActivityLog[]> {
  const { data } = await supabase
    .from('activity_logs')
    .select('*, profiles!activity_logs_actor_id_fkey(*)')
    .order('created_at', { ascending: false })
    .range(page * 50, (page + 1) * 50 - 1);
  return Array.isArray(data) ? data.map(l => ({ ...l, actor: l.profiles })) : [];
}

// ===================== ADMIN STATS =====================
export async function getAdminStats() {
  const [users, posts, stories, reports, verifications] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('posts').select('id', { count: 'exact', head: true }),
    supabase.from('stories').select('id', { count: 'exact', head: true }),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_verified', true),
  ]);
  return {
    total_users: users.count || 0,
    total_posts: posts.count || 0,
    total_stories: stories.count || 0,
    pending_reports: reports.count || 0,
    verified_users: verifications.count || 0,
  };
}

// ===================== ADMIN USER ACTIONS =====================
export async function suspendUser(userId: string): Promise<void> {
  await setAccountStatus(userId, 'suspended', 'Admin action');
}

export async function unsuspendUser(userId: string): Promise<void> {
  await setAccountStatus(userId, 'active', undefined);
}

export async function makeAdmin(userId: string): Promise<void> {
  await supabase.from('profiles').update({ is_admin: true }).eq('user_id', userId);
}

export async function removeAdmin(userId: string): Promise<void> {
  await supabase.from('profiles').update({ is_admin: false }).eq('user_id', userId);
}

// ===================== STORAGE UPLOAD =====================
export async function uploadImage(bucket: 'avatars' | 'posts' | 'stories', file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const filename = `${userId}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from(bucket).upload(filename, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function uploadVideo(bucket: 'stories' | 'reels', file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'mp4';
  const filename = `${userId}/video_${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from(bucket).upload(filename, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

// ===================== REELS =====================
export interface ReelMusic {
  track_id: string;
  title: string;
  artist: string;
  artwork_url?: string;
  preview_url: string;
  start_ms: number;
  duration_ms?: number;
  mute_original: boolean;
}

export interface Reel {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  likes_count: number;
  views_count: number;
  comments_count: number;
  created_at: string;
  profile?: Profile;
  is_liked?: boolean;
  music_track_id?: string | null;
  music_title?: string | null;
  music_artist?: string | null;
  music_artwork_url?: string | null;
  music_preview_url?: string | null;
  music_start_ms?: number | null;
  music_duration_ms?: number | null;
  mute_original?: boolean | null;
}

export async function getReelsFeed(limit = 20, offset = 0): Promise<Reel[]> {
  const { data, error } = await supabase
    .from('reels')
    .select('*, profile:profiles(id, user_id, username, full_name, avatar_url, is_verified)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  // Feed ko remote auth verification par depend mat rakho. getUser() network
  // failure/refresh ke waqt poori reels query ko fail kar deta tha, jabki reel
  // rows pehle hi aa chuki hoti thin. Local persisted session enough hai for
  // the optional is_liked lookup; RLS still protects the database query.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return (data || []) as Reel[];
  const userId = session.user.id;
  const ids = (data || []).map((r) => r.id);
  let likedSet = new Set<string>();
  if (ids.length > 0) {
    const { data: likes } = await supabase.from('reel_likes').select('reel_id').eq('user_id', userId).in('reel_id', ids);
    likedSet = new Set((likes || []).map((l: { reel_id: string }) => l.reel_id));
  }
  return (data || []).map((r) => ({ ...r, is_liked: likedSet.has(r.id) })) as Reel[];
}

export async function recordReelView(reelId: string): Promise<void> {
  try {
    await supabase.rpc('increment_reel_views', { reel_id_input: reelId });
  } catch {
    // RPC not deployed yet — fail silently, view count just won't tick up
  }
}

export async function getReelById(reelId: string): Promise<Reel | null> {
  const { data, error } = await supabase
    .from('reels')
    .select('*, profile:profiles(id, user_id, username, full_name, avatar_url, is_verified)')
    .eq('id', reelId)
    .maybeSingle();
  if (error || !data) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return data as Reel;
  const { data: like } = await supabase
    .from('reel_likes').select('id').eq('reel_id', reelId).eq('user_id', session.user.id).maybeSingle();
  return { ...data, is_liked: !!like } as Reel;
}

export async function getUserReels(userId: string): Promise<Reel[]> {
  const { data, error } = await supabase
    .from('reels')
    .select('*, profile:profiles(id, user_id, username, full_name, avatar_url, is_verified)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Reel[];
}

export async function createReel(
  userId: string,
  videoUrl: string,
  caption: string,
  thumbnailUrl?: string,
  music?: ReelMusic | null,
): Promise<void> {
  const base = {
    user_id: userId, video_url: videoUrl, caption, thumbnail_url: thumbnailUrl || null,
  };
  const withMusic = music
    ? {
        ...base,
        music_track_id: music.track_id,
        music_title: music.title,
        music_artist: music.artist,
        music_artwork_url: music.artwork_url || null,
        music_preview_url: music.preview_url,
        music_start_ms: music.start_ms,
        music_duration_ms: music.duration_ms || null,
        mute_original: music.mute_original,
      }
    : base;
  const { error } = await supabase.from('reels').insert(withMusic);
  if (!error) return;
  // Agar music columns abhi DB me migrate nahi hui hain, reel bina gaane ke
  // publish ho jaye — upload waste na ho.
  if (music) {
    const { error: retryError } = await supabase.from('reels').insert(base);
    if (!retryError) return;
  }
  throw error;
}

export async function toggleReelLike(reelId: string, userId: string, isLiked: boolean): Promise<void> {
  try {
    if (isLiked) {
      await supabase.from('reel_likes').delete().eq('reel_id', reelId).eq('user_id', userId);
      await supabase.rpc('decrement_reel_likes', { reel_id: reelId });
    } else {
      await supabase.from('reel_likes').insert({ reel_id: reelId, user_id: userId });
      await supabase.rpc('increment_reel_likes', { reel_id: reelId });
    }
  } catch {
    // silently ignore RPC errors
  }
}

export async function deleteReel(reelId: string): Promise<void> {
  const { error } = await supabase.from('reels').delete().eq('id', reelId);
  if (error) throw error;
}

// ===================== REEL COMMENTS =====================
export interface ReelComment {
  id: string;
  reel_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  profile?: Profile;
}

export async function getReelComments(reelId: string): Promise<ReelComment[]> {
  const { data, error } = await supabase
    .from('reel_comments')
    .select('*')
    .eq('reel_id', reelId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error || !data || data.length === 0) return [];

  // Fetch profiles separately instead of relying on a named FK relationship
  // for the embedded join — avoids breaking silently if the DB's foreign
  // key constraint name doesn't match what PostgREST expects.
  const userIds = Array.from(new Set(data.map((c: any) => c.user_id).filter(Boolean)));
  let profileMap: Record<string, Profile> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', userIds);
    profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
  }
  return data.map((c: any) => ({ ...c, profile: profileMap[c.user_id] })) as ReelComment[];
}

export async function addReelComment(reelId: string, content: string, parentId?: string | null): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) throw new Error('Comment karne ke liye login karein');
  const { error } = await supabase.from('reel_comments').insert({
    reel_id: reelId,
    user_id: uid,
    content,
    parent_id: parentId || null,
  });
  if (error) throw error;
}

export async function deleteReelComment(commentId: string): Promise<void> {
  await supabase.from('reel_comments').delete().eq('id', commentId);
}

export async function getReelCommentsCount(reelId: string): Promise<number> {
  const { count } = await supabase
    .from('reel_comments')
    .select('id', { count: 'exact', head: true })
    .eq('reel_id', reelId);
  return count || 0;
}

