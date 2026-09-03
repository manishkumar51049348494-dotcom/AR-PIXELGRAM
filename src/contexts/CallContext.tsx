// WebRTC 1:1 audio/video calling with Supabase Realtime signaling.
// No DB migration — signaling flows over a per-user broadcast channel.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getProfile, createNotification, sendMessage, saveCallLog, formatCallDuration, sendPushTo } from '@/services/api';
import type { Profile } from '@/types/types';

export type CallKind = 'audio' | 'video';
export type CallStatus = 'idle' | 'ringing-out' | 'ringing-in' | 'connecting' | 'active' | 'ended';

interface CallState {
  status: CallStatus;
  kind: CallKind;
  peerId: string | null;
  peerProfile: Profile | null;
  startedAt: number | null;
  endedReason?: string;
}

interface CallContextValue extends CallState {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  minimized: boolean;
  screenSharing: boolean;
  recording: boolean;
  startCall: (peerId: string, kind: CallKind) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: (reason?: 'declined' | 'no-answer') => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleMinimize: () => void;
  toggleScreenShare: () => Promise<void>;
  toggleRecording: () => Promise<void>;
  speakerOn: boolean;
  toggleSpeaker: () => void;
  facingFront: boolean;
  flipCamera: () => Promise<void>;
}

