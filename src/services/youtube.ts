// ===================== YOUTUBE ENGINE (keyless) =====================
// Search, trending, video details (description / likes / related), comments
// और download links — सब public open-source instances (Piped + Invidious) से.
// कोई API key नहीं चाहिए. Playback official YouTube embed player से होता है.

export type YouTubeKind = 'audio' | 'video';

export interface YouTubeItem {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSec: number;
  views?: number;
  uploaded?: string;
}

export interface YouTubeStreamLink {
  url: string;
  label: string;
  ext: string;
  kind: 'audio' | 'video';
  sizeMb?: number;
}

export interface YouTubeDetails {
  id: string;
  title: string;
  channel: string;
  channelAvatar?: string;
  views?: number;
  likes?: number;
  uploaded?: string;
  description?: string;
  related: YouTubeItem[];
  audioDownloads: YouTubeStreamLink[];
  videoDownloads: YouTubeStreamLink[];
}

export interface YouTubeComment {
  id: string;
  author: string;
  avatar?: string;
  text: string;
  likes?: number;
  time?: string;
}

const PIPED = [
  'https://api.piped.private.coffee',
  'https://pipedapi.reallyaweso.me',
  'https://pipedapi.nosebs.ru',
  'https://piped-api.lunar.icu',
  'https://pipedapi.kavin.rocks',
];

const INVIDIOUS = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yewtu.be',
  'https://iv.melmac.space',
];

async function getJson<T>(url: string, signal?: AbortSignal, ms = 12000): Promise<T | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  const onAbort = () => ac.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as T & { error?: string };
    if (json && typeof json === 'object' && 'error' in json && (json as { error?: string }).error) return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function videoId(url: string): string {
  const m = /(?:[?&]v=|\/watch\/|youtu\.be\/)([\w-]{6,})/.exec(url || '');
  return m ? m[1] : '';
}

/* ------------------------------ Piped mapping ------------------------------ */

interface PipedItem {
  url?: string;
  type?: string;
  title?: string;
  uploaderName?: string;
  thumbnail?: string;
  duration?: number;
  views?: number;
  uploadedDate?: string;
}

function mapPiped(items: PipedItem[] = []): YouTubeItem[] {
  const seen = new Set<string>();
  const out: YouTubeItem[] = [];
  for (const it of items) {
    if (it.type && it.type !== 'stream') continue;
    const id = videoId(it.url || '');
    if (!id || !it.title || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: it.title,
      channel: it.uploaderName || 'YouTube',
      thumbnail: it.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      durationSec: typeof it.duration === 'number' && it.duration > 0 ? it.duration : 0,
      views: typeof it.views === 'number' && it.views > 0 ? it.views : undefined,
      uploaded: it.uploadedDate,
    });
  }
  return out;
}

/* --------------------------- Invidious mapping ---------------------------- */

interface InvItem {
  videoId?: string;
  title?: string;
  author?: string;
  lengthSeconds?: number;
  viewCount?: number;
  publishedText?: string;
  type?: string;
}

function mapInv(items: InvItem[] = []): YouTubeItem[] {
  const seen = new Set<string>();
  const out: YouTubeItem[] = [];
  for (const it of items) {
    if (it.type && it.type !== 'video') continue;
    const id = it.videoId;
    if (!id || !it.title || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: it.title,
      channel: it.author || 'YouTube',
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      durationSec: it.lengthSeconds || 0,
      views: it.viewCount || undefined,
      uploaded: it.publishedText,
    });
  }
  return out;
}

/* --------------------------------- Search --------------------------------- */

export async function searchYouTube(
  query: string,
  kind: YouTubeKind,
  signal?: AbortSignal,
): Promise<YouTubeItem[]> {
  const q = query.trim();
  if (!q) return [];
  const term = kind === 'audio' ? `${q} song` : q;

  for (const base of PIPED) {
    const json = await getJson<{ items?: PipedItem[] }>(
      `${base}/search?q=${encodeURIComponent(term)}&filter=${kind === 'audio' ? 'music_songs' : 'videos'}`,
      signal,
    );
    const mapped = mapPiped(json?.items);
    if (mapped.length) return mapped;
    if (signal?.aborted) return [];
  }

  for (const base of INVIDIOUS) {
    const json = await getJson<InvItem[]>(
      `${base}/api/v1/search?q=${encodeURIComponent(term)}&type=video`,
      signal,
    );
    const mapped = mapInv(json || []);
    if (mapped.length) return mapped;
    if (signal?.aborted) return [];
  }
  return [];
}

