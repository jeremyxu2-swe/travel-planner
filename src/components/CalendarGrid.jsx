import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { category } from '../categories.js';
import { analyzeDay } from '../lib/schedule.js';
import { dayNum, dow, fmtRange, fromMin, toMin, todayISO } from '../lib/time.js';
import Icon from './Icon.jsx';
import StayRow, { staysOn } from './StayRow.jsx';
import { countrySpans } from '../lib/dayplaces.js';

// Google-Calendar-style time grid.
//   Click an empty slot  → new activity, 1 hour long
//   Drag on empty space  → new activity spanning the dragged range
//   Drag an activity     → move it (to another time, or another day in week view)
//   Drag its bottom edge → change how long it is
// On touch screens: tap to add or open; press and hold, then drag, to do the rest
// (so normal swiping still scrolls the calendar).

const SNAP = 15; // minutes
const DAY = 1440;
const DEFAULT_LEN = 60;
const LONG_PRESS_MS = 350;
const MOVE_SLOP = 6; // px before a press counts as a drag

const snapDown = (m) => Math.floor(m / SNAP) * SNAP;
const snapNear = (m) => Math.round(m / SNAP) * SNAP;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// "24:00" can't be stored, so the very end of the day is saved as 23:59.
const toTime = (m) => (m >= DAY ? '23:59' : fromMin(m));

function span(a) {
  const s = toMin(a.start);
  let e = a.end ? toMin(a.end) : s + DEFAULT_LEN;
  if (a.end === '23:59') e = DAY;
  if (e <= s) e = DAY; // runs past midnight: show to the end of the day
  return [s, Math.min(e, DAY)];
}

// Side-by-side columns for overlapping activities, like Google Calendar.
function layout(timed) {
  const out = [];
  let cluster = [];
  let clusterEnd = -1;
  let colEnds = [];
  const flush = () => {
    const n = colEnds.length;
    cluster.forEach((x) => (x.cols = n));
    out.push(...cluster);
    cluster = [];
    colEnds = [];
  };
  timed
    .map((a) => ({ a, s: span(a)[0], e: span(a)[1] }))
    .sort((x, y) => x.s - y.s || y.e - x.e)
    .forEach((x) => {
      if (cluster.length && x.s >= clusterEnd) flush();
      let col = colEnds.findIndex((end) => end <= x.s);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(x.e);
      } else colEnds[col] = x.e;
      x.col = col;
      cluster.push(x);
      clusterEnd = Math.max(clusterEnd, x.e);
    });
  if (cluster.length) flush();
  return out;
}

