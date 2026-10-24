import { useEffect, useState } from 'react';
import { defaultType, getCategories, knownType } from '../categories.js';
import { dow, dayNum, fromMin, toMin } from '../lib/time.js';
import { newId } from '../state.js';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';
import PlaceInput from './PlaceInput.jsx';
import TimeSelect from './TimeSelect.jsx';
import { inferCategory } from '../lib/infer.js';
import { category as categoryOf } from '../categories.js';

export default function ActivitySheet({ trip, dates, initial, onSave, onDelete, onClose, onDraftChange, placement, readOnly }) {
  const isNew = !initial.id;
  const [form, setForm] = useState(() => ({
    title: '',
    location: '',
    category: defaultType(),
    date: '',
    start: '',
    end: '',
    notes: '',
    ...initial,
  }));
  const [error, setError] = useState('');
  // Type guessing: on for new activities until you pick a type yourself.
  const [manualType, setManualType] = useState(!isNew);
  const [initialType] = useState(initial.category || defaultType());
  const [guess, setGuess] = useState(null); // { source: 'name' | 'map', kind? }
  // Lets the calendar show where a new activity will go while the form is open.
  useEffect(() => {
    if (isNew) onDraftChange?.({ date: form.date, start: form.start, end: form.end, title: form.title });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, form.date, form.start, form.end, form.title]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const anytime = !form.start;

  const setStart = (e) => {
    const start = e.target.value;
    setForm((f) => {
      // Keep the same length when the start time moves; default to 1 hour.
      let end = f.end;
      if (start && f.start && f.end) end = fromMin(toMin(start) + (toMin(f.end) - toMin(f.start)));
      else if (start && !f.end) end = fromMin(toMin(start) + 60);
      return { ...f, start, end };
    });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Give it a name.');
      return;
    }
    onSave({
      ...form,
      title: form.title.trim(),
      location: form.location.trim(),
      end: form.start ? form.end : '',
      id: form.id || newId('act'),
      tripId: trip.id,
    });
  };

  const dayLabel = form.date ? `${dow(form.date)} ${dayNum(form.date)}` : 'ideas';

  return (
    <Sheet
      readOnly={readOnly}
      title={isNew ? 'New activity' : 'Edit activity'}
      onClose={onClose}
      placement={placement}
      footer={
        <>
          {!isNew && (
            <button type="button" className="btn btn-danger-ghost" onClick={() => onDelete(form.id)}>
              <Icon name="trash" size={16} /> Delete
            </button>
          )}
          <button type="submit" form="activity-form" className="btn btn-primary btn-grow">
            {isNew ? `Add to ${dayLabel}` : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="activity-form" className="form" onSubmit={submit}>
        <div className="field">
          <label className="field-label" htmlFor="activity-name">Name</label>
          <PlaceInput
            id="activity-name"
            value={form.title}
            near={trip.destination}
            invalid={!!error}
            placeholder="Type a place or anything, e.g. Louvre"
            onChange={(title) => {
              setError('');
              const g = manualType ? null : knownType(inferCategory(title)); // only guess types you still have
              // No match: fall back to the type the form started with.
              setForm((f) => ({ ...f, title, ...(manualType ? {} : { category: g || initialType }) }));
              if (!manualType) setGuess(g ? { source: 'name' } : null);
            }}
            onPick={(p) => {
              setError('');
              const pType = knownType(p.category);
              const useType = !manualType && pType;
              setForm((f) => ({ ...f, title: p.name, location: p.address, lat: p.lat, lng: p.lng, ...(useType ? { category: pType } : {}) }));
              if (!manualType) setGuess(pType ? { source: 'map', kind: p.kind } : null);
            }}
          />
          {error && <span className="field-error">{error}</span>}
        </div>

        <label className="field">
          <span className="field-label">Address or place <span className="optional">optional</span></span>
          <input type="text" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value, lat: null, lng: null }))} placeholder="Used for Google Maps links" />
        </label>

        <fieldset className="field">
          <legend className="field-label">Type</legend>
          <div className="cat-grid">
            {getCategories().map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={form.category === c.id}
                className={`cat-opt${form.category === c.id ? ' is-on' : ''}`}
                onClick={() => {
                  set('category')(c.id);
                  setManualType(true);
                  setGuess(null);
                }}
              >
                <span className="cat-icon" style={{ background: c.tint, color: c.color, width: 28, height: 28 }}>
                  <Icon name={c.icon} size={15} />
                </span>
                {c.label}
              </button>
            ))}
          </div>
          {guess && !manualType && (
            <p className="type-hint">
              <Icon name="sparkle" size={14} />
              {guess.source === 'map'
                ? `Set to ${categoryOf(form.category).label} — OpenStreetMap lists this as ${/^[aeiou]/i.test(guess.kind || '') ? 'an' : 'a'} ${guess.kind || 'place'}.`
                : `Set to ${categoryOf(form.category).label} from the name.`}{' '}
              Tap another type to change it.
            </p>
          )}
        </fieldset>

        <fieldset className="field">
          <legend className="field-label">Day</legend>
          <div className="day-pick">
            {dates.map((d) => (
              <button key={d} type="button" aria-pressed={form.date === d} className={`day-opt${form.date === d ? ' is-on' : ''}`} onClick={() => set('date')(d)}>
                <span>{dow(d)}</span>
                <strong>{dayNum(d)}</strong>
              </button>
            ))}
            <button type="button" aria-pressed={!form.date} className={`day-opt day-opt-wide${!form.date ? ' is-on' : ''}`} onClick={() => set('date')('')}>
              <span>No day yet</span>
              <strong>Idea</strong>
            </button>
          </div>
        </fieldset>

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="activity-start">Start</label>
            <TimeSelect id="activity-start" ariaLabel="Start time" value={form.start} onChange={(v) => setStart({ target: { value: v } })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="activity-end">End</label>
            <TimeSelect id="activity-end" ariaLabel="End time" value={form.end} startFrom={form.start} onChange={set('end')} disabled={anytime} />
          </div>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={anytime}
            onChange={(e) => setForm((f) => (e.target.checked ? { ...f, start: '', end: '' } : { ...f, start: '12:00', end: '13:00' }))}
          />
          No set time (shows under "Anytime")
        </label>

        <label className="field">
          <span className="field-label">Notes <span className="optional">optional</span></span>
          <textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Tickets, confirmation numbers, what to order…" />
        </label>
      </form>
    </Sheet>
  );
}