/* -------------------------------- Trending -------------------------------- */
// Search से पहले page खाली न रहे — India के trending गाने / वीडियो दिखते हैं.

const TRENDING_SEEDS = [
  'new hindi songs 2026',
  'trending bollywood songs',
  'punjabi hit songs',
  'latest romantic songs hindi',
];

export async function getTrending(kind: YouTubeKind, signal?: AbortSignal): Promise<YouTubeItem[]> {
  for (const base of PIPED) {
    const json = await getJson<PipedItem[]>(`${base}/trending?region=IN`, signal);
    const mapped = mapPiped(json || []);
    if (mapped.length) return mapped;
    if (signal?.aborted) return [];
  }
  for (const base of INVIDIOUS) {
    const json = await getJson<InvItem[]>(
      `${base}/api/v1/trending?region=IN${kind === 'audio' ? '&type=music' : ''}`,
      signal,
    );
    const mapped = mapInv(json || []);
    if (mapped.length) return mapped;
    if (signal?.aborted) return [];
  }
  // आख़िरी fallback — एक popular search से feed बना दो
  const seed = TRENDING_SEEDS[Math.floor(Math.random() * TRENDING_SEEDS.length)];
  return searchYouTube(seed, kind, signal);
}

/* ----------------------------- Video details ------------------------------ */

interface PipedStream {
  url?: string;
  mimeType?: string;
  quality?: string;
  format?: string;
  contentLength?: number;
  videoOnly?: boolean;
  bitrate?: number;
}

interface PipedStreams {
  title?: string;
  description?: string;
  uploader?: string;
  uploaderAvatar?: string;
  uploadDate?: string;
  views?: number;
  likes?: number;
  audioStreams?: PipedStream[];
  videoStreams?: PipedStream[];
  relatedStreams?: PipedItem[];
}

function extOf(mime?: string, fallback = 'mp4'): string {
  if (!mime) return fallback;
  if (mime.includes('mp4a') || mime.includes('audio/mp4')) return 'm4a';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('mpeg')) return 'mp3';
  return fallback;
}

