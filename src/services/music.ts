// ===================== MUSIC (songs for Reels) =====================
// Real song catalog + 30s audio previews via Apple's public iTunes Search API.
// No API key needed, CORS enabled, returns song name + cover art + mp3/m4a preview.

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artwork: string;
  previewUrl: string;
  durationMs: number;
}

const ITUNES = 'https://itunes.apple.com/search';

function bigArtwork(url: string): string {
  return (url || '').replace('100x100bb', '300x300bb');
}

interface ItunesResult {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
}

function mapTracks(results: ItunesResult[]): MusicTrack[] {
  const seen = new Set<string>();
  const out: MusicTrack[] = [];
  for (const r of results) {
    if (!r.previewUrl || !r.trackName || !r.trackId) continue;
    const id = String(r.trackId);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: r.trackName,
      artist: r.artistName || 'Unknown artist',
      album: r.collectionName,
      artwork: bigArtwork(r.artworkUrl100 || ''),
      previewUrl: r.previewUrl,
      durationMs: r.trackTimeMillis || 30000,
    });
  }
  return out;
}

async function itunes(term: string, limit: number, signal?: AbortSignal): Promise<MusicTrack[]> {
  const url = `${ITUNES}?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('music search failed');
  const json = (await res.json()) as { results?: ItunesResult[] };
  return mapTracks(json.results || []);
}

/** Search songs by name / artist / lyrics keyword. */
export async function searchMusic(query: string, signal?: AbortSignal): Promise<MusicTrack[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    return await itunes(q, 30, signal);
  } catch {
    return [];
  }
}

const TRENDING_TERMS = ['trending hindi songs', 'punjabi hits', 'bollywood 2025', 'top hits'];
let trendingCache: MusicTrack[] | null = null;

/** Default / trending song list shown before the user searches anything. */
export async function getTrendingMusic(signal?: AbortSignal): Promise<MusicTrack[]> {
  if (trendingCache) return trendingCache;
  try {
    const lists = await Promise.all(
      TRENDING_TERMS.map((t) => itunes(t, 12, signal).catch(() => [] as MusicTrack[])),
    );
    const merged = mapTracks([]).concat(...lists);
    const seen = new Set<string>();
    const unique = merged.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
    if (unique.length > 0) trendingCache = unique;
    return unique;
  } catch {
    return [];
  }
}

export function formatMusicDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
