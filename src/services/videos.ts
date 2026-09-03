import { supabase } from '@/db/supabase';
import { notifyFollowersOfNewContent } from '@/services/api';
import type { Profile } from '@/types/types';
import * as tus from 'tus-js-client';

/**
 * Long-form video (YouTube jaisa) — reels se alag.
 * Table: public.videos, likes: public.video_likes, comments: public.video_comments
 * Storage bucket: 'videos' (video file + thumbnail dono isi me).
 */
export interface AppVideo {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  video_url: string;
  thumbnail_url?: string | null;
  duration_sec?: number | null;
  visibility: 'public' | 'private';
  views_count: number;
  created_at: string;
  profile?: Profile;
  is_liked?: boolean;
  likes_count?: number;
  comments_count?: number;
}

export interface AppVideoComment {
  id: string;
  video_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}

const BUCKET = 'videos';

/* ------------------------------- helpers -------------------------------- */

async function attachVideoProfiles(rows: AppVideo[]): Promise<AppVideo[]> {
  if (rows.length === 0) return [];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', userIds);
  const map = new Map<string, Profile>((profiles || []).map((p: Profile) => [p.user_id, p]));
  return rows.map((r) => ({ ...r, profile: map.get(r.user_id) }));
}

async function attachVideoMeta(rows: AppVideo[], viewerId?: string): Promise<AppVideo[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [likesRes, commentsRes, likedRes] = await Promise.all([
    supabase.from('video_likes').select('video_id').in('video_id', ids),
    supabase.from('video_comments').select('video_id').in('video_id', ids),
    viewerId
      ? supabase.from('video_likes').select('video_id').in('video_id', ids).eq('user_id', viewerId)
      : Promise.resolve({ data: [] as { video_id: string }[] }),
  ]);
  const likeCounts = new Map<string, number>();
  (likesRes.data || []).forEach((r: { video_id: string }) =>
    likeCounts.set(r.video_id, (likeCounts.get(r.video_id) || 0) + 1),
  );
  const commentCounts = new Map<string, number>();
  (commentsRes.data || []).forEach((r: { video_id: string }) =>
    commentCounts.set(r.video_id, (commentCounts.get(r.video_id) || 0) + 1),
  );
  const likedSet = new Set((likedRes.data || []).map((r: { video_id: string }) => r.video_id));
  return rows.map((r) => ({
    ...r,
    likes_count: likeCounts.get(r.id) || 0,
    comments_count: commentCounts.get(r.id) || 0,
    is_liked: likedSet.has(r.id),
  }));
}

async function decorate(rows: AppVideo[], viewerId?: string): Promise<AppVideo[]> {
  const withProfiles = await attachVideoProfiles(rows);
  return attachVideoMeta(withProfiles, viewerId);
}

async function currentUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id;
}

/* ------------------------------- uploads -------------------------------- */

/**
 * Video upload — pehle normal (direct) upload try hota hai kyunki wo sabse
 * reliable hai. Bade video ya 413 aane par resumable TUS chunks se upload
 * hota hai. Har failure par asli reason user ko dikhaya jata hai.
 */
function humanUploadError(err: unknown): string {
  const anyErr = err as { message?: string; originalResponse?: { getStatus?: () => number; getBody?: () => string } } | null;
  const status = anyErr?.originalResponse?.getStatus?.();
  const body = anyErr?.originalResponse?.getBody?.() || '';
  const raw = `${anyErr?.message || ''} ${body}`.toLowerCase();

  if (status === 413 || raw.includes('exceeded the maximum allowed size') || raw.includes('payload too large')) {
    return 'Video bahut bada hai — chhota video ya kam quality wala select karein';
  }
  if (status === 401 || status === 403 || raw.includes('unauthorized') || raw.includes('row-level security')) {
    return 'Login session expire ho gaya — dobara login karke try karein';
  }
  if (raw.includes('bucket not found')) {
    return 'Storage bucket "videos" nahi mila — admin se contact karein';
  }
  if (raw.includes('already exists')) {
    return 'Ye file pehle se upload ho chuki hai — dobara try karein';
  }
  if (status === 404 || status === 410) {
    return 'Purana adhoora upload expire ho gaya — video dobara select karein';
  }
  if (raw.includes('failed to fetch') || raw.includes('network')) {
    return 'Internet slow/disconnect hua — network check karke dobara try karein';
  }
  return anyErr?.message ? `Upload fail hua: ${anyErr.message}` : 'Upload fail hua — dobara try karein';
}

