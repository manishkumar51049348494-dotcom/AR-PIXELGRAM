// Full-screen call UI — timer, mute, camera, hang up. Renders when call is active.
import React, { useEffect, useRef, useState } from 'react';
import { useCall } from '@/contexts/CallContext';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Minimize2, Maximize2, Monitor, MonitorOff, Circle, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (secs: number) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const CallOverlay: React.FC = () => {
  const call = useCall();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (localVideoRef.current && call.localStream) {
      localVideoRef.current.srcObject = call.localStream;
      localVideoRef.current.play?.().catch(() => {});
    }
  }, [call.localStream]);
  useEffect(() => {
    if (!call.remoteStream) return;
    // Video calls: the <video> element plays remote audio too. Attaching the
    // same stream to the <audio> element also causes echo/silence on some
    // browsers, so route audio exclusively to the audio element for audio
    // calls and exclusively to the video element for video calls.
    if (call.kind === 'video') {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = call.remoteStream;
        remoteVideoRef.current.play?.().catch(() => {});
      }
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    } else {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = call.remoteStream;
        remoteAudioRef.current.play?.().catch(() => {});
      }
    }
  }, [call.remoteStream, call.kind]);

  useEffect(() => {
    if (call.status !== 'active' || !call.startedAt) { setElapsed(0); return; }
    const start = call.startedAt;
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(id);
  }, [call.status, call.startedAt]);

  const active = call.status === 'ringing-out' || call.status === 'connecting' || call.status === 'active' || call.status === 'ended';
  if (!active) return null;

  const showVideo = call.kind === 'video';
  const statusText =
    call.status === 'ringing-out' ? 'Calling…' :
    call.status === 'connecting' ? 'Connecting…' :
    call.status === 'active' ? fmt(elapsed) :
    call.endedReason || 'Call ended';

  const connecting = call.status === 'ringing-out' || call.status === 'connecting';

  // Telegram-style minimized floating pill
  if (call.minimized) {
    return (
      <>
        <audio ref={remoteAudioRef} autoPlay />
        <button
          onClick={call.toggleMinimize}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-2xl ring-1 ring-white/20 backdrop-blur"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <span className="text-sm font-medium truncate max-w-[140px]">
            {call.peerProfile?.username || 'Call'}
          </span>
          <span className="text-sm tabular-nums opacity-90">{statusText}</span>
          <Maximize2 className="w-4 h-4" />
        </button>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] text-white flex flex-col overflow-hidden">
      {/* Background */}
      {showVideo ? (
        <video ref={remoteVideoRef} autoPlay playsInline
          className="absolute inset-0 w-full h-full object-cover bg-black" />
      ) : (
        <>
          {call.peerProfile?.avatar_url && (
            <img src={call.peerProfile.avatar_url} alt=""
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/70 via-black/80 to-black" />
        </>
      )}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Foreground */}
      <div className="relative flex-1 flex flex-col">
        {/* Top-left minimize + rec indicator */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <button onClick={call.toggleMinimize}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur ring-1 ring-white/20 flex items-center justify-center hover:bg-white/20">
            <Minimize2 className="w-5 h-5" />
          </button>
          {call.recording && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/90 text-white text-xs font-medium shadow-lg">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              REC
            </div>
          )}
        </div>

        {/* Header */}
        <div className="px-6 pt-14 pb-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">
            {call.kind === 'video' ? 'Video call' : 'Voice call'}
          </p>
          <p className="mt-2 text-2xl font-semibold drop-shadow-lg">
            {call.peerProfile?.username || 'Unknown'}
          </p>
          <p className={cn('mt-1 text-sm', call.status === 'active' ? 'text-emerald-300' : 'text-white/70')}>
            {statusText}
          </p>
        </div>

        {/* Avatar (audio call) */}
        {!showVideo && (
          <div className="flex-1 flex items-center justify-center">
            <div className="relative">
              {connecting && (
                <>
                  <span className="absolute inset-0 rounded-full bg-white/10 animate-ping" />
                  <span className="absolute -inset-4 rounded-full bg-white/5 animate-ping [animation-delay:200ms]" />
                </>
              )}
              {call.peerProfile?.avatar_url ? (
                <img src={call.peerProfile.avatar_url} alt=""
                  className="relative w-40 h-40 rounded-full object-cover ring-4 ring-white/20 shadow-2xl" />
              ) : (
                <div className="relative w-40 h-40 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-5xl font-bold ring-4 ring-white/20 shadow-2xl">
                  {call.peerProfile?.username?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Local preview */}
        {showVideo && call.localStream && (
          <video ref={localVideoRef} autoPlay playsInline muted
            className="absolute bottom-52 right-4 w-28 h-40 rounded-2xl object-cover ring-1 ring-white/30 shadow-2xl bg-black z-20" />
        )}

        {/* Controls */}
        <div
          className={cn(
            'px-6 pt-6 pb-10 flex flex-col items-center gap-4 z-20',
            showVideo
              ? 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent'
              : '',
          )}
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom,0px),40px)' }}>
          {/* Secondary row: screen share + record (only during active call) */}
          {call.status === 'active' && (
            <div className="flex items-center justify-center gap-4">
              {showVideo && (
                <button onClick={call.toggleScreenShare}
                  className={cn(
                    'w-12 h-12 rounded-full backdrop-blur-xl flex items-center justify-center transition ring-1 ring-white/20 shadow-lg',
                    call.screenSharing ? 'bg-emerald-500 text-white' : 'bg-white/15 hover:bg-white/25',
                  )}
                  title="Share screen">
                  {call.screenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                </button>
              )}
              <button onClick={call.toggleRecording}
                className={cn(
                  'w-12 h-12 rounded-full backdrop-blur-xl flex items-center justify-center transition ring-1 ring-white/20 shadow-lg',
                  call.recording ? 'bg-red-500 text-white' : 'bg-white/15 hover:bg-white/25',
                )}
                title="Record call">
                {call.recording ? <Square className="w-5 h-5" fill="currentColor" /> : <Circle className="w-5 h-5" fill="currentColor" />}
              </button>
            </div>
          )}

          <div className="flex items-center justify-center gap-5">
          <button onClick={call.toggleMute}
            className={cn(
              'w-14 h-14 rounded-full backdrop-blur-xl flex items-center justify-center transition ring-1 ring-white/20 shadow-lg',
              call.muted ? 'bg-white text-black' : 'bg-white/15 hover:bg-white/25',
            )}>
            {call.muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          {showVideo && (
            <button onClick={call.toggleCamera}
              className={cn(
                'w-14 h-14 rounded-full backdrop-blur-xl flex items-center justify-center transition ring-1 ring-white/20 shadow-lg',
                call.cameraOff ? 'bg-white text-black' : 'bg-white/15 hover:bg-white/25',
              )}>
              {call.cameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          )}
          <button onClick={call.endCall} disabled={call.status === 'ended'}
            className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 flex items-center justify-center disabled:opacity-60 shadow-[0_10px_30px_-5px_rgba(239,68,68,0.6)] ring-1 ring-white/10">
            <PhoneOff className="w-8 h-8" />
          </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const IncomingCallModal: React.FC = () => {
  const call = useCall();
  if (call.status !== 'ringing-in') return null;
  return (
    <div className="fixed inset-0 z-[100] text-white flex flex-col items-center justify-between p-8 overflow-hidden">
      {call.peerProfile?.avatar_url && (
        <img src={call.peerProfile.avatar_url} alt=""
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/80 via-black/85 to-black" />
      <div className="relative flex flex-col items-center gap-4 mt-20">
        <p className="text-xs uppercase tracking-[0.25em] text-white/60">
          Incoming {call.kind} call
        </p>
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-white/10 animate-ping" />
          <span className="absolute -inset-4 rounded-full bg-white/5 animate-ping [animation-delay:200ms]" />
          {call.peerProfile?.avatar_url ? (
            <img src={call.peerProfile.avatar_url} alt=""
              className="relative w-36 h-36 rounded-full object-cover ring-4 ring-white/20 shadow-2xl" />
          ) : (
            <div className="relative w-36 h-36 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-5xl font-bold ring-4 ring-white/20 shadow-2xl">
              {call.peerProfile?.username?.[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>
        <p className="text-2xl font-semibold mt-2">{call.peerProfile?.username || 'Unknown'}</p>
        <p className="text-sm text-white/70">is calling you…</p>
      </div>
      <div className="relative flex items-center justify-around w-full max-w-xs mb-10">
        <button onClick={() => call.rejectCall()} className="flex flex-col items-center gap-2">
          <span className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-[0_10px_30px_-5px_rgba(239,68,68,0.6)] ring-1 ring-white/10">
            <PhoneOff className="w-7 h-7" />
          </span>
          <span className="text-xs text-white/80">Decline</span>
        </button>
        <button onClick={call.acceptCall} className="flex flex-col items-center gap-2">
          <span className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-[0_10px_30px_-5px_rgba(16,185,129,0.6)] ring-1 ring-white/10 animate-[pulse_1.5s_ease-in-out_infinite]">
            <Phone className="w-7 h-7" />
          </span>
          <span className="text-xs text-white/80">Accept</span>
        </button>
      </div>
    </div>
  );
};