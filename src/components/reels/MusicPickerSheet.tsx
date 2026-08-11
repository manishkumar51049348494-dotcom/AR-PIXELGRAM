import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Bookmark, Play, Pause, Loader2, Music2 } from 'lucide-react';
import { searchMusic, getTrendingMusic, formatMusicDuration, type MusicTrack } from '@/services/music';
import { getSavedSongs, saveSong, unsaveSong } from '@/services/savedSongs';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  /** User ne gana "Add" kiya — trimmer khulega */
  onSelect: (track: MusicTrack) => void;
}

type Tab = 'discover' | 'saved';

const MusicPickerSheet: React.FC<Props> = ({ open, onClose, onSelect }) => {
  const [tab, setTab] = useState<Tab>('discover');
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [saved, setSaved] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Trending / default list
  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    setLoading(true);
    getTrendingMusic(ac.signal)
      .then((list) => setTracks((prev) => (query.trim() ? prev : list)))
      .finally(() => setLoading(false));
    getSavedSongs().then(setSaved);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const ac = new AbortController();
    if (!q) {
      setLoading(true);
      getTrendingMusic(ac.signal).then(setTracks).finally(() => setLoading(false));
      return () => ac.abort();
    }
    setLoading(true);
    const t = setTimeout(() => {
      searchMusic(q, ac.signal)
        .then(setTracks)
        .finally(() => setLoading(false));
    }, 350);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query, open]);

  // Stop preview audio when sheet closes
  useEffect(() => {
    if (open) return;
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  }, [open]);

  const savedIds = useMemo(() => new Set(saved.map((s) => s.id)), [saved]);
  const list = tab === 'saved' ? saved : tracks;

  const togglePreview = (track: MusicTrack) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(track.previewUrl);
    audio.play().catch(() => toast.error('Preview play nahi ho paya'));
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(track.id);
  };

  const toggleSave = async (track: MusicTrack) => {
    if (savedIds.has(track.id)) {
      await unsaveSong(track.id);
      setSaved((prev) => prev.filter((s) => s.id !== track.id));
      toast.success('Song removed from saved');
    } else {
      await saveSong(track);
      setSaved((prev) => [track, ...prev]);
      toast.success('Song saved 🎵');
    }
  };

  const handleAdd = (track: MusicTrack) => {
    audioRef.current?.pause();
    setPlayingId(null);
    onSelect(track);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/40 space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-muted/60">
            <X className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="flex-1 text-base font-bold text-foreground">Add music</h2>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setTab('discover');
            }}
            placeholder="Search songs, artists…"
            className="w-full h-10 pl-9 pr-9 rounded-full bg-muted/60 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {(['discover', 'saved'] as Tab[]).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                tab === tb ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
              }`}
            >
              {tb === 'discover' ? (query.trim() ? 'Results' : 'For you') : `Saved${saved.length ? ` · ${saved.length}` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-24">
        {loading && list.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-8">
            <Music2 className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {tab === 'saved' ? 'Abhi koi saved song nahi hai.' : 'Koi gana nahi mila. Dusra naam try karo.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {list.map((track) => (
              <li key={track.id} className="flex items-center gap-3 px-4 py-2.5">
                <button
                  onClick={() => togglePreview(track)}
                  className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0"
                >
                  {track.artwork ? (
                    <img src={track.artwork} alt={track.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                    {playingId === track.id ? (
                      <Pause className="w-4 h-4 text-white" />
                    ) : (
                      <Play className="w-4 h-4 text-white" />
                    )}
                  </span>
                </button>

                <div className="flex-1 min-w-0" onClick={() => togglePreview(track)}>
                  <p className="text-sm font-semibold text-foreground truncate">{track.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {track.artist} · {formatMusicDuration(track.durationMs)}
                  </p>
                </div>

                <button onClick={() => toggleSave(track)} className="p-2 shrink-0">
                  <Bookmark
                    className={`w-5 h-5 ${savedIds.has(track.id) ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
                  />
                </button>

                <button
                  onClick={() => handleAdd(track)}
                  className="shrink-0 h-8 px-4 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[hsl(var(--p1))] to-[hsl(var(--p2))]"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MusicPickerSheet;
