import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Upload, X, Loader2, ArrowLeft, Music2, VolumeX, Volume2, Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createReel, uploadVideo, type ReelMusic } from '@/services/api';
import type { MusicTrack } from '@/services/music';
import MusicPickerSheet from '@/components/reels/MusicPickerSheet';
import MusicTrimmer from '@/components/reels/MusicTrimmer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const CreateReelPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLInputElement>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  // Music state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [trimTrack, setTrimTrack] = useState<MusicTrack | null>(null);
  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [startMs, setStartMs] = useState(0);
  const [muteOriginal, setMuteOriginal] = useState(true);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) { toast.error('Please select a video file'); return; }
    if (file.size > 100 * 1024 * 1024) { toast.error('Video must be under 100MB'); return; }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handlePublish = async () => {
    if (!user || !videoFile) { toast.error('Please select a video'); return; }
    setLoading(true);
    try {
      const videoUrl = await uploadVideo('reels', videoFile, user.id);
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
      await createReel(user.id, videoUrl, caption.trim(), undefined, music);
      toast.success('Reel published! 🎬');
      navigate('/reels');
    } catch {
      toast.error('Failed to publish reel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 glass-card border-b border-border/40 backdrop-blur-xl">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted/60 transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="flex-1 text-base font-bold text-foreground">{t('newReel')}</h1>
        <Button
          onClick={handlePublish}
          disabled={!videoFile || loading}
          size="sm"
          className="h-8 px-4 text-xs font-bold rounded-full bg-gradient-to-r from-[hsl(var(--p1))] to-[hsl(var(--p2))] text-white border-0"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : t('publish')}
        </Button>
      </div>

      <div className="px-4 pt-6 space-y-5 max-w-lg mx-auto">
        {/* Video picker */}
        {!videoPreview ? (
          <button
            onClick={() => videoRef.current?.click()}
            className="w-full aspect-[9/16] max-h-[60vh] rounded-2xl border-2 border-dashed border-primary/40 flex flex-col items-center justify-center gap-4 bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Film className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-foreground">{t('uploadVideo')}</p>
              <p className="text-xs text-muted-foreground">MP4, MOV, AVI • Max 100MB</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium">
              <Upload className="w-4 h-4" />
              {t('upload')}
            </div>
          </button>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[60vh]">
            <video
              src={videoPreview}
              className="w-full h-full object-cover"
              controls
              playsInline
              muted={!!track && muteOriginal}
            />
            <button
              onClick={() => { setVideoFile(null); setVideoPreview(null); }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        )}

        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleVideoChange}
        />

        {/* Music */}
        {!track ? (
          <button
            onClick={() => {
              if (!videoPreview) { toast.error('Pehle video select karo'); return; }
              setPickerOpen(true);
            }}
            className="w-full flex items-center gap-3 glass-card rounded-2xl px-4 py-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Music2 className="w-5 h-5 text-primary" />
            </div>
            <span className="flex-1 text-left text-sm font-semibold text-foreground">Add music</span>
            <span className="text-xs font-bold text-primary">Search</span>
          </button>
        ) : (
          <div className="glass-card rounded-2xl p-3 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg overflow-hidden bg-muted shrink-0">
                {track.artwork ? (
                  <img src={track.artwork} alt={track.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Music2 className="w-5 h-5 text-muted-foreground" /></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{track.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {track.artist} · starts at {Math.floor(startMs / 1000)}s
                </p>
              </div>
              <button onClick={() => setTrimTrack(track)} className="p-2 rounded-full hover:bg-muted/60">
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </button>
              <button onClick={() => setTrack(null)} className="p-2 rounded-full hover:bg-muted/60">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <button
              onClick={() => setMuteOriginal((m) => !m)}
              className="w-full flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5"
            >
              {muteOriginal ? <VolumeX className="w-4 h-4 text-foreground" /> : <Volume2 className="w-4 h-4 text-foreground" />}
              <span className="flex-1 text-left text-xs font-medium text-foreground">
                {muteOriginal ? 'Video ki original voice muted hai' : 'Video ki original voice on hai'}
              </span>
              <span className="text-xs font-bold text-primary">{muteOriginal ? 'Unmute' : 'Mute'}</span>
            </button>
            <button
              onClick={() => setPickerOpen(true)}
              className="w-full text-xs font-semibold text-primary py-1"
            >
              Change song
            </button>
          </div>
        )}

        {/* Caption */}
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('caption')}</label>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption for your reel... #viral #trending"
            className="min-h-20 resize-none border-0 bg-transparent focus-visible:ring-0 px-0 text-sm"
            maxLength={500}
          />
          <p className="text-right text-xs text-muted-foreground">{caption.length}/500</p>
        </div>
      </div>

      {/* Song search sheet */}
      <MusicPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(selected) => {
          setPickerOpen(false);
          setTrimTrack(selected);
        }}
      />

      {/* Trim / set start point */}
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
            toast.success('Music added 🎵');
          }}
        />
      )}
    </div>
  );
};

export default CreateReelPage;
