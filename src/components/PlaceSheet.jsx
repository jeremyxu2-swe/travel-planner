import { useState } from 'react';
import { cityCode, resolveOverlaps } from '../lib/dayplaces.js';
import { daysBetween, monthDay } from '../lib/time.js';
import { newId } from '../state.js';
import Icon from './Icon.jsx';
import PlaceInput from './PlaceInput.jsx';
import Sheet from './Sheet.jsx';
import DateRangePicker from './DateRangePicker.jsx';

// "Where are you on these days?" — a city + country for a date range.
// The last day of one city and the first day of the next can be the same (a travel day).
export default function PlaceSheet({ trip, initial, others = [], onSave, onDelete, onClose, readOnly }) {
  const isNew = !initial.id;
  const [form, setForm] = useState({ city: '', country: '', countryCode: '', code: '', ...initial, start: initial.start || trip.start || '', end: initial.end || initial.start || trip.end || '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const days = form.start && form.end && form.end >= form.start ? daysBetween(form.start, form.end) + 1 : 0;
  // Which other cities this range would take days from.
  const clash = days ? resolveOverlaps({ ...form, id: form.id || '__new', tripId: trip.id }, others) : { removed: [], changed: [] };
  const clashText = [
    ...clash.removed.map((o) => `replaces ${o.city} (${monthDay(o.start)} – ${monthDay(o.end)})`),
    ...clash.changed.map((o) => `shortens ${o.city}`),
  ].join(', ');

  const submit = (e) => {
    e.preventDefault();
    if (!form.city.trim()) return setError('Enter a city.');
    if (!form.start || !form.end) return setError('Choose the first and last day.');
    if (form.end < form.start) return setError('The last day has to be on or after the first day.');
    onSave({
      ...form,
      city: form.city.trim(),
      country: form.country.trim(),
      countryCode: form.countryCode.trim().toUpperCase().slice(0, 3),
      code: form.code.trim().toUpperCase().slice(0, 4),
      id: form.id || newId('place'),
      tripId: trip.id,
    });
  };

  return (
    <Sheet
      readOnly={readOnly}
      title={isNew ? 'Add a city' : 'City details'}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button type="button" className="btn btn-danger-ghost" onClick={() => window.confirm(`Remove ${form.city} from these days?`) && onDelete(form.id)}>
              <Icon name="trash" size={16} /> Remove
            </button>
          )}
          <button type="submit" form="place-form" className="btn btn-primary btn-grow">
            {isNew ? 'Add city' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="place-form" className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="place-city">City</label>
          <PlaceInput
            id="place-city"
            cities
            value={form.city}
            placeholder="e.g. Kyoto"
            invalid={!!error && !form.city.trim()}
            onChange={(city) => {
              setError('');
              setForm((f) => ({ ...f, city }));
            }}
            onPick={(c) => setForm((f) => ({ ...f, city: c.city, country: c.country, countryCode: c.countryCode }))}
          />
        </div>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Country</span>
            <input type="text" value={form.country} onChange={set('country')} placeholder="e.g. Japan" />
          </label>
          <label className="field">
            <span className="field-label">Short label <span className="optional">optional</span></span>
            <input type="text" value={form.code} onChange={set('code')} placeholder={form.city ? cityCode({ city: form.city }) : 'e.g. TYO'} maxLength={4} />
          </label>
        </div>
        <div className="field">
          <span className="field-label">Days in this city</span>
          <DateRangePicker
            idPrefix="place"
            start={form.start}
            end={form.end}
            min={trip.start || undefined}
            max={trip.end || undefined}
            onChange={({ start, end }) => {
              setError('');
              setForm((f) => ({ ...f, start, end }));
            }}
          />
        </div>
        <p className="field-help">
          {days > 0 && `${days} day${days === 1 ? '' : 's'}. `}
          On a travel day, end one city and start the next on the same date — it shows as “Tokyo → Kyoto”.
        </p>
        {clashText && (
          <p className="place-clash" role="status">
            <Icon name="alert" size={15} /> These dates overlap another city — saving {clashText}.
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
      </form>
    </Sheet>
  );
}