function hourLabel(h) {
  if (h === 0) return '';
  const ap = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12} ${ap}`;
}

export default function CalendarGrid({
  dates, byDate, onCreate, onEdit, onUpdate, onOpenDay, pending,
  stays = [], pendingStay, onCreateStay, onEditStay, onUpdateStay,
  dayInfo, onEditPlace,
  hourHeight = 48, colMin = 140,
  // 'gcal' = phone day view styled like Google Calendar: full screen, the date in the corner,
  // the day's city/hotel/anytime items as full-width bars, solid activity blocks.
  variant, where, onPickDate, pickRange,
  readOnly, // view only: tap an activity to see it; nothing is created or moved
}) {
  const PX = hourHeight / 60;
  const scrollRef = useRef(null);
  const colsRef = useRef(null);
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null); // what's being drawn while dragging
  const [now, setNow] = useState(() => new Date());
  const today = todayISO();

  // ---- where is the pointer? (day column + minutes since midnight)
  const locate = (e) => {
    const r = colsRef.current.getBoundingClientRect();
    const idx = clamp(Math.floor(((e.clientX - r.left) / r.width) * dates.length), 0, dates.length - 1);
    const min = clamp((e.clientY - r.top) / PX, 0, DAY - 1);
    return { idx, min };
  };

  // Scroll to the morning (or the first activity) when the days change.
  const firstStart = Math.min(
    ...dates.flatMap((d) => (byDate[d] || []).filter((a) => a.start).map((a) => toMin(a.start))),
    8 * 60
  );
  const dateKey = dates.join(',');
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, (firstStart - 45) * PX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, PX]);

  // Keep the block being created in view (e.g. when its time or day is changed in the form).
  const pendingKey = pending && pending.start ? `${pending.date}|${pending.start}` : '';
  useEffect(() => {
    const el = scrollRef.current;
    if (!pendingKey || !el || !dates.includes(pending.date)) return;
    const top = toMin(pending.start) * PX;
    const head = el.querySelector('.cal-head')?.offsetHeight || 0;
    const visibleTop = el.scrollTop;
    const visibleBottom = el.scrollTop + el.clientHeight - head;
    // On phones the form covers the lower part of the screen, so bring the block up near the top.
    const phone = window.innerWidth <= 760;
    if (phone || top < visibleTop || top + 40 > visibleBottom) el.scrollTo({ top: Math.max(0, top - (phone ? 6 : 16)), behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  // Red "now" line.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // While dragging with a finger, stop the page from scrolling.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const stop = (e) => {
      if (dragRef.current?.active) e.preventDefault();
    };
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, []);

  // ---- pointer handling
  const update = (d) => {
    dragRef.current = d;
    setDrag(d ? { ...d } : null);
  };

  const preview = (d, e) => {
    const { idx, min } = locate(e);
    if (d.type === 'create') {
      const cur = snapNear(min);
      const start = Math.min(d.anchor, cur);
      const end = Math.max(d.anchor + SNAP, cur);
      return { ...d, idx: d.idx, start, end: Math.min(end, DAY) };
    }
    if (d.type === 'move') {
      const len = d.end0 - d.start0;
      const start = clamp(snapNear(min - d.grab), 0, DAY - len);
      return { ...d, idx: dates.length > 1 ? idx : d.idx0, start, end: start + len };
    }
    // resize
    const end = clamp(snapNear(min), d.start0 + SNAP, DAY);
    return { ...d, start: d.start0, end };
  };

  const activate = (d) => update({ ...d, active: true });

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('[data-marker]')) return; // check-in/out labels are plain buttons
    const block = e.target.closest('[data-act]');
    if (readOnly && !block) return;
    const { idx, min } = locate(e);
    const base = { pointerId: e.pointerId, touch: e.pointerType === 'touch', x0: e.clientX, y0: e.clientY, active: false, moved: false };
    let d;
    if (block) {
      const act = byDate[dates[Number(block.dataset.idx)]].find((a) => a.id === block.dataset.act);
      const [s, en] = span(act);
      const resize = !!e.target.closest('[data-resize]');
      d = { ...base, type: resize ? 'resize' : 'move', act, idx0: Number(block.dataset.idx), idx: Number(block.dataset.idx), start0: s, end0: en, start: s, end: en, grab: min - s };
    } else {
      const anchor = snapDown(min);
      d = { ...base, type: 'create', idx, anchor, start: anchor, end: anchor + DEFAULT_LEN };
    }
    if (readOnly) d.view = true;
    dragRef.current = d;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (d.view) return;
    if (d.touch) {
      // Hold to start dragging; a quick tap is handled on pointer up.
      d.timer = setTimeout(() => {
        if (dragRef.current === d && !d.cancelled) {
          navigator.vibrate?.(10);
          activate(d);
        }
      }, LONG_PRESS_MS);
    } else if (d.type === 'create') {
      // Mouse: show the new-activity outline right away, like Google Calendar.
      // (Moving/resizing waits until the mouse actually moves, so a click still opens the activity.)
      activate({ ...d, end: d.anchor + SNAP });
    }
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const far = Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > MOVE_SLOP;
    if (d.view) {
      if (far) {
        d.cancelled = true;
        dragRef.current = null;
      }
      return;
    }
    if (d.touch && !d.active) {
      // Finger moved before the hold finished: it's a scroll, not a drag.
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
    update(preview(d, e));
  };

  const finish = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    clearTimeout(d.timer);
    dragRef.current = null;
    setDrag(null);
    if (d.cancelled) return;
    const date = dates[d.idx];

    if (d.type === 'create') {
      // x tells the app which side of the screen to open the form on, so it doesn't cover the new block.
      if (d.active && d.moved) onCreate({ date, start: toTime(d.start), end: toTime(d.end), x: e.clientX });
      else onCreate({ date, start: toTime(d.anchor), end: toTime(Math.min(d.anchor + DEFAULT_LEN, DAY)), x: e.clientX });
      return;
    }
    if (!d.active || !d.moved) return onEdit(d.act); // a plain click/tap opens it
    const changed = date !== d.act.date || d.start !== d.start0 || d.end !== d.end0;
    if (changed) onUpdate({ ...d.act, date, start: toTime(d.start), end: toTime(d.end) });
  };

  const onPointerCancel = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    clearTimeout(d.timer);
    dragRef.current = null;
    setDrag(null);
  };

  // Google-style phone view: fill the screen down to the bottom nav.
  const gcal = variant === 'gcal';
  useLayoutEffect(() => {
    if (!gcal) return undefined;
    const fit = () => {
      const el = scrollRef.current;
      if (!el) return;
      const nav = document.querySelector('.bottom-nav');
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.height = `${Math.max(320, window.innerHeight - top - (nav?.offsetHeight || 0))}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  });

  // ---- render
  const cols = `56px repeat(${dates.length}, minmax(${colMin}px, 1fr))`;
  const minWidth = 56 + dates.length * colMin;
  const days = dates.map((d) => {
    const { timed, untimed, conflicts } = analyzeDay(byDate[d] || []);
    return { date: d, blocks: layout(timed), untimed, conflicts };
  });
  const anyUntimed = days.some((x) => x.untimed.length);
  const showDays = dates.length > 1; // a single day already has its date above the grid
  const spans = dayInfo && Object.values(dayInfo).some((x) => x && !x.implied) ? countrySpans(dates, dayInfo) : null;
  const off = -now.getTimezoneOffset() / 60;
  const tz = `GMT${off >= 0 ? '+' : '-'}${String(Math.abs(Math.trunc(off))).padStart(2, '0')}${off % 1 ? ':30' : ''}`;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return (
    <div className={`cal${pending?.start ? ' has-pending' : ''}${gcal ? ' is-gcal' : ''}`} ref={scrollRef}>
      <div className="cal-inner" style={{ minWidth }}>
        {gcal && <GcalHead readOnly={readOnly} onPickDate={onPickDate} pickRange={pickRange} date={dates[0]} today={today} where={where} untimed={days[0].untimed} stays={stays} pendingStay={pendingStay} onEdit={onEdit} onEditStay={onEditStay} onCreateStay={onCreateStay} onEditPlace={onEditPlace} />}
        {!gcal && (showDays || anyUntimed || onCreateStay) && (
        <div className="cal-head" style={{ gridTemplateColumns: cols }}>
          {showDays && spans && (
            <>
              <div className="cal-band-gutter" />
              {spans.map((s) => (
                <div key={s.start} className="cal-band-cell" style={{ gridColumn: `span ${s.span}` }}>
                  {s.label && (
                    <button type="button" className="cal-band" style={{ background: s.colors.tint, color: s.colors.color }} onClick={() => onEditPlace?.(dates[s.start])}>
                      <span className="cal-band-name">{s.label}</span>
                      <span className="cal-band-days">{s.span} day{s.span === 1 ? '' : 's'}</span>
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
          {showDays && <div className="cal-tz">{tz}</div>}
          {showDays && dates.map((d) => {
            const info = dayInfo?.[d];
            const line = info && !info.implied ? info.to.color : 'transparent';
            // The band already names the city, so under the date we only show travel days and gaps.
            const showCity = !info || info.implied || info.travel;
            return (
              <div key={d} className={`cal-day${d === today ? ' is-today' : ''}`} style={{ borderTopColor: line }}>
                <button type="button" className="cal-day-date" onClick={() => onOpenDay?.(d)} disabled={!onOpenDay} aria-label={`Open ${d}`}>
                  <span className="cal-dow">{dow(d).toUpperCase()}</span>
                  <span className="cal-num">{dayNum(d)}</span>
                </button>
                {onEditPlace && showCity && !(readOnly && (!info || info.implied)) && (
                  <button type="button" className={`cal-city${!info || info.implied ? ' is-empty' : ''}`} onClick={() => onEditPlace(d)} title="Set the city for this day">
                    {!info ? '+ City' : info.travel ? `${info.from.city} → ${info.to.city}` : info.to.city}
                  </button>
                )}
              </div>
            );
          })}
          {anyUntimed && (
            <>
              <div className="cal-allday-label">Anytime</div>
              {days.map((x) => (
                <div key={x.date} className="cal-allday">
                  {x.untimed.map((a) => {
                    const c = category(a.category);
                    return (
                      <button key={a.id} type="button" className="cal-chip" style={{ background: c.tint, color: c.color }} onClick={() => onEdit(a)}>
                        {a.title}
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}
          {onCreateStay && (
            <>
              <div className="cal-allday-label">Stay</div>
              {showDays ? (
                <div className="cal-stays">
                  <StayRow dates={dates} stays={stays} pending={pendingStay} onCreate={onCreateStay} onEdit={onEditStay} onUpdate={onUpdateStay} readOnly={readOnly} />
                </div>
              ) : (
                <div className="cal-stay-day">
                  {staysOn(stays, dates[0]).map(({ s, note, out }) => (
                    <button key={s.id} type="button" className={`stay-chip${out ? ' is-out' : ''}`} onClick={() => onEditStay(s)}>
                      <Icon name="bed" size={13} />
                      <span className="stay-name">{s.name}</span>
                      <span className="stay-note">{note}</span>
                    </button>
                  ))}
                  {pendingStay?.checkIn && pendingStay.checkIn <= dates[0] && dates[0] <= pendingStay.checkOut && (
                    <span className="stay-chip is-ghost"><Icon name="bed" size={13} /><span className="stay-name">{pendingStay.name?.trim() || 'New stay'}</span></span>
                  )}
                  <button type="button" className="link-btn stay-add" onClick={(e) => onCreateStay({ checkIn: dates[0], checkOut: null, x: e.clientX })}>
                    + Add stay
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        )}

        <div className="cal-body" style={{ gridTemplateColumns: `56px 1fr`, height: 24 * hourHeight }}>
          <div className="cal-gutter" aria-hidden="true" style={gcal ? { backgroundSize: `8px ${hourHeight}px` } : undefined}>
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} style={{ top: h * hourHeight }}>{hourLabel(h)}</span>
            ))}
          </div>
          <div
            ref={colsRef}
            className={`cal-cols${drag?.active ? ' is-dragging' : ''}`}
            style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))`, backgroundSize: `100% ${hourHeight}px` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finish}
            onPointerCancel={onPointerCancel}
            onContextMenu={(e) => e.preventDefault()}
          >
            {days.map((x, i) => (
              <div key={x.date} className="cal-col">
                {x.blocks.map(({ a, s, e, col, cols: n }) => {
                  const c = category(a.category);
                  const hidden = drag?.active && drag.type !== 'create' && drag.act.id === a.id;
                  const h = Math.max((e - s) * PX, 14);
                  const conflict = x.conflicts.get(a.id);
                  return (
                    <div
                      key={a.id}
                      data-act={a.id}
                      data-idx={i}
                      role="button"
                      tabIndex={0}
                      aria-label={`${a.title}, ${fmtRange(a.start, a.end)}`}
                      onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onEdit(a))}
                      className={`cal-event${conflict ? ' is-conflict' : ''}${h < 34 ? ' is-short' : ''}${hidden ? ' is-ghosted' : ''}`}
                      style={{
                        top: s * PX,
                        height: h,
                        left: `calc(${(col / n) * 100}% + 1px)`,
                        width: `calc(${100 / n}% - 3px)`,
                        background: c.tint,
                        color: c.color,
                      }}
                      title={conflict ? `Overlaps ${conflict.join(', ')}` : undefined}
                    >
                      <span className="cal-event-title">
                        {conflict && <Icon name="alert" size={12} stroke={2.4} />} {a.title}
                      </span>
                      <span className="cal-event-time">{fmtRange(a.start, a.end)}</span>
                      <span className="cal-resize" data-resize aria-hidden="true" />
                    </div>
                  );
                })}

                {drag?.active && drag.idx === i && (
                  <div className={`cal-ghost${drag.type === 'create' ? ' is-new' : ''}`} style={{ top: drag.start * PX, height: Math.max((drag.end - drag.start) * PX, 12) }}>
                    <span className="cal-event-title">{drag.type === 'create' ? '(New activity)' : drag.act.title}</span>
                    <span className="cal-event-time">{fmtRange(toTime(drag.start), toTime(drag.end))}</span>
                  </div>
                )}

                {!drag?.active && pending?.start && pending.date === x.date && (() => {
                  const [ps, pe] = span(pending);
                  return (
                    <div className="cal-ghost is-new is-pending" style={{ top: ps * PX, height: Math.max((pe - ps) * PX, 14) }} aria-hidden="true">
                      <span className="cal-event-title">{pending.title?.trim() || '(New activity)'}</span>
                      <span className="cal-event-time">{fmtRange(pending.start, pending.end)}</span>
                    </div>
                  );
                })()}

                {stays.flatMap((s) => [
                  s.checkIn === x.date && s.checkInTime ? { s, t: s.checkInTime, label: 'Check-in' } : null,
                  s.checkOut === x.date && s.checkOutTime ? { s, t: s.checkOutTime, label: 'Check-out' } : null,
                ]).filter(Boolean).map(({ s, t, label }) => (
                  <div key={s.id + label} className="cal-marker" style={{ top: toMin(t) * PX }}>
                    <button type="button" data-marker className="cal-marker-pill" onClick={() => onEditStay?.(s)} title={`${label} ${fmtRange(t)} · ${s.name}`}>
                      <Icon name="bed" size={11} /> {label} · {s.name}
                    </button>
                  </div>
                ))}

                {x.date === today && (
                  <div className="cal-now" style={{ top: nowMin * PX }} aria-hidden="true">
                    <span />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Phone day header, Google Calendar style: "THU 15" in the corner and the day's
// all-day items as full-width bars (city, hotel, anytime activities).
function GcalHead({ readOnly, onPickDate, pickRange = [], date, today, where, untimed, stays, pendingStay, onEdit, onEditStay, onCreateStay, onEditPlace }) {
  const place = where?.info && !where.info.implied ? where.info : null;
  const ghostStay = pendingStay?.checkIn && pendingStay.checkIn <= date && date <= pendingStay.checkOut;
  const dayStays = staysOn(stays, date);
  return (
    <div className="cal-head gc-head">
      {/* Tap the date to jump to any day of the trip (opens the phone's date picker). */}
      <label className={`gc-date${date === today ? ' is-today' : ''}${onPickDate ? ' is-pickable' : ''}`} title="Go to a day">
        <span className="gc-dow">{dow(date).toUpperCase()}</span>
        <span className="gc-num">{dayNum(date)}</span>
        {onPickDate && (
          <input
            type="date"
            className="gc-pick"
            aria-label="Go to a day"
            value={date}
            min={pickRange[0]}
            max={pickRange[pickRange.length - 1]}
            onChange={(e) => {
              const v = e.target.value;
              e.target.blur(); // a focused input inside the calendar would interrupt its scrolling
              if (pickRange.includes(v)) onPickDate(v);
            }}
            onClick={(e) => e.currentTarget.showPicker?.()}
          />
        )}
      </label>
      <div className="gc-lane">
        {place ? (
          <button type="button" className="gc-bar gc-city" style={{ background: place.to.tint, color: place.to.color }} onClick={() => onEditPlace?.(date)} title="Change city">
            <Icon name="pin" size={13} />
            <span className="gc-bar-name">{place.travel ? `${place.from.city} → ${place.to.city}` : [place.to.city, place.to.country].filter(Boolean).join(', ')}</span>
            <span className="gc-bar-note">{place.travel ? 'Travel day' : (where.sub.match(/Day \d+ of \d+/) || [''])[0].replace(' of ', '/')}</span>
          </button>
        ) : null}
        {dayStays.map(({ s, note, out }) => (
          <button key={s.id} type="button" className={`gc-bar gc-stay${out ? ' is-out' : ''}`} onClick={() => onEditStay(s)}>
            <Icon name="bed" size={13} />
            <span className="gc-bar-name">{s.name}</span>
            <span className="gc-bar-note">{note}</span>
          </button>
        ))}
        {ghostStay && (
          <span className="gc-bar gc-stay is-ghost"><Icon name="bed" size={13} /><span className="gc-bar-name">{pendingStay.name?.trim() || 'New stay'}</span></span>
        )}
        {untimed.map((a) => {
          const c = category(a.category);
          return (
            <button key={a.id} type="button" className="gc-bar" style={{ background: c.tint, color: c.color }} onClick={() => onEdit(a)}>
              <Icon name={c.icon} size={13} />
              <span className="gc-bar-name">{a.title}</span>
              <span className="gc-bar-note">Anytime</span>
            </button>
          );
        })}
        {!readOnly && <div className="gc-adds">
          {!place && onEditPlace && (
            <button type="button" className="gc-add" onClick={() => onEditPlace(date)}>+ City</button>
          )}
          {onCreateStay && (
            <button type="button" className="gc-add" onClick={(e) => onCreateStay({ checkIn: date, checkOut: null, x: e.clientX })}>+ Stay</button>
          )}
        </div>}
      </div>
    </div>
  );
}
