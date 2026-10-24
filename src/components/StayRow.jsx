import { useEffect, useRef, useState } from 'react';
import { addDays, daysBetween, fmtTime } from '../lib/time.js';
import Icon from './Icon.jsx';

// The "Stay" row under "Anytime" in the calendar: one bar per hotel, covering
// every day from check-in to check-out (edge to edge). Back-to-back hotels share
// the changeover day, so they stack on separate lines.
//   Drag across days          → new stay (check-in = first day, check-out = last day)
//   Click a day               → new 1-night stay
//   Drag a bar                → move the whole stay
//   Drag a bar's left/right end → change check-in / check-out
// Touch: press and hold, then drag.

const LONG_PRESS_MS = 350;
const SLOP = 6;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function lanes(stays) {
  const ends = [];
  return [...stays]
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || b.checkOut.localeCompare(a.checkOut))
    .map((s) => {
      let lane = ends.findIndex((end) => end < s.checkIn);
      if (lane === -1) {
        lane = ends.length;
        ends.push(s.checkOut);
      } else ends[lane] = s.checkOut;
      return { s, lane };
    });
}

export function staysOn(stays, date) {
  return stays
    .filter((s) => s.checkIn <= date && date <= s.checkOut)
    .map((s) => {
      const nights = daysBetween(s.checkIn, s.checkOut);
      let note;
      if (date === s.checkOut) note = `Check-out${s.checkOutTime ? ` ${fmtTime(s.checkOutTime)}` : ''}`;
      else if (date === s.checkIn) note = `Check-in${s.checkInTime ? ` ${fmtTime(s.checkInTime)}` : ''} · ${nights} night${nights === 1 ? '' : 's'}`;
      else note = `Night ${daysBetween(s.checkIn, date) + 1} of ${nights}`;
      return { s, note, out: date === s.checkOut };
    });
}

