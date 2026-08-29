import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Film, X, Loader2, ArrowLeft, Music2, VolumeX, Volume2, Pencil, ImageIcon,
  Play, Pause, Check, ChevronRight, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createReel, uploadVideo, uploadImage, type ReelMusic } from '@/services/api';
import type { MusicTrack } from '@/services/music';
import MusicPickerSheet from '@/components/reels/MusicPickerSheet';
import MusicTrimmer from '@/components/reels/MusicTrimmer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type Step = 'pick' | 'edit' | 'share';

/**
 * Instagram jaisa Reel upload flow:
 *  1) Pick   — gallery se video select
 *  2) Edit   — full-screen 9:16 preview, side tools (music, audio, cover)
 *  3) Share  — cover + caption + Share button
 * Songs wala pura system waise ka waisa hai (search + trim + original audio mute).
 */
const CreateReelPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [step, setStep] = useState<Step>('pick');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  // Cover frame
  const [coverTime, setCoverTime] = useState(0);
  const [coverPicker, setCoverPicker] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Music state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [trimTrack, setTrimTrack] = useState<MusicTrack | null>(null);
  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [startMs, setStartMs] = useState(0);
  const [muteOriginal, setMuteOriginal] = useState(true);

  useEffect(() => () => { if (videoPreview) URL.revokeObjectURL(videoPreview); }, [videoPreview]);

  // Song page se "Use audio" — gana pehle se laga hua aata hai
  useEffect(() => {
    const passed = (location.state as { track?: MusicTrack } | null)?.track;
    if (passed?.previewUrl) { setTrack(passed); setStartMs(0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) { toast.error('Video file select karein'); return; }
    if (file.size > 100 * 1024 * 1024) { toast.error('Video 100MB se chhota hona chahiye'); return; }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setStep('edit');
  };

  // Selected song ko video ke saath preview me chalao (Instagram jaisa feel).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track?.previewUrl) return;
    audio.currentTime = Math.min(startMs / 1000, audio.duration || startMs / 1000);
    if (playing && step === 'edit') void audio.play().catch(() => {});
    else audio.pause();
  }, [track, startMs, playing, step]);

  const togglePlay = () => {
    const v = previewRef.current;
    if (!v) return;
    if (v.paused) { void v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  /** Chosen frame se cover (thumbnail) image banata hai. */
  const captureCover = useCallback(async (): Promise<File | null> => {
    const v = previewRef.current;
    if (!v) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth || 720;
      canvas.height = v.videoHeight || 1280;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
      if (!blob) return null;
      return new File([blob], `cover_${Date.now()}.jpg`, { type: 'image/jpeg' });
    } catch {
      return null;
    }
  }, []);

  const goToShare = async () => {
    const v = previewRef.current;
    if (v) {
      v.pause();
      setPlaying(false);
      v.currentTime = coverTime;
      await new Promise(r => setTimeout(r, 250));
      const file = await captureCover();
      if (file) setCoverPreview(URL.createObjectURL(file));
    }
    audioRef.current?.pause();
    setStep('share');
  };

  const handlePublish = async () => {
    if (!user || !videoFile) { toast.error('Pehle video select karein'); return; }
    setLoading(true);
    try {
      const videoUrl = await uploadVideo('reels', videoFile, user.id);

      let thumbnailUrl: string | undefined;
      const coverFile = await captureCover();
      if (coverFile) {
        try { thumbnailUrl = await uploadImage('posts', coverFile, user.id); } catch { /* cover optional */ }
      }

      const music: ReelMusic | null = track
        ? {
            track_id: track.id,
            title: track.title,
            artist: track.artist,
            artwork_url: track.artwork,
            preview_url: track.previewUrl,
            start_ms: startMs,
            duration_ms: track.durationMs,
            mute_original: muteOriginal,
          }
        : null;

      await createReel(user.id, videoUrl, caption.trim(), thumbnailUrl, music);
      toast.success('Reel share ho gaya 🎬');
      navigate('/reels');
    } catch {
      toast.error('Reel publish nahi ho paaya');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------- STEP 1 — PICK ---------------------------- */
  if (step === 'pick') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        {/* Camera-style top bar (Instagram jaisa) */}
        <div className="flex items-center gap-2 px-3 pt-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-95">
            <X className="w-6 h-6 text-white" />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setPickerOpen(true)}
            className="h-9 px-4 rounded-full bg-white/12 backdrop-blur flex items-center gap-1.5 active:scale-95"
          >
            <Music2 className="w-4 h-4 text-white" />
            <span className="text-xs font-bold text-white">{track ? 'Music added' : 'Add music'}</span>
          </button>
        </div>

        {/* Viewfinder */}
        <button
          onClick={() => videoInputRef.current?.click()}
          className="relative flex-1 mx-3 my-3 rounded-3xl overflow-hidden active:scale-[0.99] transition-transform"
          style={{ background: 'radial-gradient(120% 90% at 50% 0%, hsl(var(--p1)/0.45), transparent 60%), #0b0b0d' }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div
              className="w-20 h-20 rounded-[26px] flex items-center justify-center shadow-2xl"
              style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}
            >
              <Film className="w-9 h-9 text-white" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-white">Gallery se video chunein</p>
              <p className="text-xs text-white/55">Ya neeche shutter dabakar camera se record karein</p>
            </div>
          </div>

          {/* Selected song chip */}
          {track && (
            <div className="absolute left-4 bottom-4 right-4 flex items-center gap-2 rounded-full bg-black/55 backdrop-blur px-3 py-2">
              {track.artwork
                ? <img src={track.artwork} alt="" className="w-6 h-6 rounded-full object-cover" />
                : <Music2 className="w-4 h-4 text-white" />}
              <span className="flex-1 text-xs text-white font-medium truncate text-left">{track.title} · {track.artist}</span>
            </div>
          )}
        </button>

        {/* Shutter row */}
        <div className="flex items-center justify-center gap-10 pb-4">
          <button onClick={() => videoInputRef.current?.click()} className="w-11 h-11 rounded-xl overflow-hidden bg-white/12 flex items-center justify-center active:scale-95">
            <ImageIcon className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-[74px] h-[74px] rounded-full p-[3px] active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}
          >
            <span className="block w-full h-full rounded-full border-[5px] border-black bg-white/95" />
          </button>
          <button onClick={() => setPickerOpen(true)} className="w-11 h-11 rounded-xl bg-white/12 flex items-center justify-center active:scale-95">
            <Music2 className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Mode strip */}
        <div className="flex items-center justify-center gap-7 pb-8 text-[12px] font-bold tracking-wide">
          <button onClick={() => navigate('/create')} className="text-white/45">POST</button>
          <span className="text-white relative">
            REEL
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white" />
          </span>
          <button onClick={() => setPickerOpen(true)} className="text-white/45">MUSIC</button>
        </div>

        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoChange} />
        {/* Phone ke camera se seedha reel record karne ke liye */}
        <input ref={cameraInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={handleVideoChange} />

        <MusicPickerSheet
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(selected) => { setPickerOpen(false); setTrack(selected); setStartMs(0); toast.success('Music add ho gaya 🎵'); }}
        />
      </div>
    );
  }


  /* ---------------------------- STEP 2 — EDIT ---------------------------- */
  if (step === 'edit') {
    return (
      <div className="fixed inset-0 bg-black">
        {/* Video */}
        <video
          ref={previewRef}
          src={videoPreview ?? undefined}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          autoPlay
          loop
          muted={!!track && muteOriginal}
          onClick={togglePlay}
          onLoadedMetadata={e => setDuration(e.currentTarget.duration || 0)}
        />
        {track?.previewUrl && <audio ref={audioRef} src={track.previewUrl} loop />}

        {!playing && (
          <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
              <Play className="w-8 h-8 text-white" />
            </div>
          </button>
        )}

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 flex items-center gap-2 px-3 pt-3">
          <button
            onClick={() => { setStep('pick'); setVideoFile(null); setVideoPreview(null); setTrack(null); }}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1" />
          <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
            {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
          </button>
        </div>

        {/* Right-side tool rail (Instagram jaisa) */}
        <div className="absolute right-3 top-20 flex flex-col gap-4">
          <button onClick={() => setPickerOpen(true)} className="flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-full bg-black/45 backdrop-blur flex items-center justify-center">
              <Music2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] font-semibold text-white">Music</span>
          </button>

          <button
            onClick={() => { if (!track) { toast.error('Pehle music add karein'); return; } setMuteOriginal(m => !m); }}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-11 h-11 rounded-full bg-black/45 backdrop-blur flex items-center justify-center">
              {muteOriginal && track ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </div>
            <span className="text-[10px] font-semibold text-white">Audio</span>
          </button>

          <button onClick={() => setCoverPicker(true)} className="flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-full bg-black/45 backdrop-blur flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] font-semibold text-white">Cover</span>
          </button>

          {track && (
            <button onClick={() => setTrimTrack(track)} className="flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-full bg-black/45 backdrop-blur flex items-center justify-center">
                <Pencil className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] font-semibold text-white">Trim</span>
            </button>
          )}
        </div>

        {/* Selected song chip */}
        {track && (
          <div className="absolute left-3 bottom-24 max-w-[65%] flex items-center gap-2 rounded-full bg-black/50 backdrop-blur px-3 py-2">
            {track.artwork ? (
              <img src={track.artwork} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : <Music2 className="w-4 h-4 text-white" />}
            <span className="text-xs text-white font-medium truncate">{track.title} · {track.artist}</span>
            <button onClick={() => setTrack(null)} className="p-0.5"><X className="w-3.5 h-3.5 text-white/80" /></button>
          </div>
        )}

        {/* Bottom Next */}
        <div className="absolute bottom-0 inset-x-0 px-4 pb-7 pt-4 bg-gradient-to-t from-black/80 to-transparent">
          <button
            onClick={() => void goToShare()}
            className="w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
            style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}
          >
            Next <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Cover frame picker */}
        {coverPicker && (
          <div className="absolute inset-x-0 bottom-0 bg-black/85 backdrop-blur px-4 pt-4 pb-8 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Cover chunein</p>
              <button onClick={() => setCoverPicker(false)}><Check className="w-5 h-5 text-white" /></button>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.1)}
              step={0.1}
              value={coverTime}
              onChange={e => {
                const t = Number(e.target.value);
                setCoverTime(t);
                if (previewRef.current) { previewRef.current.pause(); previewRef.current.currentTime = t; setPlaying(false); }
              }}
              className="w-full accent-[hsl(var(--p1))]"
            />
            <p className="text-[11px] text-white/60">Video ke jis frame par slider rukega, wahi reel ka cover banega.</p>
          </div>
        )}

        <MusicPickerSheet
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(selected) => { setPickerOpen(false); setTrimTrack(selected); }}
        />

        {trimTrack && videoPreview && (
          <MusicTrimmer
            track={trimTrack}
            videoUrl={videoPreview}
            initialStartMs={trimTrack.id === track?.id ? startMs : 0}
            initialMuteOriginal={muteOriginal}
            onBack={() => setTrimTrack(null)}
            onDone={({ startMs: s, muteOriginal: m }) => {
              setTrack(trimTrack);
              setStartMs(s);
              setMuteOriginal(m);
              setTrimTrack(null);
              toast.success('Music add ho gaya 🎵');
            }}
          />
        )}
      </div>
    );
  }

  /* ---------------------------- STEP 3 — SHARE --------------------------- */
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 glass-card border-b border-border/40 backdrop-blur-xl">
        <button onClick={() => setStep('edit')} className="p-2 rounded-full hover:bg-muted/60">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="flex-1 text-base font-bold text-foreground">New reel</h1>
      </div>

      <div className="px-4 pt-4 pb-32 space-y-4 max-w-lg mx-auto">
        {/* Caption + cover */}
        <div className="flex gap-3">
          <div className="w-20 h-32 rounded-lg overflow-hidden bg-muted shrink-0">
            {coverPreview ? (
              <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
            ) : (
              <video src={videoPreview ?? undefined} className="w-full h-full object-cover" muted />
            )}
          </div>
          <Textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Caption likhein… #viral #trending"
            className="flex-1 min-h-32 resize-none text-sm"
            maxLength={500}
          />
        </div>
        <p className="text-right text-xs text-muted-foreground">{caption.length}/500</p>

        {/* Music summary */}
        <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
          <Music2 className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {track ? `${track.title} · ${track.artist}` : 'Koi music nahi'}
            </p>
            {track && (
              <p className="text-xs text-muted-foreground">
                {Math.floor(startMs / 1000)}s se shuru · original audio {muteOriginal ? 'muted' : 'on'}
              </p>
            )}
          </div>
          <button onClick={() => setStep('edit')} className="text-xs font-bold text-primary">Change</button>
        </div>

        <button onClick={() => setStep('edit')} className="w-full glass-card rounded-xl px-4 py-3 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="flex-1 text-left text-sm font-semibold text-foreground">Cover badlein</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Share bar */}
      <div className="fixed bottom-0 inset-x-0 max-w-lg mx-auto px-4 pb-6 pt-3 bg-background/95 backdrop-blur border-t border-border/40">
        <Button
          onClick={handlePublish}
          disabled={loading}
          className="w-full h-12 font-bold rounded-xl text-white border-0"
          style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Share'}
        </Button>
      </div>
    </div>
  );
};

export default CreateReelPage;
