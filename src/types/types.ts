export interface Profile {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  dob: string | null;
  is_private: boolean;
  is_verified: boolean;
  is_admin: boolean;
  is_suspended: boolean;
  created_at: string;
  account_status?: 'active' | 'suspended' | 'locked' | 'permanently_disabled';
  status_reason?: string | null;
  status_updated_at?: string | null;
}

export interface Post {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  profile?: Profile;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_saved?: boolean;
}

export interface Story {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  profile?: Profile;
  is_viewed?: boolean;
  likes_count?: number;
  views_count?: number;
  media_type?: 'image' | 'video';
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
}

export interface Like {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_seen: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: 'like' | 'comment' | 'follow' | 'follow_request' | 'follow_accepted' | 'verified' | 'broadcast' | 'suspended' | 'story_like' | 'story_reply' | 'reel_like' | 'reel_comment' | 'comment_reply' | 'message';
  post_id: string | null;
  comment_id: string | null;
  message: string | null;
  is_read: boolean;
  created_at: string;
  actor?: Profile;
  post?: Post;
}

export interface VerificationRequest {
  id: string;
  user_id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at: string | null;
  created_at: string;
  profile?: Profile;
}

export interface Report {
  id: string;
  reporter_id: string;
  report_type: 'post' | 'user' | 'story' | 'bug';
  target_id: string | null;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
  reporter?: Profile;
}

export interface BroadcastNotification {
  id: string;
  title: string;
  message: string;
  created_by: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
  created_at: string;
  actor?: Profile;
}

export interface ChatConversation {
  other_user: Profile;
  last_message: Message | null;
  unread_count: number;
}
