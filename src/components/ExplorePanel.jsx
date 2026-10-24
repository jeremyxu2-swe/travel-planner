import { useEffect, useMemo, useRef, useState } from 'react';
import { newId } from '../state.js';
import { category, defaultType, knownType } from '../categories.js';
import { explore, fmtDist, interpret, presetQuery, PRESETS } from '../lib/explore.js';
import { locate } from '../lib/places.js';
import { fmtDate, fmtTime, fromMin, toMin } from '../lib/time.js';
import Icon from './Icon.jsx';

// How long a new activity takes by type, in minutes.
const LENGTH = { food: 90, coffee: 45, sight: 120 };
const DAY_START = 9 * 60;
const DAY_END = 22 * 60;

// The first free stretch of the day that fits (between 9 AM and 10 PM), on the quarter hour.
// No room: add it without a time ("Anytime").
export function nextSlot(items, cat) {
  const len = LENGTH[cat] || 60;
  const busy = items
    .filter((a) => a.start)
    .map((a) => {
      const s = toMin(a.start);
      let e = a.end ? toMin(a.end) : s + 60;
      if (e <= s) e = 24 * 60; // runs past midnight
      return [s, e];
    })
    .sort((x, y) => x[0] - y[0]);
  let t = DAY_START;
  for (const [s, e] of busy) {
    if (s - t >= len) break;
    t = Math.max(t, Math.ceil(e / 15) * 15);
  }
  if (t + len > DAY_END + 60 || t > DAY_END) return { start: '', end: '' };
  return { start: fromMin(t), end: fromMin(t + len) };
}

