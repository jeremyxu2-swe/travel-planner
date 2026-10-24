import { useEffect, useState } from 'react';
import { addDays, daysBetween, fmtDate } from '../lib/time.js';
import { newId } from '../state.js';
import Icon from './Icon.jsx';
import PlaceInput from './PlaceInput.jsx';
import TimeSelect from './TimeSelect.jsx';
import Sheet from './Sheet.jsx';

export const DEFAULT_CHECK_IN = '15:00';
export const DEFAULT_CHECK_OUT = '11:00';

export default function StaySheet({ trip, initial, onSave, onDelete, onClose, onDraftChange, placement, readOnly }) {
  const isNew = !initial.id;
  const [form, setForm] = useState(() => ({
    name: '',
    location: '',
    checkInTime: DEFAULT_CHECK_IN,
    checkOutTime: DEFAULT_CHECK_OUT,
    notes: '',
    ...initial,
    checkIn: initial.checkIn || trip.start || '',
    checkOut: initial.checkOut || (initial.checkIn ? addDays(initial.checkIn, 1) : trip.start ? addDays(trip.start, 1) : ''),
  }));
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  // Show the bar on the calendar while the form is open.
  useEffect(() => {
    if (isNew) onDraftChange?.({ name: form.name, checkIn: form.checkIn, checkOut: form.checkOut });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, form.name, form.checkIn, form.checkOut]);

  const nights = form.checkIn && form.checkOut ? daysBetween(form.checkIn, form.checkOut) : 0;

  const setCheckIn = (e) => {
    const checkIn = e.target.value;
    setForm((f) => {
      // Keep the same number of nights when the check-in date moves.
      const n = f.checkIn && f.checkOut ? Math.max(1, daysBetween(f.checkIn, f.checkOut)) : 1;
      return { ...f, checkIn, checkOut: checkIn ? addDays(checkIn, n) : f.checkOut };
    });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Enter the hotel or place name.');
    if (!form.checkIn || !form.checkOut) return setError('Choose check-in and check-out dates.');
    if (form.checkOut <= form.checkIn) return setError('Check-out has to be after check-in.');
    onSave({
      ...form,
      name: form.name.trim(),
      location: form.location.trim(),
      id: form.id || newId('stay'),
      tripId: trip.id,
    });
  };

  const confirmDelete = () => {
    if (window.confirm(`Remove "${form.name}" from your stays?`)) onDelete(form.id);
  };

  return (
    <Sheet
      readOnly={readOnly}
      title={isNew ? 'New stay' : 'Stay details'}
      onClose={onClose}
      placement={placement}
      footer={
        <>
          {!isNew && (
            <button type="button" className="btn btn-danger-ghost" onClick={confirmDelete}>
              <Icon name="trash" size={16} /> Delete
            </button>
          )}
          <button type="submit" form="stay-form" className="btn btn-primary btn-grow">
            {isNew ? 'Add stay' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="stay-form" className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="stay-name">Hotel or place</label>
          <PlaceInput
            id="stay-name"
            value={form.name}
            near={trip.destination}
            invalid={!!error && !form.name.trim()}
            placeholder="e.g. Holiday Inn & Suites"
            onChange={(name) => {
              setError('');
              setForm((f) => ({ ...f, name }));
            }}
            onPick={(p) => setForm((f) => ({ ...f, name: p.name, location: p.address, lat: p.lat, lng: p.lng }))}
          />
        </div>
        <label className="field">
          <span className="field-label">Address <span className="optional">optional</span></span>
          <input type="text" value={form.location} onChange={set('location')} placeholder="Used for Google Maps links" />
        </label>

        <div className="stay-grid">
          <div className="stay-col">
            <span className="stay-col-title">Check-in</span>
            <label className="field">
              <span className="field-label sr-only">Check-in date</span>
              <input type="date" value={form.checkIn} onChange={setCheckIn} aria-label="Check-in date" />
            </label>
            <div className="field">
              <TimeSelect ariaLabel="Check-in time" value={form.checkInTime} onChange={set('checkInTime')} />
            </div>
          </div>
          <div className="stay-col">
            <span className="stay-col-title">Check-out</span>
            <label className="field">
              <span className="field-label sr-only">Check-out date</span>
              <input type="date" value={form.checkOut} min={form.checkIn ? addDays(form.checkIn, 1) : undefined} onChange={set('checkOut')} aria-label="Check-out date" />
            </label>
            <div className="field">
              <TimeSelect ariaLabel="Check-out time" value={form.checkOutTime} onChange={set('checkOutTime')} />
            </div>
          </div>
        </div>
        {nights > 0 && (
          <p className="field-help">
            {nights} night{nights === 1 ? '' : 's'} · {fmtDate(form.checkIn, { weekday: 'short', month: 'short', day: 'numeric' })} →{' '}
            {fmtDate(form.checkOut, { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        )}

        <label className="field">
          <span className="field-label">Notes <span className="optional">optional</span></span>
          <textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Confirmation number, room, parking…" />
        </label>
        {error && <p className="field-error">{error}</p>}
      </form>
    </Sheet>
  );
}