function resumableUpload(
  file: File,
  path: string,
  accessToken: string,
  onProgress?: (percent: number) => void,
  fresh = false,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const base = import.meta.env.VITE_SUPABASE_URL as string;
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    const upload = new tus.Upload(file, {
      endpoint: `${base}/storage/v1/upload/resumable`,
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: anon,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: BUCKET,
        objectName: path,
        contentType: file.type || 'video/mp4',
        cacheControl: '31536000',
      },
      onError: (uploadError) => {
        console.error('resumable video upload failed', uploadError);
        reject(uploadError);
      },
      onProgress: (uploaded, total) => {
        if (total > 0) onProgress?.(Math.min(99, Math.round((uploaded / total) * 100)));
      },
      onSuccess: () => {
        onProgress?.(100);
        resolve();
      },
    });

    void (async () => {
      try {
        const previous = await upload.findPreviousUploads();
        if (!fresh && previous.length > 0) {
          upload.resumeFromPreviousUpload(previous[0]);
        }
      } catch (resumeError) {
        console.warn('Could not inspect previous upload; starting fresh', resumeError);
      }
      upload.start();
    })();
  });
}

export async function uploadVideoFile(
  file: File,
  userId: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Session expire ho gaya — login karke dobara try karein');
  }
  const accessToken = sessionData.session.access_token;

  const publicUrl = () => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  // Chhote videos: seedha upload (fast + sabse reliable).
  const DIRECT_LIMIT = 45 * 1024 * 1024;
  if (file.size <= DIRECT_LIMIT) {
    onProgress?.(5);
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || 'video/mp4',
      cacheControl: '31536000',
      upsert: true,
    });
    if (!error) {
      onProgress?.(100);
      return publicUrl();
    }
    console.warn('direct video upload failed, trying resumable', error);
  }

  try {
    await resumableUpload(file, path, accessToken, onProgress);
    return publicUrl();
  } catch (firstError) {
    // Adhoore/expire ho chuke upload ki wajah se fail hua ho to fresh try.
    try {
      onProgress?.(0);
      const retryPath = `${userId}/${Date.now()}_retry.${ext}`;
      await resumableUpload(file, retryPath, accessToken, onProgress, true);
      return supabase.storage.from(BUCKET).getPublicUrl(retryPath).data.publicUrl;
    } catch (secondError) {
      throw new Error(humanUploadError(secondError || firstError));
    }
  }
}

