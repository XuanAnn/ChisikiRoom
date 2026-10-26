import { useEffect } from 'react';

/** Local two-tone ring. No downloaded media or device capture is required. */
export function useRingtone(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const context = new AudioContext();
    const activeTones = new Set<OscillatorNode>();
    function ring() {
      if (context.state === 'closed') {
        return;
      }
      void context.resume().catch(() => {});
      for (const delay of [0, 0.23]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + delay;
        oscillator.type = 'sine';
        oscillator.frequency.value = delay === 0 ? 660 : 880;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.065, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.19);
        oscillator.connect(gain);
        gain.connect(context.destination);
        activeTones.add(oscillator);
        oscillator.onended = () => {
          activeTones.delete(oscillator);
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(start);
        oscillator.stop(start + 0.2);
      }
    }
    ring();
    const timer = setInterval(ring, 1800);
    return () => {
      clearInterval(timer);
      for (const oscillator of activeTones) {
        oscillator.stop();
      }
      activeTones.clear();
      void context.close().catch(() => {});
    };
  }, [enabled]);
}
