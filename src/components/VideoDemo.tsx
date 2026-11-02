import { useEffect, useRef, useState } from 'react';
import type { MediaCommand } from '../types';

interface Props {
  src: string;
  poster?: string;
  /** Presenter command to apply (main screen). Ignored when undefined. */
  command?: MediaCommand | null;
  slideId: string;
  /** Show native controls (audience phones). */
  controls?: boolean;
}

/** Prerecorded demo video. On the main screen it obeys Play/Pause/Restart from the presenter. */
export function VideoDemo({ src, poster, command, slideId, controls = false }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastNonce = useRef<number | null>(null);
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || !command || command.slideId !== slideId || command.nonce === lastNonce.current) return;
    lastNonce.current = command.nonce;
    if (command.action === 'pause') { v.pause(); return; }
    if (command.action === 'restart') v.currentTime = 0;
    v.play().catch(() => {
      // Browsers block sound until someone clicks the page once. Fall back to muted.
      v.muted = true; setNeedsTap(true); v.play().catch(() => {});
    });
  }, [command, slideId]);

  return (
    <div className="video">
      <video ref={ref} src={src} poster={poster} controls={controls} playsInline preload="auto" />
      {needsTap && (
        <button className="video__unmute" onClick={() => { if (ref.current) ref.current.muted = false; setNeedsTap(false); }}>
          🔇 Click once to enable sound
        </button>
      )}
    </div>
  );
}
