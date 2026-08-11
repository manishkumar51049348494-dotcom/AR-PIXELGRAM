import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Music2, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { formatMusicDuration, type MusicTrack } from '@/services/music';

interface Props {
  track: MusicTrack;
  videoUrl: string;
  /** Reel me pehle se set kiya hua start point (ms) */
  initialStartMs?: number;
  initialMuteOriginal?: boolean;
  onBack: () => void;
  onDone: (opts: { startMs: number; muteOriginal: boolean }) => void;
}

// Deterministic waveform bars (fake waveform, Instagram jaisa look)
const BAR_COUNT = 48;
function barHeights(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000;
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    h = (h * 1103515245 + 12345 + i * 7) % 2147483648;
    return 30 + ((h >>> 8) % 70);
  });
}

const MusicTrimmer: React.FC<Props> = ({
  track,
  videoUrl,
  initialStartMs = 0,
  initialMuteOriginal = true,
  onBack,
  onDone,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [start, setStart] = useState(initialStartMs / 1000);
  const [muteOriginal, setMuteOriginal] = useState(initialMuteOriginal);
  const [ready, setReady] = useState(false);

  const bars = useMemo(() => barHeights(track.id), [track.id]);

  const clipLen = useMemo(() => {
    if (!audioDuration) return 0;
    const v = videoDuration || 15;
    return Math.min(audioDuration, Math.max(3, v));
  }, [audioDuration, videoDuration]);

  const maxStart = Math.max(0, audioDuration - clipLen);

  useEffect(() => {
    if (start > maxStart) setStart(maxStart);
  }, [maxStart, start]);

  // Loop the selected window and keep video in sync with the music
  useEffect(() => {
    const a = audioRef.current;
    const v = videoRef.current;
    if (!a || !ready) return;
    a.currentTime = start;
    a.play().catch(() => {});
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
    const onTime = () => {
      if (clipLen && a.currentTime >= start + clipLen) {
        a.currentTime = start;
        if (v) {
          v.currentTime = 0;
          v.play().catch(() => {});
        }
      }
    };
    a.addEventListener('timeupdate', onTime);
    return () => a.removeEventListener('timeupdate', onTime);
  }, [start, clipLen, ready]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const selStartPct = audioDuration ? (start / audioDuration) * 100 : 0;
  const selWidthPct = audioDuration ? (clipLen / audioDuration) * 100 : 100;

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-3 pb-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <button onClick={onBack} className="p-2 rounded-full bg-white/10">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <p className="flex-1 text-sm font-bold text-white">Set music</p>
        <button
          onClick={() => onDone({ startMs: Math.round(start * 1000), muteOriginal })}
          className="h-8 px-4 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[hsl(var(--p1))] to-[hsl(var(--p2))]"
        >
          Continue
        </button>
      </div>

      {/* Video preview */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          loop
          muted={muteOriginal}
          onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration || 0)}
        />
        <audio
          ref={audioRef}
          src={track.previewUrl}
          onLoadedMetadata={(e) => {
            setAudioDuration(e.currentTarget.duration || 30);
            setReady(true);
          }}
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 pb-6 pt-3 space-y-4 bg-black/90">
        {/* Track info */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg overflow-hidden bg-white/10 shrink-0">
            {track.artwork ? (
              <img src={track.artwork} alt={track.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music2 className="w-5 h-5 text-white/70" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{track.title}</p>
            <p className="text-xs text-white/60 truncate">{track.artist}</p>
          </div>
          <span className="text-xs text-white/60 tabular-nums">
            {formatMusicDuration(start * 1000)} – {formatMusicDuration((start + clipLen) * 1000)}
          </span>
        </div>

        {/* Waveform + selection window */}
        <div className="relative h-16 rounded-xl bg-white/5 px-1 overflow-hidden">
          <div className="absolute inset-0 flex items-center gap-[3px] px-1">
            {bars.map((h, i) => (
              <span
                key={i}
                className="flex-1 rounded-full bg-white/25"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div
            className="absolute top-0 bottom-0 rounded-xl border-2 border-[hsl(var(--p1))] bg-[hsl(var(--p1))]/20 pointer-events-none"
            style={{ left: `${selStartPct}%`, width: `${selWidthPct}%` }}
          />
          <input
            type="range"
            min={0}
            max={Math.max(0.1, maxStart)}
            step={0.1}
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            aria-label="Song start point"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <p className="text-[11px] text-white/50 text-center">
          Slide karke choose karo ki gana kahan se shuru ho
        </p>

        {/* Original audio toggle */}
        <button
          onClick={() => setMuteOriginal((m) => !m)}
          className="w-full flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3"
        >
          {muteOriginal ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
          <span className="flex-1 text-left text-sm font-medium text-white">
            {muteOriginal ? 'Original audio muted' : 'Original audio on'}
          </span>
          <span className="text-xs font-bold text-[hsl(var(--p1))]">{muteOriginal ? 'Unmute' : 'Mute'}</span>
        </button>
      </div>
    </div>
  );
};

export default MusicTrimmer;