const CallContext = createContext<CallContextValue | null>(null);
export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used inside CallProvider');
  return ctx;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const channelName = (uid: string) => `calls:${uid}`;

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [state, setState] = useState<CallState>({
    status: 'idle', kind: 'audio', peerId: null, peerProfile: null, startedAt: null,
  });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [facingFront, setFacingFront] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const incomingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const ringAudioRef = useRef<HTMLAudioElement | null>(null);
  const camVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const inviteRetryRef = useRef<number | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const autoAcceptRef = useRef<boolean>(false);
  const durationRef = useRef<number>(0);
  const startedAtRef = useRef<number | null>(null);
  const acceptCallRef = useRef<(() => Promise<void>) | null>(null);
  const rejectCallRef = useRef<((reason?: 'declined' | 'no-answer') => void) | null>(null);
  const endCallRef = useRef<(() => void) | null>(null);
  const stateRef = useRef<CallState | null>(null);
  const missedTimerRef = useRef<number | null>(null);

  const stopInviteRetry = useCallback(() => {
    if (inviteRetryRef.current) { clearInterval(inviteRetryRef.current); inviteRetryRef.current = null; }
    pendingOfferRef.current = null;
  }, []);

  // Keep a ref of the latest state so timers/handlers can read it.
  stateRef.current = state;

  // Sends a "missed call" alert (lock-screen push + in-app notification) to a
  // user. Used when a call is declined, unanswered, or the peer is busy.
  const sendMissedAlert = useCallback(async (
    targetId: string,
    kind: CallKind,
    fromUsername: string | undefined,
    reason: 'declined' | 'no-answer' | 'busy',
  ) => {
    const label = kind === 'video' ? 'video call' : 'voice call';
    const who = fromUsername || 'Someone';
    const body = reason === 'declined'
      ? `${who} declined your ${label}`
      : reason === 'busy'
        ? `${who} was on another call`
        : `${who} didn't answer your ${label}`;
    try {
      await supabase.functions.invoke('send-call-push', {
        body: {
          receiverId: targetId,
          title: 'Missed call',
          body,
          tag: `missed-${targetId}-${Date.now()}`,
          data: { url: '/chat', missed: true, kind },
        },
      });
    } catch (e) { console.warn('missed push failed', e); }
    createNotification(targetId, 'message', user?.id, undefined, undefined, `📵 Missed ${label} — ${body}`).catch(() => {});
    if (user?.id) {
      void saveCallLog({
        callerId: reason === 'declined' || reason === 'busy' ? targetId : user.id,
        receiverId: reason === 'declined' || reason === 'busy' ? user.id : targetId,
        callType: kind === 'video' ? 'video' : 'audio',
        status: reason === 'declined' ? 'declined' : 'missed',
        durationSec: 0,
      });
    }
  }, [user]);

  // Send helper — pushes signaling event to peer's channel
  const sendSignal = useCallback(async (peerId: string, event: string, payload: unknown) => {
    if (!user) return;
    const ch = supabase.channel(channelName(peerId));
    await ch.subscribe();
    await ch.send({ type: 'broadcast', event, payload: { from: user.id, ...(payload as object) } });
    setTimeout(() => { ch.unsubscribe(); }, 500);
  }, [user]);

  const cleanup = useCallback(() => {
    stopInviteRetry();
    if (pcRef.current) { try { pcRef.current.close(); } catch { /* noop */ } pcRef.current = null; }
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); }
    if (camVideoTrackRef.current) { try { camVideoTrackRef.current.stop(); } catch { /* noop */ } camVideoTrackRef.current = null; }
    videoSenderRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* noop */ }
    }
    setLocalStream(null);
    setRemoteStream(null);
    remoteStreamRef.current = null;
    incomingOfferRef.current = null;
    pendingIceRef.current = [];
    setMuted(false);
    setCameraOff(false);
    setMinimized(false);
    setScreenSharing(false);
    setSpeakerOn(true);
    setFacingFront(true);
    if (ringAudioRef.current) { ringAudioRef.current.pause(); ringAudioRef.current = null; }
  }, [localStream, stopInviteRetry]);

  const playRingtone = useCallback(() => {
    try {
      // simple beep loop using WebAudio — no asset needed
      const AudioCtx: typeof AudioContext = (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext: typeof AudioContext })
        .AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AudioCtx();
      const gain = ac.createGain(); gain.gain.value = 0.15; gain.connect(ac.destination);
      const loop = () => {
        const osc = ac.createOscillator(); osc.type = 'sine'; osc.frequency.value = 440;
        osc.connect(gain); osc.start(); osc.stop(ac.currentTime + 0.3);
      };
      const id = window.setInterval(loop, 800);
      const stopHolder = { pause: () => { clearInterval(id); ac.close().catch(() => {}); } } as unknown as HTMLAudioElement;
      ringAudioRef.current = stopHolder;
    } catch { /* noop */ }
  }, []);

  const buildPc = useCallback((peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      // Better connectivity + less "hang" via bundle & rtcp mux
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 4,
    });
    // Ensure a single remote MediaStream we control (fixes cases where
    // e.streams[0] is missing → no remote audio on the caller side).
    const remote = new MediaStream();
    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal(peerId, 'call-ice', { candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      // Always attach the incoming track to our own remote stream so audio
      // and video are guaranteed to play on both peers.
      try { remote.addTrack(e.track); } catch { /* dupe */ }
      setRemoteStream(remote);
      remoteStreamRef.current = remote;
      e.track.onunmute = () => setRemoteStream(new MediaStream(remote.getTracks()));
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') {
        setState(prev => {
          if (prev.startedAt) return prev;
          const now = Date.now();
          startedAtRef.current = now;
          return { ...prev, status: 'active', startedAt: now };
        });
        stopInviteRetry();
        if (ringAudioRef.current) { ringAudioRef.current.pause(); ringAudioRef.current = null; }
      }
      if (s === 'failed' || s === 'disconnected' || s === 'closed') {
        setState(prev => prev.status === 'idle' ? prev : { ...prev, status: 'ended', endedReason: 'Disconnected' });
      }
    };
    return pc;
  }, [sendSignal, stopInviteRetry]);

  const getMedia = useCallback(async (kind: CallKind) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === 'video' ? { facingMode: 'user' } : false,
    });
    setLocalStream(stream);
    const vt = stream.getVideoTracks()[0];
    if (vt) camVideoTrackRef.current = vt;
    return stream;
  }, []);

  // ---- Outgoing call
  const startCall = useCallback(async (peerId: string, kind: CallKind) => {
    if (!user) return;
    if (state.status !== 'idle' && state.status !== 'ended') return;
    try {
      const peerProfile = await getProfile(peerId);
      setState({ status: 'ringing-out', kind, peerId, peerProfile, startedAt: null });
      const stream = await getMedia(kind);
      const pc = buildPc(peerId); pcRef.current = pc;
      stream.getTracks().forEach(t => {
        const sender = pc.addTrack(t, stream);
        if (t.kind === 'video') videoSenderRef.current = sender;
      });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      playRingtone();
      pendingOfferRef.current = offer;
      await sendSignal(peerId, 'call-invite', { kind, offer });
      // Retry every 2s until answer/reject/timeout — lets the receiver pick
      // up the invite when they open the app after tapping the push.
      if (inviteRetryRef.current) clearInterval(inviteRetryRef.current);
      inviteRetryRef.current = window.setInterval(() => {
        if (pendingOfferRef.current) {
          sendSignal(peerId, 'call-invite', { kind, offer: pendingOfferRef.current }).catch(() => {});
        }
      }, 2000);
      // No answer after 45s → end the call and alert the caller locally.
      if (missedTimerRef.current) clearTimeout(missedTimerRef.current);
      missedTimerRef.current = window.setTimeout(() => {
        stopInviteRetry();
        const cur = stateRef.current;
        if (!cur || cur.status !== 'ringing-out' || cur.peerId !== peerId) return;
        sendSignal(peerId, 'call-end', { reason: 'no-answer' }).catch(() => {});
        const label = kind === 'video' ? 'video call' : 'voice call';
        const who = peerProfile?.username || 'User';
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('Missed call', {
              body: `${who} didn't answer your ${label}`,
              icon: peerProfile?.avatar_url || '/images/logo/logo-icon.svg',
              tag: `missed-${peerId}`,
            });
          } catch { /* noop */ }
        }
        sendMessage(peerId, `📵 Missed ${label}`).catch(() => {});
        cleanup();
        setState(prev => ({ ...prev, status: 'ended', endedReason: 'No answer' }));
        setTimeout(() => setState({ status: 'idle', kind: 'audio', peerId: null, peerProfile: null, startedAt: null }), 1500);
      }, 45000);
      // In-app notification (for open tabs)
      createNotification(peerId, 'message', user.id, undefined, undefined, `📞 Incoming ${kind} call`).catch(() => {});
      // Web Push (lock screen / app-closed) via edge function — must show
      // the CALLER's own identity (this device's user), not the callee's.
      const myName = profile?.username || (user.user_metadata?.username as string | undefined) || 'Someone';
      const myAvatar = profile?.avatar_url || '/images/logo/logo-icon.svg';
      try {
        await supabase.functions.invoke('send-call-push', {
          body: {
            receiverId: peerId,
            title: `Incoming ${kind} call`,
            body: `${myName} is calling you`,
            tag: `call-${user.id}`,
            data: {
              kind,
              peerId: user.id,
              icon: myAvatar,
            },
          },
        });
      } catch (e) { console.warn('push send failed', e); }
    } catch (err) {
      console.error('startCall failed', err);
      cleanup();
      setState({ status: 'ended', kind, peerId, peerProfile: null, startedAt: null, endedReason: 'Camera/Mic access denied' });
    }
  }, [user, profile, state.status, getMedia, buildPc, sendSignal, playRingtone, cleanup, stopInviteRetry]);

  // ---- Accept incoming
  const acceptCall = useCallback(async () => {
    if (!state.peerId || !incomingOfferRef.current) return;
    try {
      const stream = await getMedia(state.kind);
      const pc = buildPc(state.peerId); pcRef.current = pc;
      stream.getTracks().forEach(t => {
        const sender = pc.addTrack(t, stream);
        if (t.kind === 'video') videoSenderRef.current = sender;
      });
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
      // flush queued ICE
      for (const c of pendingIceRef.current) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* noop */ } }
      pendingIceRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal(state.peerId, 'call-answer', { answer });
      if (ringAudioRef.current) { ringAudioRef.current.pause(); ringAudioRef.current = null; }
      setState(prev => ({ ...prev, status: 'connecting' }));
    } catch (err) {
      console.error('acceptCall failed', err);
      cleanup();
      setState(prev => ({ ...prev, status: 'ended', endedReason: 'Camera/Mic access denied' }));
    }
  }, [state.peerId, state.kind, getMedia, buildPc, sendSignal, cleanup]);
  acceptCallRef.current = acceptCall;

  // Listen for service-worker push clicks so tapping "Accept" on a lock-screen
  // call notification auto-accepts once the invite arrives (or immediately if
  // it's already ringing).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMsg = (ev: MessageEvent) => {
      const d = ev.data;
      if (!d || d.type !== 'push-notification-click') return;
      if (d.action === 'accept' || d.action === 'default') {
        if (state.status === 'ringing-in') { acceptCallRef.current?.(); }
        else { autoAcceptRef.current = true; }
      } else if (d.action === 'decline') {
        if (state.status === 'ringing-in') { rejectCallRef.current?.(); }
      } else if (d.action === 'end') {
        if (state.status === 'active' || state.status === 'connecting') { endCallRef.current?.(); }
      }
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, [state.status]);

  const rejectCall = useCallback((reason: 'declined' | 'no-answer' = 'declined') => {
    if (state.peerId) {
      sendSignal(state.peerId, 'call-end', { reason: reason === 'declined' ? 'rejected' : 'no-answer' });
      // Tell the caller they have a missed call (push + in-app).
      sendMissedAlert(state.peerId, state.kind, profile?.username || (user?.user_metadata?.username as string | undefined), reason);
    }
    cleanup();
    setState({ status: 'idle', kind: 'audio', peerId: null, peerProfile: null, startedAt: null });
  }, [state.peerId, state.kind, sendSignal, cleanup, sendMissedAlert, user, profile]);
  rejectCallRef.current = rejectCall;

  const endCall = useCallback(() => {
    if (missedTimerRef.current) { clearTimeout(missedTimerRef.current); missedTimerRef.current = null; }
    // Post a "call log" message to chat with duration so both sides see it.
    const startedAt = startedAtRef.current;
    const kind = state.kind;
    const peerId = state.peerId;
    const durSec = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
    durationRef.current = durSec;
    if (state.peerId) sendSignal(state.peerId, 'call-end', { reason: 'ended', durationSec: durSec });
    if (peerId && startedAt && user) {
      const mm = Math.floor(durSec / 60).toString().padStart(2, '0');
      const ss = Math.floor(durSec % 60).toString().padStart(2, '0');
      const emoji = kind === 'video' ? '🎥' : '📞';
      const text = `${emoji} ${kind === 'video' ? 'Video' : 'Voice'} call · ${mm}:${ss}`;
      sendMessage(peerId, text).catch(() => {});
      const pretty = formatCallDuration(durSec);
      const label = kind === 'video' ? 'Video call' : 'Voice call';
      void saveCallLog({
        callerId: user.id,
        receiverId: peerId,
        callType: kind === 'video' ? 'video' : 'audio',
        status: 'answered',
        durationSec: durSec,
        startedAt: new Date(startedAt).toISOString(),
      });
      createNotification(
        peerId, 'message', user.id, undefined, undefined,
        `📞 Call ended — ${pretty}`,
      ).catch(() => {});
      void sendPushTo(peerId, `${label} ended`, `Call ended — ${pretty}`, `/chat/${user.id}`, `call-ended-${peerId}-${Date.now()}`);
    }
    startedAtRef.current = null;
    cleanup();
    setState(prev => ({ ...prev, status: 'ended' }));
    setTimeout(() => setState({ status: 'idle', kind: 'audio', peerId: null, peerProfile: null, startedAt: null }), 1500);
  }, [state.peerId, state.kind, sendSignal, cleanup, user]);
  endCallRef.current = endCall;

  const toggleMute = useCallback(() => {
    if (!localStream) return;
    const enabled = !muted;
    localStream.getAudioTracks().forEach(t => { t.enabled = !enabled; });
    setMuted(enabled);
  }, [localStream, muted]);

  const toggleCamera = useCallback(() => {
    if (!localStream) return;
    const off = !cameraOff;
    localStream.getVideoTracks().forEach(t => { t.enabled = !off; });
    setCameraOff(off);
  }, [localStream, cameraOff]);

  const toggleMinimize = useCallback(() => setMinimized(m => !m), []);

  // Speaker (loud) vs earpiece — the UI applies this to the audio element.
  const toggleSpeaker = useCallback(() => setSpeakerOn(v => !v), []);

  // Front / back camera switch during a video call.
  const flipCamera = useCallback(async () => {
    if (!localStream || screenSharing) return;
    const next = !facingFront;
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: next ? 'user' : 'environment' }, audio: false,
      });
      const newTrack = fresh.getVideoTracks()[0];
      if (!newTrack) return;
      newTrack.enabled = !cameraOff;
      if (videoSenderRef.current) { await videoSenderRef.current.replaceTrack(newTrack); }
      localStream.getVideoTracks().forEach(t => { try { t.stop(); } catch { /* noop */ } localStream.removeTrack(t); });
      localStream.addTrack(newTrack);
      camVideoTrackRef.current = newTrack;
      setLocalStream(new MediaStream(localStream.getTracks()));
      setFacingFront(next);
    } catch (err) { console.error('flip camera failed', err); }
  }, [localStream, facingFront, cameraOff, screenSharing]);

  const toggleScreenShare = useCallback(async () => {
    if (!pcRef.current || !videoSenderRef.current) return;
    try {
      if (!screenSharing) {
        const disp = await (navigator.mediaDevices as MediaDevices & { getDisplayMedia: (c?: DisplayMediaStreamOptions) => Promise<MediaStream> })
          .getDisplayMedia({ video: true, audio: false });
        const screenTrack = disp.getVideoTracks()[0];
        if (!screenTrack) return;
        await videoSenderRef.current.replaceTrack(screenTrack);
        // Reflect in local preview
        if (localStream) {
          const oldV = localStream.getVideoTracks()[0];
          if (oldV) localStream.removeTrack(oldV);
          localStream.addTrack(screenTrack);
          setLocalStream(new MediaStream(localStream.getTracks()));
        }
        setScreenSharing(true);
        screenTrack.onended = async () => {
          const cam = camVideoTrackRef.current;
          if (cam && videoSenderRef.current) {
            try { await videoSenderRef.current.replaceTrack(cam); } catch { /* noop */ }
            if (localStream) {
              localStream.getVideoTracks().forEach(t => { if (t !== cam) localStream.removeTrack(t); });
              if (!localStream.getVideoTracks().includes(cam)) localStream.addTrack(cam);
              setLocalStream(new MediaStream(localStream.getTracks()));
            }
          }
          setScreenSharing(false);
        };
      } else {
        const cam = camVideoTrackRef.current;
        if (cam && videoSenderRef.current) {
          await videoSenderRef.current.replaceTrack(cam);
          if (localStream) {
            localStream.getVideoTracks().forEach(t => { if (t !== cam) { try { t.stop(); } catch { /* noop */ } localStream.removeTrack(t); } });
            if (!localStream.getVideoTracks().includes(cam)) localStream.addTrack(cam);
            setLocalStream(new MediaStream(localStream.getTracks()));
          }
        }
        setScreenSharing(false);
      }
    } catch (err) {
      console.error('screen share failed', err);
    }
  }, [screenSharing, localStream]);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      try { recorderRef.current?.stop(); } catch { /* noop */ }
      return;
    }
    try {
      // Mix local + remote into one stream
      const mixed = new MediaStream();
      localStream?.getTracks().forEach(t => mixed.addTrack(t));
      remoteStreamRef.current?.getTracks().forEach(t => mixed.addTrack(t));
      if (mixed.getTracks().length === 0) return;
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '');
      const rec = new MediaRecorder(mixed, mime ? { mimeType: mime } : undefined);
      recordChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: mime || 'video/webm' });
        recordChunksRef.current = [];
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        a.href = url;
        a.download = `call-recording-${ts}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setRecording(false);
      };
      recorderRef.current = rec;
      rec.start(1000);
      setRecording(true);
    } catch (err) {
      console.error('recording failed', err);
      setRecording(false);
    }
  }, [recording, localStream]);

  // ---- Global signaling listener
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(channelName(user.id));
    ch.on('broadcast', { event: 'call-invite' }, async ({ payload }) => {
      const { from, kind, offer } = payload as { from: string; kind: CallKind; offer: RTCSessionDescriptionInit };
      // Busy — auto-reject
      if (state.status !== 'idle' && state.status !== 'ended') {
        // Ignore duplicate invites from the same caller (we're already ringing).
        if (state.peerId === from) return;
        const busyCh = supabase.channel(channelName(from));
        await busyCh.subscribe();
        await busyCh.send({ type: 'broadcast', event: 'call-end', payload: { from: user.id, reason: 'busy' } });
        setTimeout(() => busyCh.unsubscribe(), 300);
        sendMissedAlert(from, kind, profile?.username || (user.user_metadata?.username as string | undefined), 'busy');
        return;
      }
      incomingOfferRef.current = offer;
      const peerProfile = await getProfile(from).catch(() => null);
      setState({ status: 'ringing-in', kind, peerId: from, peerProfile, startedAt: null });
      playRingtone();
      // System notification (phone/browser)
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`Incoming ${kind} call`, {
            body: peerProfile?.username ? `From ${peerProfile.username}` : 'Someone is calling you',
            icon: peerProfile?.avatar_url || '/images/logo/logo-icon.svg',
            tag: `call-${from}`,
          });
        } catch { /* noop */ }
      }
      // Auto-accept if user tapped the push "Accept" action
      if (autoAcceptRef.current) {
        autoAcceptRef.current = false;
        setTimeout(() => { acceptCallRef.current?.(); }, 200);
      }
    });
    ch.on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
      const { answer } = payload as { answer: RTCSessionDescriptionInit };
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        for (const c of pendingIceRef.current) { try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch { /* noop */ } }
        pendingIceRef.current = [];
        setState(prev => ({ ...prev, status: 'connecting' }));
      } catch (err) { console.error('answer apply failed', err); }
    });
    ch.on('broadcast', { event: 'call-ice' }, async ({ payload }) => {
      const { candidate } = payload as { candidate: RTCIceCandidateInit };
      if (pcRef.current?.remoteDescription) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* noop */ }
      } else {
        pendingIceRef.current.push(candidate);
      }
    });
    ch.on('broadcast', { event: 'call-end' }, ({ payload }) => {
      const { reason } = payload as { reason?: string };
      stopInviteRetry();
      cleanup();
      setState(prev => ({ ...prev, status: 'ended', endedReason: reason || 'Call ended' }));
      setTimeout(() => setState({ status: 'idle', kind: 'audio', peerId: null, peerProfile: null, startedAt: null }), 1500);
    });
    ch.subscribe();
    return () => { ch.unsubscribe(); };
     
  }, [user, profile, state.status, state.peerId, playRingtone, cleanup, stopInviteRetry]);

  // Ask notification permission once
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') { Notification.requestPermission().catch(() => {}); }
  }, []);

  // While a call is active, keep a live phone-level notification showing the
  // other person's photo/name, a running call-duration timer, and an
  // "End Call" action — like a normal phone call notification. Updates every
  // second and is automatically closed once the call ends.
  useEffect(() => {
    if (state.status !== 'active') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const tag = `active-call-${user?.id || 'me'}`;
    let cancelled = false;

    const post = async () => {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (!reg?.active || cancelled) return;
      const startedAt = startedAtRef.current;
      const durSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
      const mm = Math.floor(durSec / 60).toString().padStart(2, '0');
      const ss = Math.floor(durSec % 60).toString().padStart(2, '0');
      const label = state.kind === 'video' ? 'Video call' : 'Voice call';
      const who = state.peerProfile?.username || 'Ongoing call';
      reg.active.postMessage({
        type: 'show-call-notification',
        title: `${label} · ${who}`,
        body: `${mm}:${ss} — tap to return, or end the call`,
        icon: state.peerProfile?.avatar_url || '/images/logo/logo-icon.svg',
        tag,
        actions: [{ action: 'end', title: '📴 End Call' }],
        data: { peerId: state.peerId, kind: state.kind, activeCall: true },
      });
    };

    post();
    const id = window.setInterval(post, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
      navigator.serviceWorker.ready
        .then(reg => reg.active?.postMessage({ type: 'close-call-notification', tag }))
        .catch(() => {});
    };
  }, [state.status, state.peerId, state.kind, state.peerProfile, user?.id]);

  // Receiver side: if an incoming call rings unanswered for 45s, auto-decline
  // and send the caller a missed-call alert.
  useEffect(() => {
    if (state.status !== 'ringing-in') return;
    const t = window.setTimeout(() => {
      if (stateRef.current?.status === 'ringing-in') rejectCallRef.current?.('no-answer');
    }, 45000);
    return () => clearTimeout(t);
  }, [state.status, state.peerId]);

  const value = useMemo<CallContextValue>(() => ({
    ...state, localStream, remoteStream, muted, cameraOff,
    minimized, screenSharing, recording,
    startCall, acceptCall, rejectCall, endCall, toggleMute, toggleCamera,
    toggleMinimize, toggleScreenShare, toggleRecording,
    speakerOn, toggleSpeaker, facingFront, flipCamera,
  }), [state, localStream, remoteStream, muted, cameraOff, minimized, screenSharing, recording, startCall, acceptCall, rejectCall, endCall, toggleMute, toggleCamera, toggleMinimize, toggleScreenShare, toggleRecording, speakerOn, toggleSpeaker, facingFront, flipCamera]);

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};