// Search box + quick picks for things to do near the day's city; "+" adds a result to the day.
export default function ExplorePanel({ trip, date, city, items, allItems, readOnly, onAdd, onEdit }) {
  const where = city || trip.destination || '';
  const whereShort = where.split(',')[0].trim();
  const [text, setText] = useState('');
  const [chip, setChip] = useState(null);
  const [center, setCenter] = useState(null);
  const [state, setState] = useState({ status: 'idle', results: [], error: '' });
  const [added, setAdded] = useState({}); // result id → activity id (this session)
  const ctrl = useRef(null);

  // Where to search around.
  useEffect(() => {
    setCenter(null);
    if (!where) return;
    const ac = new AbortController();
    locate(where, ac.signal).then(setCenter).catch(() => {});
    return () => ac.abort();
  }, [where]);

  const query = useMemo(() => (chip ? presetQuery(chip) : interpret(text)), [chip, text]);

  useEffect(() => {
    ctrl.current?.abort();
    if (!query || (query.name && query.name.length < 3)) return setState({ status: 'idle', results: [], error: '' });
    if (!query.name && !center) return setState({ status: where ? 'locating' : 'nowhere', results: [], error: '' });
    const ac = new AbortController();
    ctrl.current = ac;
    setState((s) => ({ ...s, status: 'loading', error: '' }));
    // Wait for typing to pause; chips search right away.
    const t = setTimeout(() => {
      explore(query, center, ac.signal)
        .then((results) => !ac.signal.aborted && setState({ status: 'done', results, error: '' }))
        .catch((e) => e.name !== 'AbortError' && setState({ status: 'error', results: [], error: e.message }));
    }, chip ? 0 : 550);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query, center, chip, where]);

  // Already in the trip? (same name, or added from here)
  const inTrip = useMemo(() => {
    const m = new Map();
    allItems.forEach((a) => m.set(a.title.trim().toLowerCase(), a));
    return m;
  }, [allItems]);

  const add = (p) => {
    const cat = knownType(p.category) || defaultType();
    const slot = date ? nextSlot(items, cat) : { start: '', end: '' };
    const activity = {
      id: newId('act'),
      tripId: trip.id,
      title: p.name,
      location: p.address,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      category: cat,
      date: date || '',
      ...slot,
      notes: '',
    };
    onAdd(activity);
    setAdded((a) => ({ ...a, [p.id]: activity.id }));
  };

  const dayLabel = date ? fmtDate(date, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Ideas';
  const pick = (id) => {
    setChip((c) => (c === id ? null : id));
    setText('');
  };

  return (
    <aside className="explore-panel" aria-label="Explore places">
      <div className="explore-head">
        <h2>Explore{whereShort ? ` ${whereShort}` : ''}</h2>
        <p>{readOnly ? 'Ideas for this trip' : `Find places and add them to ${dayLabel}`}</p>
      </div>
      <label className="explore-search">
        <Icon name="search" size={16} />
        <input
          type="search"
          value={text}
          placeholder="Search food, sights, places…"
          aria-label="Search for places"
          onChange={(e) => {
            setText(e.target.value);
            setChip(null);
          }}
        />
        {(text || chip) && (
          <button type="button" className="explore-clear" aria-label="Clear search" onClick={() => { setText(''); setChip(null); }}>
            <Icon name="close" size={14} />
          </button>
        )}
      </label>
      <div className="explore-chips" role="group" aria-label="Quick searches">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className={`explore-chip${chip === p.id ? ' is-on' : ''}`} aria-pressed={chip === p.id} onClick={() => pick(p.id)}>
            <Icon name={p.icon} size={13} /> {p.label}
          </button>
        ))}
      </div>

      {state.status === 'idle' && (
        <p className="explore-hint">
          {where ? <>Pick one above, or type what you’re in the mood for — “tacos”, “art museums”, a place’s name.</> : 'Set the trip’s destination or this day’s city to see places nearby. You can still search by name.'}
        </p>
      )}
      {state.status === 'nowhere' && <p className="explore-hint">Set the trip’s destination or this day’s city (the banner above) to search nearby.</p>}
      {(state.status === 'loading' || state.status === 'locating') && (
        <p className="explore-hint explore-loading" role="status"><span className="explore-spin" aria-hidden="true" /> Searching{whereShort ? ` near ${whereShort}` : ''}…</p>
      )}
      {state.status === 'error' && <p className="field-error" role="alert">{state.error}</p>}
      {state.status === 'done' && state.results.length === 0 && (
        <p className="explore-hint">Nothing found{whereShort ? ` near ${whereShort}` : ''}. Try another word, or a place’s name.</p>
      )}

      {state.status === 'done' && state.results.length > 0 && (
        <ul className="explore-list">
          {state.results.map((p) => {
            const cat = category(knownType(p.category) || defaultType());
            const mine = added[p.id] ? allItems.find((a) => a.id === added[p.id]) : inTrip.get(p.name.trim().toLowerCase());
            return (
              <li key={p.id}>
                <span className="cat-icon" style={{ width: 32, height: 32, background: cat.tint, color: cat.color }}>
                  <Icon name={cat.icon} size={16} />
                </span>
                <span className="explore-name">
                  <span>{p.name}</span>
                  <small>
                    {p.famous && <span className="explore-badge" title="Has a Wikipedia entry — a well-known place"><Icon name="star" size={10} /> Well-known</span>}
                    {[p.kind && p.kind[0].toUpperCase() + p.kind.slice(1), fmtDist(p.dist), p.street].filter(Boolean).join(' · ')}
                  </small>
                  {mine && (
                    <button type="button" className="explore-added" onClick={() => onEdit(mine)}>
                      <Icon name="check" size={12} /> {mine.date ? `In your plan · ${fmtDate(mine.date, { weekday: 'short', month: 'short', day: 'numeric' })}${mine.start ? ` ${fmtTime(mine.start)}` : ''}` : 'In your Ideas'}
                    </button>
                  )}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    className={`explore-add${mine ? ' is-added' : ''}`}
                    aria-label={`Add ${p.name} to ${dayLabel}`}
                    title={mine ? 'Add it again' : `Add to ${dayLabel}`}
                    onClick={() => add(p)}
                  >
                    <Icon name="plus" size={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {(state.status === 'done' || state.status === 'error') && (
        <p className="explore-credit">
          Place data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors. “Well-known” places are listed first.
        </p>
      )}
    </aside>
  );
}