export async function uploadVideoThumbnail(blob: Blob, userId: string): Promise<string> {
  const path = `${userId}/thumb_${Date.now()}.jpg`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

/* --------------------------------- CRUD --------------------------------- */

export async function createVideo(input: {
  userId: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  durationSec?: number | null;
  visibility: 'public' | 'private';
}): Promise<AppVideo> {
  const { data, error } = await supabase
    .from('videos')
    .insert({
      user_id: input.userId,
      title: input.title,
      description: input.description || null,
      video_url: input.videoUrl,
      thumbnail_url: input.thumbnailUrl || null,
      duration_sec: input.durationSec || null,
      visibility: input.visibility,
    })
    .select('*')
    .single();
  if (error) throw error;
  const video = data as AppVideo;
  if (video.visibility === 'public') {
    void notifyFollowersOfNewContent(input.userId, 'new_video', video.id, video.title);
  }
  return video;
}

export async function getVideosFeed(limit = 24, offset = 0): Promise<AppVideo[]> {
  const viewerId = await currentUserId();
  // Public videos + apne private videos (RLS bhi yahi allow karta hai).
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const rows = ((data || []) as AppVideo[]).filter(
    (v) => v.visibility === 'public' || v.user_id === viewerId,
  );
  return decorate(rows, viewerId);
}

/** YouTube jaisa search — title + description + uploader ke naam par. */
export async function searchVideos(query: string, limit = 40): Promise<AppVideo[]> {
  const q = query.trim();
  if (!q) return getVideosFeed(limit, 0);
  const viewerId = await currentUserId();
  const like = `%${q}%`;

  const [{ data: byText }, { data: profiles }] = await Promise.all([
    supabase
      .from('videos')
      .select('*')
      .or(`title.ilike.${like},description.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('profiles')
      .select('user_id')
      .or(`username.ilike.${like},full_name.ilike.${like}`)
      .limit(20),
  ]);

  let byUploader: AppVideo[] = [];
  const uploaderIds = (profiles || []).map((p: { user_id: string }) => p.user_id);
  if (uploaderIds.length > 0) {
    const { data } = await supabase
      .from('videos')
      .select('*')
      .in('user_id', uploaderIds)
      .order('created_at', { ascending: false })
      .limit(limit);
    byUploader = (data || []) as AppVideo[];
  }

  const merged = new Map<string, AppVideo>();
  [...((byText || []) as AppVideo[]), ...byUploader].forEach((v) => {
    if (v.visibility === 'public' || v.user_id === viewerId) merged.set(v.id, v);
  });
  return decorate(Array.from(merged.values()), viewerId);
}

export async function getVideoById(videoId: string): Promise<AppVideo | null> {
  const viewerId = await currentUserId();
  const { data, error } = await supabase.from('videos').select('*').eq('id', videoId).maybeSingle();
  if (error || !data) return null;
  const video = data as AppVideo;
  if (video.visibility === 'private' && video.user_id !== viewerId) return null;
  const [decorated] = await decorate([video], viewerId);
  return decorated;
}

export async function getUserVideos(userId: string, viewerId?: string): Promise<AppVideo[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = ((data || []) as AppVideo[]).filter(
    (v) => v.visibility === 'public' || v.user_id === viewerId,
  );
  return decorate(rows, viewerId);
}

export async function deleteVideo(videoId: string): Promise<void> {
  const { error } = await supabase.from('videos').delete().eq('id', videoId);
  if (error) throw error;
}

export async function updateVideoVisibility(
  videoId: string,
  visibility: 'public' | 'private',
): Promise<void> {
  const { error } = await supabase.from('videos').update({ visibility }).eq('id', videoId);
  if (error) throw error;
}

/* ------------------------------ engagement ------------------------------ */

export async function recordVideoView(videoId: string): Promise<void> {
  try {
    await supabase.rpc('increment_video_views', { video_id_input: videoId });
  } catch {
    /* RPC missing — view count silently skip */
  }
}

export async function toggleVideoLike(
  videoId: string,
  userId: string,
  wasLiked: boolean,
): Promise<void> {
  if (wasLiked) {
    const { error } = await supabase
      .from('video_likes')
      .delete()
      .eq('video_id', videoId)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('video_likes').insert({ video_id: videoId, user_id: userId });
    if (error) throw error;
  }
}

export async function getVideoComments(videoId: string): Promise<AppVideoComment[]> {
  const { data, error } = await supabase
    .from('video_comments')
    .select('*')
    .eq('video_id', videoId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = (data || []) as AppVideoComment[];
  if (rows.length === 0) return [];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', userIds);
  const map = new Map<string, Profile>((profiles || []).map((p: Profile) => [p.user_id, p]));
  return rows.map((r) => ({ ...r, profile: map.get(r.user_id) }));
}

export async function addVideoComment(videoId: string, content: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error('Comment karne ke liye login karein');
  const { error } = await supabase
    .from('video_comments')
    .insert({ video_id: videoId, user_id: uid, content });
  if (error) throw error;
}

/* ------------------------------- formatting ----------------------------- */

export function formatVideoViews(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n || 0);
}

export function formatDuration(sec?: number | null): string {
  if (!sec || sec <= 0) return '';
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const pad = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function timeAgoHi(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'अभी';
  if (mins < 60) return `${mins} मिनट पहले`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} घंटे पहले`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} दिन पहले`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} महीने पहले`;
  return `${Math.floor(months / 12)} साल पहले`;
}
