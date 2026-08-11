// Messenger-style call UI — full screen call, incoming ringer, minimized pill.
import React, { useEffect, useRef, useState } from 'react';
import { useCall } from '@/contexts/CallContext';
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Minimize2, Maximize2,
  Monitor, MonitorOff, Circle, Square, Volume2, VolumeX, SwitchCamera, MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (secs: number) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const Avatar: React.FC<{ url?: string | null; name?: string | null; size: string; ring?: boolean }> = ({ url, name, size, ring }) => (
  url ? (
    <img src={url} alt="" className={cn(size, 'rounded-full object-cover shadow-2xl', ring && 'ring-4 ring-white/25')} />
  ) : (
    <div className={cn(size, 'rounded-full bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-2xl', ring && 'ring-4 ring-white/25')}>
      <span className="text-[2.5rem] leading-none">{name?.[0]?.toUpperCase() || '?'}</span>
    </div>
  )
);

// Round control button (Messenger style: translucent circle + label)
const Ctl: React.FC<{
  onClick?: () => void; active?: boolean; label: string; disabled?: boolean;
  children: React.ReactNode; big?: boolean; tone?: 'default' | 'danger' | 'accept';
}> = ({ onClick, active, label, disabled, children, big, tone = 'default' }) => (
  <div className="flex flex-col items-center gap-1.5">
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 shadow-lg',
        big ? 'w-[68px] h-[68px]' : 'w-14 h-14',
        tone === 'danger' && 'bg-gradient-to-br from-rose-500 to-red-600 text-white',
        tone === 'accept' && 'bg-gradient-to-br from-emerald-400 to-green-600 text-white',
        tone === 'default' && (active ? 'bg-white text-neutral-900' : 'bg-white/15 text-white backdrop-blur-xl ring-1 ring-white/20 hover:bg-white/25'),
      )}
    >
      {children}
    </button>
    <span className="text-[11px] text-white/70">{label}</span>
  </div>
);

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
    if (call.kind === 'video') {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = call.remoteStream;
        remoteVideoRef.current.play?.().catch(() => {});
      }
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    } else if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = call.remoteStream;
      remoteAudioRef.current.play?.().catch(() => {});
    }
  }, [call.remoteStream, call.kind]);

  // Speaker / earpiece routing
  useEffect(() => {
    const el = call.kind === 'video' ? remoteVideoRef.current : remoteAudioRef.current;
    if (!el) return;
    el.volume = call.speakerOn ? 1 : 0.35;
    const anyEl = el as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
    if (typeof anyEl.setSinkId === 'function') {
      anyEl.setSinkId(call.speakerOn ? 'default' : 'communications').catch(() => {});
    }
  }, [call.speakerOn, call.kind, call.remoteStream]);

  useEffect(() => {
    if (call.status !== 'active' || !call.startedAt) { setElapsed(0); return; }
    const start = call.startedAt;
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(id);
  }, [call.status, call.startedAt]);

  const visible = call.status === 'ringing-out' || call.status === 'connecting' || call.status === 'active' || call.status === 'ended';
  if (!visible) return null;

  const showVideo = call.kind === 'video';
  const statusText =
    call.status === 'ringing-out' ? 'Ringing…' :
    call.status === 'connecting' ? 'Connecting…' :
    call.status === 'active' ? fmt(elapsed) :
    call.endedReason || 'Call ended';
  const connecting = call.status === 'ringing-out' || call.status === 'connecting';
  const name = call.peerProfile?.full_name || call.peerProfile?.username || 'Unknown';

  // Minimized floating pill
  if (call.minimized) {
    return (
      <>
        <audio ref={remoteAudioRef} autoPlay />
        <button
          onClick={call.toggleMinimize}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-2xl ring-1 ring-white/20 backdrop-blur"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <span className="text-sm font-medium truncate max-w-[130px]">{call.peerProfile?.username || 'Call'}</span>
          <span className="text-sm tabular-nums opacity-90">{statusText}</span>
          <Maximize2 className="w-4 h-4" />
        </button>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] text-white flex flex-col overflow-hidden select-none">
      {/* Background */}
      {showVideo ? (
        <video ref={remoteVideoRef} autoPlay playsInline
          className="absolute inset-0 w-full h-full object-cover bg-black" />
      ) : (
        <>
          {call.peerProfile?.avatar_url && (
            <img src={call.peerProfile.avatar_url} alt=""
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-50" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-sky-900/80 via-neutral-950/90 to-black" />
        </>
      )}
      <audio ref={remoteAudioRef} autoPlay />

      <div className="relative flex-1 flex flex-col">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 z-10"
          style={{ paddingTop: 'max(env(safe-area-inset-top,0px),16px)' }}>
          <button onClick={call.toggleMinimize}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur ring-1 ring-white/20 flex items-center justify-center hover:bg-white/20">
            <Minimize2 className="w-5 h-5" />
          </button>
          {call.recording && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/90 text-xs font-medium shadow-lg">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> REC
            </div>
          )}
        </div>

        {/* Callee identity */}
        <div className={cn('px-6 text-center', showVideo ? 'pt-20' : 'pt-24')}>
          <p className="text-2xl font-semibold drop-shadow-lg">{name}</p>
          <p className={cn('mt-1 text-sm tabular-nums', call.status === 'active' ? 'text-emerald-300' : 'text-white/70')}>
            {showVideo ? 'Video call' : 'Voice call'} · {statusText}
          </p>
        </div>

        {!showVideo && (
          <div className="flex-1 flex items-center justify-center">
            <div className="relative">
              {connecting && (
                <>
                  <span className="absolute inset-0 rounded-full bg-white/10 animate-ping" />
                  <span className="absolute -inset-5 rounded-full bg-white/5 animate-ping [animation-delay:250ms]" />
                </>
              )}
              <Avatar url={call.peerProfile?.avatar_url} name={call.peerProfile?.username} size="relative w-40 h-40" ring />
            </div>
          </div>
        )}

        {/* Self preview */}
        {showVideo && call.localStream && (
          <video ref={localVideoRef} autoPlay playsInline muted
            className="absolute bottom-56 right-4 w-28 h-40 rounded-2xl object-cover ring-1 ring-white/30 shadow-2xl bg-black z-20" />
        )}

        {/* Controls */}
        <div
          className={cn(
            'z-20 px-5 pt-6 flex flex-col items-center gap-5',
            showVideo ? 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent' : 'mt-auto',
          )}
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom,0px),32px)' }}>

          {/* Secondary row */}
          {call.status === 'active' && (
            <div className="flex items-end justify-center gap-5">
              {showVideo && (
                <Ctl onClick={call.toggleScreenShare} active={call.screenSharing} label="Share">
                  {call.screenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                </Ctl>
              )}
              {showVideo && (
                <Ctl onClick={call.flipCamera} label="Flip" disabled={call.screenSharing}>
                  <SwitchCamera className="w-5 h-5" />
                </Ctl>
              )}
              <Ctl onClick={call.toggleRecording} active={call.recording} label={call.recording ? 'Stop' : 'Record'}>
                {call.recording ? <Square className="w-5 h-5" fill="currentColor" /> : <Circle className="w-5 h-5" fill="currentColor" />}
              </Ctl>
            </div>
          )}

          {/* Primary row */}
          <div className="flex items-end justify-center gap-5">
            <Ctl onClick={call.toggleSpeaker} active={!call.speakerOn} label={call.speakerOn ? 'Speaker' : 'Earpiece'}>
              {call.speakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </Ctl>
            <Ctl onClick={call.toggleMute} active={call.muted} label={call.muted ? 'Unmute' : 'Mute'}>
              {call.muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Ctl>
            {showVideo && (
              <Ctl onClick={call.toggleCamera} active={call.cameraOff} label={call.cameraOff ? 'Camera on' : 'Camera off'}>
                {call.cameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </Ctl>
            )}
            <Ctl onClick={call.endCall} disabled={call.status === 'ended'} tone="danger" big label="End">
              <PhoneOff className="w-7 h-7" />
            </Ctl>
          </div>
        </div>
      </div>
    </div>
  );
};

export const IncomingCallModal: React.FC = () => {
  const call = useCall();
  if (call.status !== 'ringing-in') return null;
  const name = call.peerProfile?.full_name || call.peerProfile?.username || 'Unknown';

  return (
    <div className="fixed inset-0 z-[101] text-white flex flex-col overflow-hidden">
      {call.peerProfile?.avatar_url && (
        <img src={call.peerProfile.avatar_url} alt=""
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-50" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-900/85 via-neutral-950/92 to-black" />

      <div className="relative flex-1 flex flex-col items-center justify-center gap-5 px-8">
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-white/10 animate-ping" />
          <span className="absolute -inset-5 rounded-full bg-white/5 animate-ping [animation-delay:250ms]" />
          <Avatar url={call.peerProfile?.avatar_url} name={call.peerProfile?.username} size="relative w-36 h-36" ring />
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold">{name}</p>
          <p className="mt-1 text-white/70 text-sm">
            {call.kind === 'video' ? 'Incoming video call' : 'Incoming voice call'}
          </p>
          {call.peerProfile?.username && (
            <p className="text-white/40 text-xs mt-0.5">@{call.peerProfile.username}</p>
          )}
        </div>
      </div>

      <div className="relative px-10 pb-12 flex items-end justify-between"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom,0px),48px)' }}>
        <Ctl onClick={() => call.rejectCall('declined')} tone="danger" big label="Decline">
          <PhoneOff className="w-7 h-7" />
        </Ctl>
        <div className="flex flex-col items-center gap-1.5 pb-2 opacity-60">
          <MessageCircle className="w-5 h-5" />
          <span className="text-[11px] text-white/70">Message</span>
        </div>
        <div className="animate-bounce">
          <Ctl onClick={call.acceptCall} tone="accept" big label="Accept">
            {call.kind === 'video' ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
          </Ctl>
        </div>
      </div>
    </div>
  );
};

export default CallOverlay;
