import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MobileLayout from '@/components/layouts/MobileLayout';
import { getReelsByMusic, type Reel } from '@/services/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Loader2, Music2, Play, Pause, Bookmark, Eye, Film } from 'lucide-react';
import { getSavedSongs, saveSong, unsaveSong } from '@/services/savedSongs';
import type { MusicTrack } from '@/services/music';
import { toast } from 'sonner';

/** Instagram jaisa "song page" — gaane ka cover, kitne reels bane, original owner. */
const SongPage: React.FC = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [saved, setSaved] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!trackId) return;
    setLoading(true);
    getReelsByMusic(trackId)
      .then(setReels)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [trackId]);

  const first = reels[0];
  const title = first?.music_title || 'Original audio';
  const artist = first?.music_artist || 'AR Pixelgram';
  const artwork = first?.music_artwork_url || undefined;
  const preview = first?.music_preview_url || undefined;
  const owner = first?.profile;
  const totalViews = reels.reduce((sum, r) => sum + (r.views_count || 0), 0);

  const asTrack = (): MusicTrack | null => {
    if (!trackId || !preview) return null;
    return { id: trackId, title, artist, artwork: artwork || '', previewUrl: preview, durationMs: 30000 };
  };

  // Saved songs list se pata karo ki ye gana pehle se save hai ya nahi
  useEffect(() => {
    if (!trackId) return;
    getSavedSongs().then(list => setSaved(list.some(t => t.id === trackId))).catch(() => {});
  }, [trackId]);

  const toggleSave = async () => {
    const track = asTrack();
    if (!track) return;
    if (saved) {
      setSaved(false);
      await unsaveSong(track.id).catch(() => {});
      toast.success('Song saved list se hata diya');
    } else {
      setSaved(true);
      await saveSong(track).catch(() => {});
      toast.success('Song save ho gaya 🎵');
    }
  };

  const useAudio = () => {
    const track = asTrack();
    if (!track) { toast.error('Is audio ka preview available nahi'); return; }
    navigate('/create-reel', { state: { track } });
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play().catch(() => {}); setPlaying(true); }
    else { a.pause(); setPlaying(false); }
  };

  return (
    <MobileLayout>
      <div className="page-transition pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted/60">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-bold text-foreground">Audio</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Song info */}
            <div className="flex items-center gap-4 px-4 py-5">
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-muted shrink-0">
                {artwork ? (
                  <img src={artwork} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music2 className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                {preview && (
                  <button
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/35 text-white"
                  >
                    {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </button>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-foreground text-lg truncate">{title}</h2>
                <p className="text-sm text-muted-foreground truncate">{artist}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Film className="w-3.5 h-3.5" />{reels.length} {reels.length === 1 ? 'reel' : 'reels'}</span>
                  <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{totalViews > 999 ? `${(totalViews / 1000).toFixed(1)}k` : totalViews} views</span>
                </div>
              </div>
            </div>

            {/* Use audio + Save — Instagram jaisa */}
            <div className="flex items-center gap-2 px-4 pb-4">
              <button
                onClick={useAudio}
                className="flex-1 h-11 rounded-xl font-bold text-white text-sm active:scale-[0.98] transition-transform"
                style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}
              >
                Use audio
              </button>
              <button
                onClick={toggleSave}
                aria-label="Save song"
                className={`w-11 h-11 rounded-xl flex items-center justify-center border border-border/60 active:scale-95 ${saved ? 'bg-primary/15 text-primary' : 'bg-muted/50 text-foreground'}`}
              >
                <Bookmark className={`w-5 h-5 ${saved ? 'fill-current' : ''}`} />
              </button>
            </div>

            {preview && <audio ref={audioRef} src={preview} onEnded={() => setPlaying(false)} />}

            {/* Original owner */}
            {owner && (
              <button
                onClick={() => navigate(`/profile/${owner.user_id}`)}
                className="flex items-center gap-3 w-full px-4 py-3 border-y border-border/40 text-left"
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage src={owner.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
                    {owner.username?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Original audio by</p>
                  <p className="font-semibold text-sm text-foreground truncate">
                    @{owner.username} {owner.is_verified && <span className="text-primary">✓</span>}
                  </p>
                </div>
              </button>
            )}

            {/* Reels grid */}
            {reels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <span className="text-4xl mb-2">🎵</span>
                <p className="text-sm text-muted-foreground">इस गाने पर अभी कोई reel नहीं</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5 mt-0.5">
                {reels.map(reel => (
                  <button
                    key={reel.id}
                    onClick={() => navigate(`/reels?r=${reel.id}`)}
                    className="relative aspect-[9/16] bg-black overflow-hidden"
                  >
                    {reel.thumbnail_url ? (
                      <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={reel.video_url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                    )}
                    <span className="absolute bottom-1 left-1 text-white text-[10px] font-semibold drop-shadow">
                      ▶ {reel.views_count || 0}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </MobileLayout>
  );
};

export default SongPage;
