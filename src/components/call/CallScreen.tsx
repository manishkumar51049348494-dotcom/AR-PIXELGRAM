// कॉल स्क्रीन — WebRTC audio/video call with timer, mute, speaker, end
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, VolumeOff, RotateCcw } from 'lucide-react';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import type { Profile } from '@/types/types';

export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed';

export interface CallRecord {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: CallType;
  status: CallStatus;
  sdp_offer?: string;
  sdp_answer?: string;
  ice_candidates_caller?: unknown[];
  ice_candidates_receiver?: unknown[];
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  created_at: string;
}

interface CallScreenProps {
  callId: string;
  callType: CallType;
  isCaller: boolean;          // true = initiator, false = receiver
  otherProfile: Profile;
  myUserId: string;
  onCallEnd: () => void;
}

// ICE servers — Google STUN (free, no auth needed)
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const CallScreen: React.FC<CallScreenProps> = ({
  callId, callType, isCaller, otherProfile, myUserId, onCallEnd,
}) => {
  const [status, setStatus] = useState<CallStatus>(isCaller ? 'ringing' : 'ringing');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [facingFront, setFacingFront] = useState(true);
  const [callStartedAt, setCallStartedAt] = useState<Date | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const iceCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const endedRef = useRef(false);

  // ── कॉल समाप्त ─────────────────────────────────────────────────────
  const endCall = useCallback(async (reason: CallStatus = 'ended') => {
    if (endedRef.current) return;
    endedRef.current = true;

    // Stop timer
    if (timerRef.current) clearInterval(timerRef.current);

    // Close WebRTC
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    pcRef.current?.close();

    // Unsubscribe realtime channel
    channelRef.current?.unsubscribe();

    // Update DB record
    const endedAt = new Date().toISOString();
    const duration = callStartedAt
      ? Math.round((Date.now() - callStartedAt.getTime()) / 1000)
      : 0;

    await supabase.from('calls').update({
      status: reason,
      ended_at: endedAt,
      duration_seconds: duration,
    }).eq('id', callId);

    onCallEnd();
  }, [callId, callStartedAt, onCallEnd]);

  // ── WebRTC setup ────────────────────────────────────────────────────
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = async ({ candidate }) => {
      if (!candidate) return;
      iceCandidatesRef.current.push(candidate);
      // Save ICE candidates to DB for the other peer to collect
      const field = isCaller ? 'ice_candidates_caller' : 'ice_candidates_receiver';
      const all = iceCandidatesRef.current.map(c => c.toJSON());
      await supabase.from('calls').update({ [field]: all }).eq('id', callId);
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        if (!endedRef.current) endCall('ended');
      }
    };

    pcRef.current = pc;
    return pc;
  }, [callId, isCaller, endCall]);

  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video' ? { facingMode: facingFront ? 'user' : 'environment' } : false,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch {
      toast.error('माइक/कैमरा एक्सेस नहीं मिला');
      endCall('ended');
      return null;
    }
  }, [callType, facingFront, endCall]);

  // ── Caller: create offer ────────────────────────────────────────────
  const startCallerFlow = useCallback(async () => {
    const stream = await getLocalStream();
    if (!stream) return;
    const pc = createPeerConnection();
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await supabase.from('calls').update({ sdp_offer: JSON.stringify(offer) }).eq('id', callId);
  }, [callId, createPeerConnection, getLocalStream]);

  // ── Receiver: accept call ───────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    setStatus('accepted');
    const { data: callRow } = await supabase.from('calls').select('*').eq('id', callId).single();
    if (!callRow?.sdp_offer) { toast.error('Call signal नहीं मिला'); return; }

    const stream = await getLocalStream();
    if (!stream) return;
    const pc = createPeerConnection();
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(callRow.sdp_offer)));

    // Add caller ICE candidates
    (callRow.ice_candidates_caller || []).forEach((c: RTCIceCandidateInit) => {
      pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    });

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const now = new Date().toISOString();
    await supabase.from('calls').update({
      sdp_answer: JSON.stringify(answer),
      status: 'accepted',
      started_at: now,
    }).eq('id', callId);

    setCallStartedAt(new Date(now));
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
  }, [callId, createPeerConnection, getLocalStream]);

  // ── Realtime channel: watch call record changes ─────────────────────
  useEffect(() => {
    const ch = supabase
      .channel(`call-${callId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}`,
      }, async (payload) => {
        const row = payload.new as CallRecord;

        // Caller: receiver accepted → set remote description + ICE
        if (isCaller && row.status === 'accepted' && row.sdp_answer && pcRef.current) {
          const pc = pcRef.current;
          if (!pc.remoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(row.sdp_answer)));
          }
          (row.ice_candidates_receiver || []).forEach((c: unknown) => {
            pc.addIceCandidate(new RTCIceCandidate(c as RTCIceCandidateInit)).catch(() => {});
          });
          setStatus('accepted');
          const now = new Date();
          setCallStartedAt(now);
          timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
        }

        // Caller: receiver added their ICE candidates
        if (isCaller && row.ice_candidates_receiver && pcRef.current?.remoteDescription) {
          (row.ice_candidates_receiver as RTCIceCandidateInit[]).forEach(c => {
            pcRef.current!.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          });
        }

        if (row.status === 'rejected') { setStatus('rejected'); setTimeout(() => endCall('rejected'), 1500); }
        if (row.status === 'ended') { if (!endedRef.current) endCall('ended'); }
      })
      .subscribe();

    channelRef.current = ch;
    return () => { ch.unsubscribe(); };
  }, [callId, isCaller, endCall]);

  // ── Initialize call ─────────────────────────────────────────────────
  useEffect(() => {
    if (isCaller) startCallerFlow();
    // Auto-reject after 45 seconds if not answered
    const timeoutId = setTimeout(() => {
      if (status === 'ringing') endCall('missed');
    }, 45000);
    return () => clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { if (!endedRef.current) endCall('ended'); }, [endCall]);

  // ── Timer format ────────────────────────────────────────────────────
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // ── Status label ────────────────────────────────────────────────────
  const statusLabel = () => {
    if (status === 'ringing') return isCaller ? 'रिंग हो रहा है…' : 'कॉल आ रही है…';
    if (status === 'accepted') return formatTime(elapsedSeconds);
    if (status === 'rejected') return 'कॉल अस्वीकार किया गया';
    return 'कॉल समाप्त';
  };

  // ── Date/time display at top ────────────────────────────────────────
  const now = new Date();
  const dateTimeStr = now.toLocaleString('hi-IN', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // ── Toggle mute ─────────────────────────────────────────────────────
  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(!muted);
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach(t => { t.enabled = videoOff; });
    setVideoOff(!videoOff);
  };

  const flipCamera = async () => {
    if (!localStreamRef.current || callType !== 'video') return;
    const newFacing = !facingFront;
    setFacingFront(newFacing);
    localStreamRef.current.getVideoTracks().forEach(t => t.stop());
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: newFacing ? 'user' : 'environment' },
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = newStream;
      const pc = pcRef.current;
      if (pc) {
        const videoTrack = newStream.getVideoTracks()[0];
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender && videoTrack) await sender.replaceTrack(videoTrack);
      }
      localStreamRef.current = newStream;
    } catch { toast.error('कैमरा बदलने में समस्या'); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* Remote video (background) */}
      {callType === 'video' && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80 pointer-events-none" />

      {/* Top — date/time */}
      <div className="relative z-10 pt-safe px-6 pt-4">
        <p className="text-white/60 text-xs text-center">{dateTimeStr}</p>
      </div>

      {/* Center — avatar + name + status */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-4 px-6">
        {callType === 'audio' && (
          <>
            {otherProfile.avatar_url ? (
              <img src={otherProfile.avatar_url} alt="" className="w-28 h-28 rounded-full object-cover ring-4 ring-white/30 shadow-2xl" />
            ) : (
              <div className="w-28 h-28 rounded-full bg-primary/30 flex items-center justify-center ring-4 ring-white/30 shadow-2xl">
                <span className="text-white font-black text-4xl">{otherProfile.username?.[0]?.toUpperCase()}</span>
              </div>
            )}
          </>
        )}
        <div className="text-center space-y-1">
          <h2 className="text-white font-bold text-2xl">{otherProfile.full_name || otherProfile.username}</h2>
          <p className="text-white/70 text-sm">@{otherProfile.username}</p>
          <p className={`text-base font-semibold mt-2 ${status === 'accepted' ? 'text-green-400' : 'text-white/80'}`}>
            {statusLabel()}
          </p>
          {callType === 'audio' && status === 'accepted' && (
            <p className="text-white/50 text-xs">
              {callStartedAt?.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' })} से जुड़े
            </p>
          )}
        </div>
      </div>

      {/* Local video (PiP bottom-right) */}
      {callType === 'video' && (
        <div className="absolute bottom-36 right-4 z-20 w-24 h-36 rounded-xl overflow-hidden border-2 border-white/40 shadow-xl bg-black">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          {videoOff && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <VideoOff className="w-6 h-6 text-white/60" />
            </div>
          )}
        </div>
      )}

      {/* Bottom controls */}
      <div className="relative z-10 pb-safe px-8 pb-10 space-y-5">
        {/* Secondary controls row */}
        <div className="flex items-center justify-center gap-8">
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${muted ? 'bg-red-500' : 'bg-white/20 backdrop-blur'}`}
          >
            {muted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
          </button>

          {callType === 'video' && (
            <>
              <button
                onClick={toggleVideo}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${videoOff ? 'bg-red-500' : 'bg-white/20 backdrop-blur'}`}
              >
                {videoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
              </button>
              <button
                onClick={flipCamera}
                className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
              >
                <RotateCcw className="w-6 h-6 text-white" />
              </button>
            </>
          )}

          {callType === 'audio' && (
            <button
              onClick={() => setSpeakerOff(!speakerOff)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${speakerOff ? 'bg-white/10' : 'bg-white/20 backdrop-blur'}`}
            >
              {speakerOff ? <VolumeOff className="w-6 h-6 text-white/60" /> : <Volume2 className="w-6 h-6 text-white" />}
            </button>
          )}
        </div>

        {/* Accept / End row */}
        <div className="flex items-center justify-center gap-12">
          {/* Receiver: show accept button while ringing */}
          {!isCaller && status === 'ringing' && (
            <button
              onClick={acceptCall}
              className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/40 active:scale-95 transition-transform"
            >
              {callType === 'video' ? <Video className="w-7 h-7 text-white" /> : <Phone className="w-7 h-7 text-white" />}
            </button>
          )}
          {/* End / Reject button */}
          <button
            onClick={() => endCall(status === 'ringing' && !isCaller ? 'rejected' : 'ended')}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40 active:scale-95 transition-transform"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallScreen;