export default function StayRow({ dates, stays, pending, onCreate, onEdit, onUpdate, readOnly }) {
  const n = dates.length;
  const row = useRef(null);
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const first = dates[0];
  const idxOf = (d) => daysBetween(first, d);
  const dateAt = (i) => addDays(first, i);

  useEffect(() => {
    const el = row.current;
    if (!el) return undefined;
    const stop = (e) => dragRef.current?.active && e.preventDefault();
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, []);

  // Day column under the pointer.
  const pos = (e) => {
    const r = row.current.getBoundingClientRect();
    const f = ((e.clientX - r.left) / r.width) * n;
    return { col: clamp(Math.floor(f), 0, n - 1) };
  };

  const preview = (d, e) => {
    const { col } = pos(e);
    if (d.type === 'create') {
      const a = d.anchor;
      return col === a ? { ...d, inI: a, outI: a + 1 } : { ...d, inI: Math.min(a, col), outI: Math.max(a, col) };
    }
    if (d.type === 'move') {
      const delta = col - d.grab;
      return { ...d, inI: d.in0 + delta, outI: d.out0 + delta };
    }
    if (d.type === 'start') return { ...d, inI: Math.min(col, d.out0 - 1), outI: d.out0 };
    return { ...d, inI: d.in0, outI: Math.max(col, d.in0 + 1) }; // end
  };

  const set = (d) => {
    dragRef.current = d;
    setDrag(d ? { ...d } : null);
  };

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const bar = e.target.closest('[data-stay]');
    if (readOnly && !bar) return; // view only: nothing to create
    const { col } = pos(e);
    const base = { pointerId: e.pointerId, touch: e.pointerType === 'touch', x0: e.clientX, y0: e.clientY, active: false, moved: false };
    let d;
    if (bar) {
      const s = stays.find((x) => x.id === bar.dataset.stay);
      const edge = e.target.closest('[data-edge]')?.dataset.edge;
      d = { ...base, type: edge || 'move', stay: s, in0: idxOf(s.checkIn), out0: idxOf(s.checkOut), grab: col };
      d.inI = d.in0;
      d.outI = d.out0;
    } else {
      d = { ...base, type: 'create', anchor: col, inI: col, outI: col + 1 };
    }
    if (readOnly) d.view = true; // view only: a tap opens it, nothing moves
    dragRef.current = d;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (d.view) return;
    if (d.touch) {
      d.timer = setTimeout(() => {
        if (dragRef.current === d && !d.cancelled) {
          navigator.vibrate?.(10);
          set({ ...d, active: true });
        }
      }, LONG_PRESS_MS);
    } else if (d.type === 'create') set({ ...d, active: true });
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const far = Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > SLOP;
    if (d.view) {
      if (far) dragRef.current = null;
      return;
    }
    if (d.touch && !d.active) {
      if (far) {
        clearTimeout(d.timer);
        d.cancelled = true;
        dragRef.current = null;
      }
      return;
    }
    if (!d.active) {
      if (!far) return;
      d.active = true;
    }
    if (far) d.moved = true;
    set(preview(d, e));
  };

  const onPointerUp = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    clearTimeout(d.timer);
    set(null);
    if (d.cancelled) return;
    if (d.type === 'create') {
      onCreate({ checkIn: dateAt(d.inI), checkOut: dateAt(d.outI), x: e.clientX });
      return;
    }
    if (!d.active || !d.moved) return onEdit(d.stay);
    if (d.inI !== d.in0 || d.outI !== d.out0) onUpdate({ ...d.stay, checkIn: dateAt(d.inI), checkOut: dateAt(d.outI) });
  };

  const onPointerCancel = () => {
    clearTimeout(dragRef.current?.timer);
    set(null);
  };

  // Bar geometry in % of the row, clipped to the visible days.
  const geom = (inI, outI) => {
    const l = inI; // left edge of the check-in day
    const r = outI + 1; // right edge of the check-out day
    const L = clamp(l, 0, n);
    const R = clamp(r, 0, n);
    if (R <= L) return null;
    return { left: `calc(${(L / n) * 100}% + 3px)`, width: `calc(${((R - L) / n) * 100}% - 6px)`, cutL: l < 0, cutR: r > n };
  };

  const laid = lanes(stays);
  const laneCount = Math.max(1, ...laid.map((x) => x.lane + 1)) + (drag?.type === 'create' || pending?.checkIn ? 1 : 0);
  const ghostLane = laneCount - 1;
  const ghost = drag?.active ? geom(drag.inI, drag.outI) : null;
  const pend = !drag?.active && pending?.checkIn && pending?.checkOut > pending.checkIn ? geom(idxOf(pending.checkIn), idxOf(pending.checkOut)) : null;
  const LANE = 28;

  return (
    <div
      ref={row}
      className={`stay-row${drag?.active ? ' is-dragging' : ''}`}
      style={{ height: laneCount * LANE + 8, backgroundSize: `${100 / n}% 100%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      title={stays.length ? undefined : 'Drag across the days you stay somewhere'}
    >
      {laid.map(({ s, lane }) => {
        const g = geom(idxOf(s.checkIn), idxOf(s.checkOut));
        if (!g) return null;
        const hidden = drag?.active && drag.stay?.id === s.id;
        return (
          <div
            key={s.id}
            data-stay={s.id}
            role="button"
            tabIndex={0}
            aria-label={`${s.name}, check-in ${s.checkIn}, check-out ${s.checkOut}`}
            onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onEdit(s))}
            className={`stay-bar${g.cutL ? ' cut-l' : ''}${g.cutR ? ' cut-r' : ''}${hidden ? ' is-ghosted' : ''}`}
            style={{ left: g.left, width: g.width, top: 4 + lane * LANE }}
          >
            {!g.cutL && <span className="stay-edge l" data-edge="start" aria-hidden="true" />}
            <Icon name="bed" size={13} />
            <span className="stay-name">{s.name}</span>
            {!g.cutR && <span className="stay-edge r" data-edge="end" aria-hidden="true" />}
          </div>
        );
      })}
      {ghost && (
        <div className="stay-bar is-ghost" style={{ left: ghost.left, width: ghost.width, top: 4 + (drag.type === 'create' ? ghostLane : laid.find((x) => x.s.id === drag.stay.id)?.lane || 0) * LANE }}>
          <Icon name="bed" size={13} />
          <span className="stay-name">{drag.type === 'create' ? 'New stay' : drag.stay.name}</span>
          <span className="stay-nights">{drag.outI - drag.inI} night{drag.outI - drag.inI === 1 ? '' : 's'}</span>
        </div>
      )}
      {pend && (
        <div className="stay-bar is-ghost" style={{ left: pend.left, width: pend.width, top: 4 + ghostLane * LANE }} aria-hidden="true">
          <Icon name="bed" size={13} />
          <span className="stay-name">{pending.name?.trim() || 'New stay'}</span>
        </div>
      )}
      {!stays.length && !ghost && !pend && !readOnly && <span className="stay-empty">Drag across the days you're staying somewhere</span>}
    </div>
  );
}
