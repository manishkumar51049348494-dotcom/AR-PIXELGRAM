import { supabase } from '@/db/supabase';
import type { MusicTrack } from './music';

// ===================== SAVED SONGS =====================
// Instagram jaisa "save song" — DB me save hota hai (har device par milega).
// Agar table abhi migrate nahi hui, to localStorage fallback use hota hai
// taaki feature kabhi toote nahi.

const LS_KEY = 'arp_saved_songs';

function lsRead(): MusicTrack[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as MusicTrack[]) : [];
  } catch {
    return [];
  }
}

function lsWrite(tracks: MusicTrack[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(tracks));
  } catch {
    /* storage full / private mode */
  }
}

interface SavedSongRow {
  track_id: string;
  title: string;
  artist: string;
  artwork_url: string | null;
  preview_url: string;
  duration_ms: number | null;
}

function rowToTrack(r: SavedSongRow): MusicTrack {
  return {
    id: r.track_id,
    title: r.title,
    artist: r.artist,
    artwork: r.artwork_url || '',
    previewUrl: r.preview_url,
    durationMs: r.duration_ms || 30000,
  };
}

export async function getSavedSongs(): Promise<MusicTrack[]> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return lsRead();
    const { data, error } = await supabase
      .from('saved_songs')
      .select('track_id, title, artist, artwork_url, preview_url, duration_ms')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false });
    if (error) return lsRead();
    return (data || []).map((r) => rowToTrack(r as SavedSongRow));
  } catch {
    return lsRead();
  }
}

export async function saveSong(track: MusicTrack): Promise<void> {
  const local = lsRead().filter((t) => t.id !== track.id);
  lsWrite([track, ...local]);
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from('saved_songs').upsert(
      {
        user_id: userData.user.id,
        track_id: track.id,
        title: track.title,
        artist: track.artist,
        artwork_url: track.artwork || null,
        preview_url: track.previewUrl,
        duration_ms: track.durationMs,
      },
      { onConflict: 'user_id,track_id' },
    );
  } catch {
    /* DB unavailable — localStorage copy already saved */
  }
}

export async function unsaveSong(trackId: string): Promise<void> {
  lsWrite(lsRead().filter((t) => t.id !== trackId));
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from('saved_songs').delete().eq('user_id', userData.user.id).eq('track_id', trackId);
  } catch {
    /* ignore */
  }
}
