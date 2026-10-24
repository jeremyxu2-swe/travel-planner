import { useRef, useState } from 'react';

const KEY = 'travel-planner:side-width';
const DEFAULT = 340;
const MIN = 260;
const MAX = 760;
const MAIN_MIN = 420; // the calendar / day list never gets narrower than this

const load = () => {
  try {
    const v = Number(localStorage.getItem(KEY));
    return v >= MIN && v <= MAX ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
};

// Main content with a side panel on the right; drag the divider to change the panel's width.
// Double-click the divider to reset it. Arrow keys work when it's focused.
// The width is remembered on this device. On narrow windows the panel wraps below and
// the divider is hidden (CSS).
export default function SplitLayout({ className, main, side }) {
  const ref = useRef(null);
  const [w, setW] = useState(load);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);

  const clamp = (v) => {
    const room = (ref.current?.clientWidth || 1200) - MAIN_MIN - 24;
    return Math.round(Math.max(MIN, Math.min(MAX, room, v)));
  };
  const save = (v) => {
    try {
      localStorage.setItem(KEY, String(v));
    } catch {
      /* ignore */
    }
  };

  const onDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x0: e.clientX, w0: w, id: e.pointerId };
    setDragging(true);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    setW(clamp(d.w0 - (e.clientX - d.x0))); // dragging left makes the panel wider
  };
  const onUp = (e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    setDragging(false);
    setW((v) => (save(v), v));
  };
  const nudge = (by) =>
    setW((v) => {
      const n = clamp(v + by);
      save(n);
      return n;
    });

  return (
    <div ref={ref} className={`${className} has-split${dragging ? ' is-resizing' : ''}`} style={{ '--side-w': `${w}px` }}>
      {main}
      <div
        className="split-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the side panel"
        aria-valuenow={w}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={() => {
          setW(clamp(DEFAULT));
          save(DEFAULT);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') nudge(e.shiftKey ? 60 : 20);
          else if (e.key === 'ArrowRight') nudge(e.shiftKey ? -60 : -20);
          else return;
          e.preventDefault();
        }}
      >
        <span aria-hidden="true"><i /></span>
      </div>
      {side}
    </div>
  );
}
