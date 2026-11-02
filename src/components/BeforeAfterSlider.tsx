import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaImage } from '../types';

interface Props {
  before: MediaImage;
  after: MediaImage;
  /** Externally driven position 0–100 (e.g. from the presenter). */
  position?: number;
  /** Called while the user drags. */
  onChange?: (pos: number) => void;
  /** When false the slider only follows `position`. */
  interactive?: boolean;
  className?: string;
}

/**
 * Draggable before/after comparison. Reusable for photo edits, day-to-twilight
 * reveals and virtual staging: just pass different images and labels.
 */
export function BeforeAfterSlider({ before, after, position, onChange, interactive = true, className = '' }: Props) {
  const [pos, setPos] = useState(position ?? 50);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { if (position !== undefined && !dragging) setPos(position); }, [position, dragging]);

  const setFromClientX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
    setPos(p);
    onChange?.(p);
  }, [onChange]);

  const set = (p: number) => { const v = Math.min(100, Math.max(0, p)); setPos(v); onChange?.(v); };

  return (
    <div
      ref={ref}
      className={`ba ${dragging ? 'ba--dragging' : ''} ${interactive ? 'ba--interactive' : ''} ${className}`}
      onPointerDown={interactive ? (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDragging(true); setFromClientX(e.clientX); } : undefined}
      onPointerMove={interactive ? (e) => { if (dragging) setFromClientX(e.clientX); } : undefined}
      onPointerUp={interactive ? () => setDragging(false) : undefined}
      onPointerCancel={interactive ? () => setDragging(false) : undefined}
      style={{ ['--pos' as string]: `${pos}%` }}
    >
      <img className="ba__img" src={after.src} alt={after.alt} draggable={false} />
      <div className="ba__before">
        <img className="ba__img" src={before.src} alt={before.alt} draggable={false} />
      </div>
      <span className="ba__label ba__label--left">{before.label ?? 'Before'}</span>
      <span className="ba__label ba__label--right">{after.label ?? 'After'}</span>
      <div
        className="ba__handle"
        role="slider"
        aria-label="Comparison position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        tabIndex={interactive ? 0 : -1}
        onKeyDown={interactive ? (e) => {
          if (e.key === 'ArrowLeft') { e.stopPropagation(); e.preventDefault(); set(pos - 5); }
          if (e.key === 'ArrowRight') { e.stopPropagation(); e.preventDefault(); set(pos + 5); }
        } : undefined}
      >
        <span className="ba__knob" aria-hidden>‹ ›</span>
      </div>
    </div>
  );
}
