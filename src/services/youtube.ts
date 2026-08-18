// ===================== YOUTUBE SEARCH (keyless) =====================
// YouTube पर गाने / वीडियो खोजने के लिए public Piped API instances इस्तेमाल
// होते हैं — कोई API key नहीं चाहिए, CORS enabled. एक instance fail हो तो
// अपने आप अगला try होता है. Playback official YouTube embed player से होता है.

export type YouTubeKind = 'audio' | 'video';

export interface YouTubeItem {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSec: number;
  views?: number;
}

const INSTANCES = [
  'https://api.piped.private.coffee',
  'https://pipedapi.reallyaweso.me',
  'https://pipedapi.drgns.space',
  'https://pipedapi.kavin.rocks',
];

interface PipedItem {
  url?: string;
  type?: string;
  title?: string;
  uploaderName?: string;
  thumbnail?: string;
  duration?: number;
  views?: number;
}

function videoId(url: string): string {
  const m = /[?&]v=([\w-]{6,})/.exec(url || '');
  return m ? m[1] : '';
}

function mapItems(items: PipedItem[]): YouTubeItem[] {
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
      views: typeof it.views === 'number' ? it.views : undefined,
    });
  }
  return out;
}

/**
 * YouTube पर search करो.
 * audio  -> गाने / songs वाले results
 * video  -> normal video results
 */
export async function searchYouTube(
  query: string,
  kind: YouTubeKind,
  signal?: AbortSignal,
): Promise<YouTubeItem[]> {
  const q = query.trim();
  if (!q) return [];
  const term = kind === 'audio' ? `${q} song` : q;

  for (const base of INSTANCES) {
    try {
      const res = await fetch(
        `${base}/search?q=${encodeURIComponent(term)}&filter=${kind === 'audio' ? 'music_songs' : 'videos'}`,
        { signal },
      );
      if (!res.ok) continue;
      const json = (await res.json()) as { items?: PipedItem[]; error?: string };
      if (json.error) continue;
      const mapped = mapItems(json.items || []);
      if (mapped.length > 0) return mapped;
    } catch (err) {
      if (signal?.aborted) return [];
      // अगला instance try करो
    }
  }
  return [];
}

export function formatYouTubeDuration(sec: number): string {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatViews(views?: number): string {
  if (!views || views < 0) return '';
  if (views >= 10000000) return `${(views / 10000000).toFixed(1)}Cr views`;
  if (views >= 100000) return `${(views / 100000).toFixed(1)}L views`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
  return `${views} views`;
}
