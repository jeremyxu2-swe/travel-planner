import { useEffect, useId, useRef, useState } from 'react';
import { fmtTime, fromMin, toMin } from '../lib/time.js';

// Google-Calendar-style time picker: a text box with a list of times in
// 15-minute steps. Give it `startFrom` (for an end time) and each option also
// shows the length, e.g. "4:00 PM (1 hr)". You can also type a time ("3:20pm", "15:20", "3p").

const STEP = 15;
const LAST = 24 * 60 - STEP; // 11:45 PM

export function fmtLength(min) {
  if (min < 60) return `${min} mins`;
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(2).replace(/0$/, '')} ${h === 1 ? 'hr' : 'hrs'}`;
}

export function parseTime(text) {
  const m = String(text).trim().toLowerCase().match(/^(\d{1,2})(?::?(\d{2}))?\s*(a|p)?\.?\s*m?\.?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (min > 59) return null;
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (m[3] === 'p' ? 12 : 0);
  } else if (h > 23) return null;
  return fromMin(h * 60 + min);
}

export default function TimeSelect({ id, value, onChange, startFrom, disabled, ariaLabel, placeholder = '--:--' }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(null); // what's being typed (null = show the value)
  const [active, setActive] = useState(-1);
  const [up, setUp] = useState(false); // open above the box when there's no room below
  const listId = useId();
  const box = useRef(null);
  const list = useRef(null);

  const from = startFrom ? toMin(startFrom) : 0;
  const options = [];
  for (let m = startFrom ? from : 0; m <= LAST; m += STEP) {
    options.push({ value: fromMin(m), label: startFrom ? `${fmtTime(fromMin(m))} (${fmtLength(m - from)})` : fmtTime(fromMin(m)) });
  }

  // Open with the current time (or the next one after it) in view, like Google.
  useEffect(() => {
    if (!open) return;
    // Room inside the form (or window) below vs above the box.
    const r = box.current.getBoundingClientRect();
    const scroller = box.current.closest('.sheet-body');
    const limit = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const below = limit.bottom - r.bottom;
    setUp(below < 220 && r.top - limit.top > below);
    const cur = value ? toMin(value) : 9 * 60;
    let i = options.findIndex((o) => toMin(o.value) >= cur);
    if (i === -1) i = options.length - 1;
    setActive(i);
    requestAnimationFrame(() => {
      const el = list.current?.children[i];
      if (el && list.current) list.current.scrollTop = el.offsetTop - list.current.clientHeight / 2 + el.offsetHeight / 2;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || active < 0) return;
    list.current?.children[active]?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !box.current?.contains(e.target) && commit();
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  });

  const choose = (v) => {
    setText(null);
    setOpen(false);
    if (v !== value) onChange(v);
  };

  // Apply what was typed (if anything) and close.
  const commit = () => {
    if (text != null) {
      const t = parseTime(text);
      setText(null);
      if (t && t !== value) onChange(t);
    }
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      setText(null);
      setActive((i) => Math.max(0, Math.min(options.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (text != null) commit();
      else if (open && active >= 0) choose(options[active].value);
      else setOpen(true);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation(); // close the list, not the whole form
      setText(null);
      setOpen(false);
    } else if (e.key === 'Tab') {
      commit();
    }
  };

  return (
    <div className="tsel" ref={box}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        inputMode="text"
        disabled={disabled}
        data-value={value || ''}
        placeholder={placeholder}
        value={text ?? (value ? fmtTime(value) : '')}
        onFocus={(e) => {
          e.target.select();
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onBlur={(e) => {
          if (!box.current?.contains(e.relatedTarget)) commit();
        }}
        onKeyDown={onKeyDown}
      />
      {open && !disabled && (
        <ul className={`tsel-list${up ? ' is-up' : ''}`} id={listId} role="listbox" ref={list} aria-label={`${ariaLabel || 'Time'} options`}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={`${i === active ? 'is-active' : ''}${o.value === value ? ' is-current' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o.value)}
              onMouseEnter={() => setActive(i)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
