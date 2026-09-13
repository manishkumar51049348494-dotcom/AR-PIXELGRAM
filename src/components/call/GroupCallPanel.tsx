import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { createGroupCall, endGroupCall, joinGroupCall, leaveGroupCall } from '@/services/groups';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type CallKind = 'audio' | 'video';
type Signal = { type: 'invite' | 'join' | 'offer' | 'answer' | 'ice' | 'leave'; callId: string; from: string; to?: string; kind?: CallKind; offer?: RTCSessionDescriptionInit; answer?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

const VideoTile: React.FC<{ stream: MediaStream | null; muted?: boolean; label: string; local?: boolean }> = ({ stream, muted, label, local }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <div className="relative min-h-28 overflow-hidden rounded-xl bg-black"><video ref={ref} autoPlay playsInline muted={muted} className="h-full min-h-28 w-full object-cover" /><span className="absolute bottom-2 left-2 rounded bg-black/55 px-2 py-0.5 text-xs text-white">{local ? 'You' : label}</span></div>;
};

export const GroupCallPanel: React.FC<{ groupId: string }> = ({ groupId }) => {
  const { user } = useAuth();
  const channelRef = useRef<any>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<string | null>(null);
  const starterRef = useRef(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [kind, setKind] = useState<CallKind>('audio');
  const [incoming, setIncoming] = useState<Signal | null>(null);
  const [active, setActive] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [remoteLabels, setRemoteLabels] = useState<Map<string, string>>(new Map());
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const send = useCallback((signal: Signal) => {
    void channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: signal });
  }, []);

  const closePeer = useCallback((peerId: string) => {
    peersRef.current.get(peerId)?.close();
    peersRef.current.delete(peerId);
    setRemoteStreams(current => { const next = new Map(current); next.delete(peerId); return next; });
    setRemoteLabels(current => { const next = new Map(current); next.delete(peerId); return next; });
  }, []);

  const createPeer = useCallback(async (peerId: string, isInitiator: boolean, activeId: string, activeKind: CallKind) => {
    if (!user || peersRef.current.has(peerId)) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] });
    peersRef.current.set(peerId, pc);
    localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current as MediaStream));
    pc.onicecandidate = event => { if (event.candidate) send({ type: 'ice', callId: activeId, from: user.id, to: peerId, candidate: event.candidate.toJSON() }); };
    pc.ontrack = event => { const stream = event.streams[0]; if (stream) { setRemoteStreams(current => new Map(current).set(peerId, stream)); setRemoteLabels(current => new Map(current).set(peerId, peerId.slice(0, 8))); } };
    pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) closePeer(peerId); };
    if (isInitiator) {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: activeKind === 'video' });
      await pc.setLocalDescription(offer);
      send({ type: 'offer', callId: activeId, from: user.id, to: peerId, kind: activeKind, offer });
    }
  }, [closePeer, send, user]);

  const handleSignal = useCallback(async (signal: Signal) => {
    if (!user || signal.from === user.id || (signal.to && signal.to !== user.id)) return;
    if (signal.type === 'invite') { if (!active && !incoming) setIncoming(signal); return; }
    if (signal.type === 'join') {
      if (starterRef.current && signal.callId === activeCallRef.current) await createPeer(signal.from, true, signal.callId, kind);
      return;
    }
    if (signal.type === 'offer' && signal.offer) {
      if (signal.callId !== activeCallRef.current) return;
      await createPeer(signal.from, false, signal.callId, signal.kind || kind);
      const pc = peersRef.current.get(signal.from);
      if (!pc) return;
      await pc.setRemoteDescription(signal.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: 'answer', callId: signal.callId, from: user.id, to: signal.from, answer });
      return;
    }
    if (signal.type === 'answer' && signal.answer) { const pc = peersRef.current.get(signal.from); if (pc) await pc.setRemoteDescription(signal.answer); return; }
    if (signal.type === 'ice' && signal.candidate) { const pc = peersRef.current.get(signal.from); if (pc) await pc.addIceCandidate(signal.candidate); return; }
    if (signal.type === 'leave') closePeer(signal.from);
  }, [active, closePeer, createPeer, incoming, kind, send, user]);

  useEffect(() => {
    const channel = supabase.channel('group-call-signal-' + groupId);
    channel.on('broadcast', { event: 'signal' }, payload => { void handleSignal(payload.payload as Signal); }).subscribe();
    channelRef.current = channel;
    return () => { void channel.unsubscribe(); channelRef.current = null; };
  }, [groupId, handleSignal]);

  const getMedia = async (requestedKind: CallKind) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: requestedKind === 'video' });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  };

  const start = async (requestedKind: CallKind) => {
    if (!user || active) return;
    try {
      const id = await createGroupCall(groupId, requestedKind);
      await getMedia(requestedKind);
      await joinGroupCall(id);
      activeCallRef.current = id; starterRef.current = true; setCallId(id); setKind(requestedKind); setActive(true);
      send({ type: 'invite', callId: id, from: user.id, kind: requestedKind });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Call start nahi hui'); }
  };

  const accept = async () => {
    if (!incoming || !user) return;
    try {
      await getMedia(incoming.kind || 'audio');
      await joinGroupCall(incoming.callId);
      activeCallRef.current = incoming.callId; starterRef.current = false; setCallId(incoming.callId); setKind(incoming.kind || 'audio'); setActive(true); setIncoming(null);
      send({ type: 'join', callId: incoming.callId, from: user.id, to: incoming.from, kind: incoming.kind });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Call join nahi hui'); }
  };

  const leave = async () => {
    const id = activeCallRef.current;
    if (id && user) { send({ type: 'leave', callId: id, from: user.id }); try { await leaveGroupCall(id); if (starterRef.current) await endGroupCall(id); } catch { /* cleanup still continues */ } }
    peersRef.current.forEach(peer => peer.close()); peersRef.current.clear(); localStreamRef.current?.getTracks().forEach(track => track.stop()); localStreamRef.current = null; activeCallRef.current = null; starterRef.current = false; setRemoteStreams(new Map()); setLocalStream(null); setCallId(null); setActive(false); setIncoming(null);
  };

  const toggleMute = () => { const next = !muted; localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = !next; }); setMuted(next); };
  const toggleCamera = () => { const next = !cameraOff; localStreamRef.current?.getVideoTracks().forEach(track => { track.enabled = !next; }); setCameraOff(next); };

  if (incoming) return <div className="border-b border-border bg-primary/10 px-3 py-2"><div className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /><p className="min-w-0 flex-1 text-sm">Incoming group {incoming.kind} call</p><Button size="sm" onClick={() => void accept()}>Join</Button><Button size="sm" variant="outline" onClick={() => setIncoming(null)}>Dismiss</Button></div></div>;
  if (!active) return <div className="flex items-center gap-1 border-b border-border bg-card px-3 py-1.5"><span className="mr-auto text-xs text-muted-foreground">Group call</span><Button type="button" variant="ghost" size="sm" onClick={() => void start('audio')}><Phone className="mr-1 h-3.5 w-3.5" />Audio</Button><Button type="button" variant="ghost" size="sm" onClick={() => void start('video')}><Video className="mr-1 h-3.5 w-3.5" />Video</Button></div>;
  return <div className="fixed inset-0 z-[80] flex flex-col bg-neutral-950 p-3 text-white"><div className="mb-3 flex items-center justify-between"><div><p className="font-semibold">Group {kind} call</p><p className="text-xs text-white/60">{remoteStreams.size + 1} participant{remoteStreams.size === 0 ? '' : 's'}</p></div><button type="button" onClick={() => void leave()} className="rounded-full p-2 hover:bg-white/10"><PhoneOff className="h-5 w-5" /></button></div><div className="grid flex-1 auto-rows-fr grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2"><VideoTile stream={localStream} muted label="You" local />{Array.from(remoteStreams.entries()).map(([peerId, stream]) => <VideoTile key={peerId} stream={stream} label={remoteLabels.get(peerId) || 'Participant'} />)}</div><div className="flex items-center justify-center gap-4 py-3"><button type="button" onClick={toggleMute} className={"rounded-full p-3 " + (muted ? 'bg-white text-black' : 'bg-white/15')} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>{kind === 'video' && <button type="button" onClick={toggleCamera} className={"rounded-full p-3 " + (cameraOff ? 'bg-white text-black' : 'bg-white/15')} aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}>{cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}</button>}<button type="button" onClick={() => void leave()} className="rounded-full bg-red-600 p-3" aria-label="Leave call"><PhoneOff className="h-5 w-5" /></button></div></div>;
};

export default GroupCallPanel;
