import { useEffect, useRef, useState } from 'react';
import { request, errorMessage } from '../lib/api';
type MediaParticipant = { id: string; status: string; camera: boolean };
type Peer = {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  candidates: RTCIceCandidateInit[];
  chain: Promise<void>;
  stream: MediaStream;
};
export function usePeerMedia(
  battleId: string,
  userId: string,
  players: MediaParticipant[],
  mode: 'battle' | 'call' = 'battle',
) {
  const call = mode === 'call';
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<Record<string, MediaStream>>({});
  const [camera, setCamera] = useState(false);
  const [mic, setMic] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [online, setOnline] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [iceReady, setIceReady] = useState(false);
  const localRef = useRef<MediaStream | null>(null);
  const peers = useRef(new Map<string, Peer>());
  const ice = useRef<RTCIceServer[]>([]);
  const iceConfigured = useRef(false);
  const activeRef = useRef(true);
  // Advertise a stable stream identity even while local capture is off, so a
  // receive-only participant can later publish without changing SDP stream IDs.
  const outgoing = useRef<MediaStream | null>(null);
  if (!outgoing.current) {
    outgoing.current = new MediaStream();
  }
  const send = async (targetId: string, kind: string, payload: unknown) => {
    await request(call ? 'callSignal' : 'signal', { id: battleId, targetId, kind, payload });
  };
  function getPeer(id: string) {
    const existing = peers.current.get(id);
    if (existing) {
      return existing;
    }
    const pc = new RTCPeerConnection({ iceServers: ice.current });
    const peer: Peer = {
      pc,
      makingOffer: false,
      candidates: [],
      chain: Promise.resolve(),
      stream: new MediaStream(),
    };
    peers.current.set(id, peer);
    // Reserve both media sections. Only the smaller UUID makes offers; changing
    // camera/mic uses replaceTrack, so two peers never race to create offers.
    for (const kind of (userId < id ? ['video', 'audio'] : []) as Array<'video' | 'audio'>) {
      const transceiver = pc.addTransceiver(kind, { direction: 'sendrecv' });
      transceiver.sender.setStreams(outgoing.current!);
      const track = localRef.current?.getTracks().find((t) => t.kind === kind);
      if (track) {
        void transceiver.sender.replaceTrack(track);
      }
    }
    pc.ontrack = (event) => {
      if (!peer.stream.getTracks().some((t) => t.id === event.track.id)) {
        peer.stream.addTrack(event.track);
      }
      setRemote((prev) => ({ ...prev, [id]: peer.stream }));
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void send(id, 'ice', event.candidate.toJSON()).catch(() => {});
      }
    };
    pc.onnegotiationneeded = async () => {
      if (userId >= id || peer.makingOffer || pc.signalingState !== 'stable') {
        return;
      }
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        await send(id, 'offer', pc.localDescription!.toJSON());
      } catch (e) {
        if (activeRef.current) {
          setMediaError(errorMessage(e));
        }
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        if (userId < id) {
          pc.restartIce();
        } else {
          void send(id, 'restart', {}).catch(() => {});
        }
        setMediaError(
          'Đường truyền video bị gián đoạn. Đang thử kết nối lại; mạng khác nhau có thể cần TURN.',
        );
      }
    };
    return peer;
  }
  useEffect(() => {
    let disposed = false;
    let signalingGeneration = 0;
    setIceReady(false);
    iceConfigured.current = false;
    activeRef.current = Boolean(userId);
    if (!userId) {
      return;
    }
    window.chisiki?.connection().then((value) => {
      if (activeRef.current) {
        setOnline(value === 'online');
      }
    });
    const configurationReady = request<{ iceServers: RTCIceServer[] }>(call ? 'callIce' : 'ice', {
      id: battleId,
    })
      .then((config) => {
        if (disposed) {
          return false;
        }
        ice.current = config.iceServers;
        iceConfigured.current = true;
        setIceReady(true);
        return true;
      })
      .catch((e) => {
        if (!disposed) {
          setMediaError(
            'Không tải được cấu hình kết nối. Hãy đóng và mở lại cuộc gọi: ' + errorMessage(e),
          );
        }
        return false;
      });
    const unsubscribe = window.chisiki?.onEvent((event) => {
      if (event.type === 'CONNECTION') {
        signalingGeneration += 1;
        setOnline(event.data === 'online');
        for (const peer of peers.current.values()) {
          peer.pc.close();
        }
        peers.current.clear();
        setRemote({});
        setEpoch((value) => value + 1);
        return;
      }
      if (
        event.type !== (call ? 'CALL_SIGNAL' : 'MEDIA_SIGNAL') ||
        (call ? event.data.callId : event.data.battleId) !== battleId
      ) {
        return;
      }
      const { senderId, kind, payload } = event.data;
      const receivedGeneration = signalingGeneration;
      void configurationReady.then((ready) => {
        if (!ready || disposed || receivedGeneration !== signalingGeneration) {
          return;
        }
        const peer = getPeer(senderId);
        const pc = peer.pc;
        peer.chain = peer.chain
          .then(async () => {
            if (kind === 'offer' || kind === 'answer') {
              if (
                (kind === 'offer' && userId < senderId) ||
                (kind === 'answer' && userId > senderId)
              ) {
                return;
              }
              await pc.setRemoteDescription(payload);
              if (kind === 'offer') {
                // Bind local tracks to the transceivers created by the incoming
                // offer. Creating separate transceivers here leaves them outside
                // the answer and produces one-way video.
                for (const transceiver of pc.getTransceivers()) {
                  const track = localRef.current
                    ?.getTracks()
                    .find((t) => t.kind === transceiver.receiver.track.kind);
                  transceiver.direction = 'sendrecv';
                  transceiver.sender.setStreams(outgoing.current!);
                  if (track) {
                    await transceiver.sender.replaceTrack(track);
                  }
                }
              }
              for (const candidate of peer.candidates) {
                await pc.addIceCandidate(candidate);
              }
              peer.candidates = [];
              if (kind === 'offer') {
                await pc.setLocalDescription();
                await send(senderId, 'answer', pc.localDescription!.toJSON());
              }
            } else if (kind === 'ice') {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(payload);
              } else {
                peer.candidates.push(payload);
              }
            } else if (kind === 'restart' && userId < senderId) {
              pc.restartIce();
            }
          })
          .catch((e) => {
            if (activeRef.current && pc.signalingState !== 'closed') {
              setMediaError(errorMessage(e));
            }
          });
      });
    });
    // The caller may offer before the invitee's window has subscribed. Signaling
    // is ephemeral: resend an unanswered offer until the other window is ready.
    const retry = setInterval(() => {
      if (!call) {
        return;
      }
      for (const [id, peer] of peers.current) {
        if (peer.pc.signalingState === 'have-local-offer' && peer.pc.localDescription) {
          void send(id, 'offer', peer.pc.localDescription.toJSON()).catch(() => {});
        }
      }
    }, 2000);
    return () => {
      disposed = true;
      activeRef.current = false;
      clearInterval(retry);
      unsubscribe?.();
      for (const p of peers.current.values()) {
        p.pc.close();
      }
      peers.current.clear();
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
    };
  }, [battleId, userId, mode]);
  useEffect(() => {
    if (!userId) {
      return;
    }
    const active = players.filter((p) => p.status === 'ACTIVE' && p.id !== userId);
    for (const [id, peer] of peers.current) {
      if (!active.some((p) => p.id === id)) {
        peer.pc.close();
        peers.current.delete(id);
        setRemote((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }
    if ((local || call) && online && iceReady && iceConfigured.current) {
      for (const p of active.filter((player) => call || player.camera)) {
        getPeer(p.id);
      }
    }
  }, [
    players.map((p) => p.id + ':' + p.status + ':' + p.camera).join(','),
    local,
    userId,
    online,
    epoch,
    iceReady,
  ]);
  async function enableCamera() {
    try {
      setMediaError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 } },
        audio: false,
      });
      if (!activeRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const audio = localRef.current?.getAudioTracks().filter((t) => t.readyState === 'live') || [];
      localRef.current?.getVideoTracks().forEach((t) => t.stop());
      audio.forEach((t) => stream.addTrack(t));
      localRef.current = stream;
      const track = stream.getVideoTracks()[0];
      track.onended = () => {
        setCamera(false);
        setMediaError(
          call
            ? 'Camera đã ngắt. Bạn vẫn có thể trò chuyện bằng mic.'
            : 'Camera đã ngắt. Bật lại trong 30 giây để tiếp tục thi đấu.',
        );
      };
      track.onmute = () => setCamera(false);
      track.onunmute = () => setCamera(track.readyState === 'live');
      for (const peer of peers.current.values()) {
        const sender = peer.pc
          .getTransceivers()
          .find((t) => t.receiver.track.kind === 'video')?.sender;
        if (sender) {
          await sender.replaceTrack(track);
        }
      }
      setLocal(stream);
      setCamera(true);
      setMic(audio.some((t) => t.enabled));
    } catch (e) {
      setCamera(false);
      setMediaError('Không mở được camera: ' + errorMessage(e));
    }
  }
  async function toggleMic() {
    try {
      const existing = localRef.current?.getAudioTracks()[0];
      if (existing) {
        existing.enabled = !existing.enabled;
        setMic(existing.enabled);
        return;
      }
      if (!localRef.current) {
        if (!call) {
          return;
        }
        localRef.current = new MediaStream();
        setLocal(localRef.current);
      }
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!activeRef.current || !localRef.current) {
        audio.getTracks().forEach((t) => t.stop());
        return;
      }
      const track = audio.getAudioTracks()[0];
      localRef.current.addTrack(track);
      for (const peer of peers.current.values()) {
        const sender = peer.pc
          .getTransceivers()
          .find((t) => t.receiver.track.kind === 'audio')?.sender;
        if (sender) {
          await sender.replaceTrack(track);
        }
      }
      setMic(true);
    } catch (e) {
      setMediaError('Không mở được microphone: ' + errorMessage(e));
    }
  }
  function disableCamera() {
    localRef.current?.getVideoTracks().forEach((t) => t.stop());
    for (const peer of peers.current.values()) {
      const sender = peer.pc
        .getTransceivers()
        .find((t) => t.receiver.track.kind === 'video')?.sender;
      if (sender) {
        void sender.replaceTrack(null).catch(() => {});
      }
    }
    setCamera(false);
  }
  return {
    local,
    remote,
    camera,
    mic,
    mediaError,
    enableCamera,
    disableCamera,
    toggleMic,
    online,
    peers,
    iceReady,
  };
}
