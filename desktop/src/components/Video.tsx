import { useEffect, useRef } from 'react';

export function Video({ stream, muted = false }: { stream?: MediaStream | null; muted?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = video.current;
    if (!element) {
      return;
    }
    let disposed = false;
    let playPending = false;
    const observedTracks = new Set<MediaStreamTrack>();
    element.muted = muted;
    element.srcObject = stream || null;

    function tryPlayback() {
      if (disposed || !element || !stream || playPending || !element.paused) {
        return;
      }
      playPending = true;
      void element
        .play()
        .catch(() => {
          // A track may arrive before it has playable data. Retry on readiness events.
        })
        .finally(() => {
          playPending = false;
        });
    }

    function observeTracks() {
      for (const track of stream?.getTracks() || []) {
        if (!observedTracks.has(track)) {
          observedTracks.add(track);
          track.addEventListener('unmute', tryPlayback);
        }
      }
      tryPlayback();
    }

    element.addEventListener('loadedmetadata', tryPlayback);
    element.addEventListener('canplay', tryPlayback);
    stream?.addEventListener('addtrack', observeTracks);
    observeTracks();
    // Recover when a delayed or reconnected WebRTC stream becomes playable.
    const retryTimer = window.setInterval(tryPlayback, 1000);

    return () => {
      disposed = true;
      window.clearInterval(retryTimer);
      element.removeEventListener('loadedmetadata', tryPlayback);
      element.removeEventListener('canplay', tryPlayback);
      stream?.removeEventListener('addtrack', observeTracks);
      for (const track of observedTracks) {
        track.removeEventListener('unmute', tryPlayback);
      }
      element.srcObject = null;
    };
  }, [stream, muted]);

  return <video ref={video} autoPlay playsInline muted={muted} />;
}
