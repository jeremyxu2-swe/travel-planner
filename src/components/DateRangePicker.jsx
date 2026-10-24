import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addDays, fmtDate, parseDate, todayISO, toISO } from '../lib/time.js';
import Icon from './Icon.jsx';

// First day / last day picker modelled on Google Flights' date picker.
//
// In the form it's one field:  [ 📅 Fri, Oct 9  ‹ › | Sat, Oct 24  ‹ › ]
// Clicking it opens a large calendar panel over the page (full screen on a phone):
//   Reset ............................ [ 📅 Fri, Oct 9 ‹ › | Sat, Oct 24 ‹ › ]
//   ‹      October                 November      ›
//   two months of days; the days between first and last are shaded,
//   the date you're editing is a filled circle, the other end an outline.
//                                                             [ Done ]
// Click the first day, then the last day, on the same calendar.
//
// start / end: 'YYYY-MM-DD' ('' when empty). min / max: optional limits.
export default function DateRangePicker({ start, end, onChange, min, max, labels = ['First day', 'Last day'], idPrefix = 'range' }) {
  const [open, setOpen] = useState(null); // null | 'start' | 'end'
  const fieldRef = useRef(null);
  const phone = usePhone();

  const inRange = (d) => (!min || d >= min) && (!max || d <= max);
  const set = (s, e) => onChange({ start: s, end: e });

  // ‹ › move a date by one day.
  const nudge = (which, n) => {
    if (which === 'start') {
      if (!start) return;
      const s = addDays(start, n);
      if (!inRange(s)) return;
      set(s, end && end < s ? s : end);
    } else {
      if (!end) return;
      const e = addDays(end, n);
      if (!inRange(e) || (start && e < start)) return;
      set(start, e);
    }
  };

  return (
    <div className={`dr${open ? ' is-open' : ''}`} data-start={start || ''} data-end={end || ''}>
      <Field
        ref={fieldRef}
        idPrefix={idPrefix}
        start={start}
        end={end}
        labels={labels}
        active={open}
        nudge={phone ? null : nudge}
        onOpen={(which) => setOpen(which)}
      />
      {open &&
        createPortal(
          <Panel
            anchor={fieldRef.current}
            phone={phone}
            idPrefix={idPrefix}
            start={start}
            end={end}
            labels={labels}
            active={open}
            setActive={setOpen}
            min={min}
            max={max}
            inRange={inRange}
            set={set}
            nudge={phone ? null : nudge}
            onClose={() => setOpen(null)}
          />,
          document.body
        )}
    </div>
  );
}

// The two-part date field (used in the form and again at the top of the panel).
const Field = ({ ref, idPrefix, start, end, labels, active, nudge, onOpen, inPanel }) => {
  const label = (d) => fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' });
  const half = (which, value, placeholder) => (
    <div className={`dr-half${active === which && inPanel ? ' is-active' : ''}`}>
      <button
        type="button"
        id={inPanel ? undefined : `${idPrefix}-${which}`}
        className="dr-value"
        aria-label={`${placeholder}: ${value ? label(value) : 'not set'}`}
        aria-expanded={inPanel ? undefined : active === which}
        onClick={() => onOpen(which)}
      >
        {which === 'start' && <Icon name="calendar" size={20} />}
        <span className={value ? '' : 'dr-placeholder'}>{value ? label(value) : placeholder}</span>
      </button>
      {nudge && value && (
        <span className="dr-nudge">
          <button type="button" className="icon-btn" aria-label={`${placeholder} one day earlier`} onClick={() => nudge(which, -1)}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <button type="button" className="icon-btn" aria-label={`${placeholder} one day later`} onClick={() => nudge(which, 1)}>
            <Icon name="chevronRight" size={18} />
          </button>
        </span>
      )}
    </div>
  );
  return (
    <div className="dr-field" ref={ref}>
      {half('start', start, labels[0])}
      {half('end', end, labels[1])}
    </div>
  );
};