function mb(bytes?: number): number | undefined {
  if (!bytes || bytes <= 0) return undefined;
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

export async function getVideoDetails(
  item: YouTubeItem,
  kind: YouTubeKind,
  signal?: AbortSignal,
): Promise<YouTubeDetails> {
  // 1) Piped
  for (const base of PIPED) {
    const d = await getJson<PipedStreams>(`${base}/streams/${item.id}`, signal);
    if (d && (d.title || d.description || d.relatedStreams)) {
      const audio = (d.audioStreams || [])
        .filter((s) => s.url)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
        .slice(0, 4)
        .map<YouTubeStreamLink>((s) => ({
          url: s.url!,
          label: `Audio ${s.quality || ''} ${extOf(s.mimeType, 'm4a').toUpperCase()}`.trim(),
          ext: extOf(s.mimeType, 'm4a'),
          kind: 'audio',
          sizeMb: mb(s.contentLength),
        }));
      const video = (d.videoStreams || [])
        .filter((s) => s.url && !s.videoOnly)
        .slice(0, 5)
        .map<YouTubeStreamLink>((s) => ({
          url: s.url!,
          label: `Video ${s.quality || ''} ${extOf(s.mimeType).toUpperCase()}`.trim(),
          ext: extOf(s.mimeType),
          kind: 'video',
          sizeMb: mb(s.contentLength),
        }));
      return {
        id: item.id,
        title: d.title || item.title,
        channel: d.uploader || item.channel,
        channelAvatar: d.uploaderAvatar,
        views: d.views ?? item.views,
        likes: d.likes,
        uploaded: d.uploadDate || item.uploaded,
        description: d.description?.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, ''),
        related: mapPiped(d.relatedStreams).filter((r) => r.id !== item.id),
        audioDownloads: audio,
        videoDownloads: video,
      };
    }
    if (signal?.aborted) break;
  }

  // 2) Invidious
  interface InvVideo {
    title?: string;
    author?: string;
    authorThumbnails?: { url: string }[];
    description?: string;
    viewCount?: number;
    likeCount?: number;
    publishedText?: string;
    recommendedVideos?: InvItem[];
    adaptiveFormats?: { url?: string; type?: string; bitrate?: string; clen?: string; qualityLabel?: string }[];
    formatStreams?: { url?: string; type?: string; qualityLabel?: string; clen?: string }[];
  }
  for (const base of INVIDIOUS) {
    const d = await getJson<InvVideo>(`${base}/api/v1/videos/${item.id}`, signal);
    if (d && d.title) {
      const audio = (d.adaptiveFormats || [])
        .filter((f) => f.url && f.type?.startsWith('audio'))
        .slice(0, 3)
        .map<YouTubeStreamLink>((f) => ({
          url: f.url!,
          label: `Audio ${extOf(f.type, 'm4a').toUpperCase()}`,
          ext: extOf(f.type, 'm4a'),
          kind: 'audio',
          sizeMb: mb(Number(f.clen)),
        }));
      const video = (d.formatStreams || [])
        .filter((f) => f.url)
        .slice(0, 4)
        .map<YouTubeStreamLink>((f) => ({
          url: f.url!,
          label: `Video ${f.qualityLabel || ''} MP4`.trim(),
          ext: 'mp4',
          kind: 'video',
          sizeMb: mb(Number(f.clen)),
        }));
      return {
        id: item.id,
        title: d.title,
        channel: d.author || item.channel,
        channelAvatar: d.authorThumbnails?.[0]?.url,
        views: d.viewCount ?? item.views,
        likes: d.likeCount,
        uploaded: d.publishedText || item.uploaded,
        description: d.description,
        related: mapInv(d.recommendedVideos).filter((r) => r.id !== item.id),
        audioDownloads: audio,
        videoDownloads: video,
      };
    }
    if (signal?.aborted) break;
  }

  // 3) कुछ न मिले तो कम से कम related list search से भर दो
  const words = item.title.split(/[|(\-–]/)[0].trim().split(/\s+/).slice(0, 5).join(' ');
  const related = await searchYouTube(words || item.channel, kind, signal);
  return {
    id: item.id,
    title: item.title,
    channel: item.channel,
    views: item.views,
    uploaded: item.uploaded,
    related: related.filter((r) => r.id !== item.id),
    audioDownloads: [],
    videoDownloads: [],
  };
}

/* -------------------------------- Comments -------------------------------- */

export async function getComments(id: string, signal?: AbortSignal): Promise<YouTubeComment[]> {
  interface PipedComment {
    commentId?: string;
    author?: string;
    thumbnail?: string;
    commentText?: string;
    likeCount?: number;
    commentedTime?: string;
  }
  for (const base of PIPED) {
    const d = await getJson<{ comments?: PipedComment[] }>(`${base}/comments/${id}`, signal);
    if (d?.comments?.length) {
      return d.comments.slice(0, 40).map((c, i) => ({
        id: c.commentId || `c${i}`,
        author: (c.author || '').replace(/^@/, ''),
        avatar: c.thumbnail || undefined,
        text: c.commentText || '',
        likes: c.likeCount,
        time: c.commentedTime,
      }));
    }
    if (signal?.aborted) return [];
  }
  interface InvComment {
    author?: string;
    authorThumbnails?: { url: string }[];
    content?: string;
    likeCount?: number;
    publishedText?: string;
  }
  for (const base of INVIDIOUS) {
    const d = await getJson<{ comments?: InvComment[] }>(`${base}/api/v1/comments/${id}`, signal);
    if (d?.comments?.length) {
      return d.comments.slice(0, 40).map((c, i) => ({
        id: `i${i}`,
        author: (c.author || '').replace(/^@/, ''),
        avatar: c.authorThumbnails?.[0]?.url,
        text: c.content || '',
        likes: c.likeCount,
        time: c.publishedText,
      }));
    }
    if (signal?.aborted) return [];
  }
  return [];
}

/* -------------------------------- Helpers --------------------------------- */

export function formatYouTubeDuration(sec: number): string {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatCount(n?: number): string {
  if (!n || n < 0) return '';
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

export function formatViews(views?: number): string {
  const c = formatCount(views);
  return c ? `${c} views` : '';
}

/** फ़ाइल का नाम safe बनाओ */
export function safeFileName(title: string, ext: string): string {
  const clean = title.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'download';
  return `${clean}.${ext}`;
}

/** download link को नए tab में खोलो (Vidmate जैसा save) */
export function startDownload(link: YouTubeStreamLink, title: string) {
  const url = `${link.url}${link.url.includes('?') ? '&' : '?'}title=${encodeURIComponent(
    safeFileName(title, link.ext),
  )}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFileName(title, link.ext);
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
