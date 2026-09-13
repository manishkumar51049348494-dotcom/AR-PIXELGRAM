import type { Profile } from './types';

export type GroupRole = 'owner' | 'admin' | 'member';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  invite_token: string;
  invite_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: GroupRole;
  can_send_messages: boolean;
  can_send_media: boolean;
  can_call: boolean;
  can_invite: boolean;
  joined_at: string;
  profile?: Profile;
}

export interface GroupSummary {
  group: Group;
  role: GroupRole;
  member_count: number;
  last_message?: GroupMessage | null;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  reactions?: GroupMessageReaction[];
}

export interface GroupMessageReaction {
  message_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
}