function Panel({ anchor, phone, idPrefix, start, end, labels, active, setActive, min, max, inRange, set, nudge, onClose }) {
  const today = todayISO();
  const [hover, setHover] = useState('');
  const first = start || (min && min > today ? min : today);
  const [month, setMonth] = useState(() => monthOf(active === 'end' && end ? end : first));
  const [pos, setPos] = useState(null);
  const panelRef = useRef(null);
  const scrollRef = useRef(null);

  // Computer: float the panel over the field, the way Google's grows out of it.
  useLayoutEffect(() => {
    if (phone || !anchor) return undefined;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const w = Math.min(880, window.innerWidth - 32);
      const h = panelRef.current?.offsetHeight || 600;
      const left = Math.max(16, Math.min(r.right + 16 - w, window.innerWidth - 16 - w));
      const top = Math.max(16, Math.min(r.top - 16, window.innerHeight - 16 - h));
      setPos({ left, top, width: w });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor, phone]);

  // Phone: start the list at the chosen month.
  useEffect(() => {
    if (!phone) return;
    const el = scrollRef.current?.querySelector(`[data-month="${monthOf(active === 'end' && end ? end : first)}"]`);
    el?.scrollIntoView({ block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const pick = (d) => {
    if (!inRange(d)) return;
    if (active === 'start' || !start) {
      set(d, end && end >= d ? end : '');
      setActive('end');
    } else if (d < start) {
      set(d, end);
    } else {
      set(start, d);
    }
  };

  // While choosing the last day, hovering previews the range.
  const rangeEnd = active === 'end' && start && hover && hover >= start ? hover : end;
  const months = phone ? phoneMonths(first, min, max) : [month, shift(month, 1)];
  const days = start && end ? Math.round((parseDate(end) - parseDate(start)) / 86400000) + 1 : 0;

  const reset = (
    <button type="button" className="dr-reset" onClick={() => { set('', ''); setActive('start'); }} disabled={!start && !end}>
      Reset
    </button>
  );

  const body = (
    <>
      {phone ? (
        <>
          <div className="dr-top">
            <button type="button" className="icon-btn dr-back" aria-label="Back" onClick={onClose}>
              <Icon name="arrowLeft" size={22} />
            </button>
            <span className="grow" />
            {reset}
          </div>
          <div className="dr-top-field">
            <Field inPanel idPrefix={idPrefix} start={start} end={end} labels={labels} active={active} onOpen={setActive} />
          </div>
        </>
      ) : (
        <div className="dr-top">
          {reset}
          <span className="grow" />
          <Field inPanel idPrefix={idPrefix} start={start} end={end} labels={labels} active={active} nudge={nudge} onOpen={setActive} />
        </div>
      )}

      <div className={`dr-months${phone ? ' is-stacked' : ''}`} ref={scrollRef} onMouseLeave={() => setHover('')}>
        {!phone && (
          <button type="button" className="dr-arrow dr-prev" aria-label="Previous month" onClick={() => setMonth(shift(month, -1))}>
            <Icon name="chevronLeft" size={22} />
          </button>
        )}
        {months.map((m) => (
          <Month key={m} month={m} start={start} end={rangeEnd} active={active} today={today} inRange={inRange} onPick={pick} onHover={setHover} />
        ))}
        {!phone && (
          <button type="button" className="dr-arrow dr-next" aria-label="Next month" onClick={() => setMonth(shift(month, 1))}>
            <Icon name="chevronRight" size={22} />
          </button>
        )}
      </div>

      <div className="dr-foot">
        <span className="dr-count">{days ? `${days} day${days === 1 ? '' : 's'}` : active === 'end' && start ? `Now choose the ${labels[1].toLowerCase()}` : ''}</span>
        <button type="button" className="dr-done" onClick={onClose}>
          Done
        </button>
      </div>
    </>
  );

  return (
    <div className={`dr-layer${phone ? ' is-phone' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className="dr-panel"
        role="dialog"
        aria-label="Choose dates"
        style={phone ? undefined : pos ? { left: pos.left, top: pos.top, width: pos.width } : { visibility: 'hidden' }}
      >
        {body}
      </div>
    </div>
  );
}

function Month({ month, start, end, active, today, inRange, onPick, onHover }) {
  const firstDay = parseDate(`${month}-01`);
  const lead = firstDay.getDay(); // weeks start on Sunday, like Google
  const count = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  // "October" — the year only when it isn't this year.
  const sameYear = month.slice(0, 4) === today.slice(0, 4);
  const title = firstDay.toLocaleDateString(undefined, sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' });
  return (
    <div className="dr-month" data-month={month}>
      <div className="dr-month-title">{title}</div>
      <div className="dr-grid" role="grid" aria-label={title}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="dr-dow" aria-hidden="true">{d}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} className="dr-blank" />;
          const ok = inRange(d);
          const isStart = d === start;
          const isEnd = d === end;
          const band = start && end && start !== end && d >= start && d <= end;
          const focus = (active === 'start' && isStart) || (active === 'end' && isEnd) || (isStart && !end);
          const cls = [
            'dr-day',
            band && 'in-band',
            band && isStart && 'band-start',
            band && isEnd && 'band-end',
            (isStart || isEnd) && 'is-end',
            focus && 'is-focus',
            d < today && 'is-past',
            !ok && 'is-off',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={d}
              type="button"
              className={cls}
              disabled={!ok}
              aria-label={fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}
              aria-pressed={isStart || isEnd}
              data-date={d}
              onClick={() => onPick(d)}
              onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(d)}
            >
              <span>{Number(d.slice(8))}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- helpers
const monthOf = (iso) => iso.slice(0, 7);
function shift(month, n) {
  const d = parseDate(`${month}-01`);
  d.setMonth(d.getMonth() + n);
  return toISO(d).slice(0, 7);
}

// Phone: a scrollable run of months (through the last allowed month, or a year).
function phoneMonths(anchor, min, max) {
  const from = monthOf(min && min < anchor ? min : shift(monthOf(anchor), -1));
  const until = max ? monthOf(max) : shift(from, 12);
  const out = [];
  for (let m = from; m <= until && out.length < 14; m = shift(m, 1)) out.push(m);
  return out;
}

function usePhone() {
  const q = '(max-width: 760px)';
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}
