import { useState } from 'react';
import { newId } from '../state.js';
import { category } from '../categories.js';
import { changedPlans, spanText } from '../lib/tripdates.js';
import { fmtDate, fmtTime, monthDay } from '../lib/time.js';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';
import DateRangePicker from './DateRangePicker.jsx';
import { isShared, ownerLabel } from '../lib/owner.js';

// plans: the app state (activities, stays, places), used to warn before new dates
// leave planned days out of the trip.
// sharing: { count, onOpen } when sync is on (owner or not), shown as a "Sharing" row.
export default function TripSheet({ initial, activityCount, plans, onSave, onDelete, onClose, readOnly, sharing }) {
  const isNew = !initial?.id;
  const shared = !isNew && isShared(initial.id); // someone else's trip
  const [form, setForm] = useState({ name: '', destination: '', start: '', end: '', ...initial });
  const [error, setError] = useState('');
  const [review, setReview] = useState(null); // { trip, changes } while asking what to do
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Give the trip a name.');
    if (form.start && form.end && form.end < form.start) return setError('The end date is before the start date.');
    const trip = { ...form, name: form.name.trim(), destination: form.destination.trim(), end: form.start ? form.end || form.start : '', id: form.id || newId('trip') };
    // Dropping days that have plans on them? Ask first.
    const changes = !isNew && plans ? changedPlans(initial, trip, plans) : null;
    if (changes?.any) return setReview({ trip, changes });
    onSave(trip, null);
  };

  const confirmDelete = () => {
    const msg = activityCount ? `Delete "${form.name}" and its ${activityCount} activities? This can't be undone.` : `Delete "${form.name}"?`;
    if (window.confirm(msg)) onDelete(form.id);
  };

  if (review) return <DatesReview review={review} onChoose={(mode) => onSave(review.trip, mode)} onBack={() => setReview(null)} onClose={onClose} />;

  return (
    <Sheet
      title={isNew ? 'New trip' : 'Trip details'}
      onClose={onClose}
      readOnly={readOnly}
      footer={
        <>
          {!isNew && !shared && (
            <button type="button" className="btn btn-danger-ghost" onClick={confirmDelete}>
              <Icon name="trash" size={16} /> Delete trip
            </button>
          )}
          <button type="submit" form="trip-form" className="btn btn-primary btn-grow">
            {isNew ? 'Create trip' : 'Save'}
          </button>
        </>
      }
    >
      <form id="trip-form" className="form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Trip name</span>
          <input type="text" value={form.name} onChange={set('name')} placeholder="e.g. Portland Trip" />
        </label>
        <label className="field">
          <span className="field-label">Main destination <span className="optional">optional</span></span>
          <input type="text" value={form.destination} onChange={set('destination')} placeholder="e.g. Portland, OR — helps map searches" />
        </label>
        <div className="field">
          <span className="field-label">Dates</span>
          <DateRangePicker
            idPrefix="trip"
            start={form.start}
            end={form.end}
            onChange={({ start, end }) => setForm((f) => ({ ...f, start, end }))}
          />
        </div>
        <p className="field-help">No dates yet? Leave them empty and save places as ideas.</p>
        {error && <p className="field-error">{error}</p>}
      </form>
      {!isNew && sharing && (
        <div className="share-row">
          <Icon name={shared ? 'people' : 'share'} size={18} />
          <div className="grow">
            <strong>Sharing</strong>
            <p className="muted">
              {shared
                ? `Shared with you by ${ownerLabel(initial)} · you can ${initial.role === 'editor' ? 'edit' : 'view'}`
                : sharing.count
                  ? `Shared with ${sharing.count} ${sharing.count === 1 ? 'person' : 'people'}`
                  : 'Only you can see this trip'}
            </p>
          </div>
          <button type="button" className="btn btn-sm" onClick={sharing.onOpen}>
            {shared ? 'Details' : sharing.count ? 'Manage' : 'Share'}
          </button>
        </div>
      )}
    </Sheet>
  );
}

// "3 activities are on days you're removing" — and what to do with them.
function DatesReview({ review, onChoose, onBack, onClose }) {
  const { trip, changes } = review;
  const { activities, stays, places, spans, shift, canFit } = changes;
  const n = activities.length;
  const shown = activities.slice(0, 5);
  const firstDay = trip.start && fmtDate(trip.start, { weekday: 'short', month: 'short', day: 'numeric' });
  const lastDay = trip.end && fmtDate(trip.end, { weekday: 'short', month: 'short', day: 'numeric' });
  const before = canFit && activities.some((a) => a.date < trip.start);
  const after = canFit && activities.some((a) => a.date > trip.end);
  const where = before && after ? `${firstDay} or ${lastDay}` : before ? firstDay : lastDay;
  const what = [
    n && `${n} ${n === 1 ? 'activity' : 'activities'}`,
    stays.length && `${stays.length} ${stays.length === 1 ? 'hotel' : 'hotels'}`,
    places.length && `${places.length} ${places.length === 1 ? 'city' : 'cities'}`,
  ].filter(Boolean);
  const whatText = what.length > 1 ? `${what.slice(0, -1).join(', ')} and ${what[what.length - 1]}` : what[0];
  const days = Math.abs(shift);

  return (
    <Sheet
      title="Some plans are outside the new dates"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-grow" onClick={onBack}>
          <Icon name="chevronLeft" size={16} /> Go back and change the dates
        </button>
      }
    >
      <div className="form dates-review">
        <p className="review-lead">
          <Icon name="alert" size={18} />
          <span>
            <strong>{whatText}</strong> {n + stays.length + places.length === 1 ? 'is' : 'are'} on{' '}
            {trip.start ? 'days you’re removing' : 'the trip’s dates, which you’re clearing'} ({spans.map(spanText).join(' and ')}).
          </span>
        </p>

        {n > 0 && (
          <ul className="review-list">
            {shown.map((a) => {
              const c = category(a.category);
              return (
                <li key={a.id}>
                  <span className="cat-icon" style={{ width: 28, height: 28, background: c.tint, color: c.color }}>
                    <Icon name={c.icon} size={15} />
                  </span>
                  <span className="review-title">{a.title}</span>
                  <span className="review-when">{monthDay(a.date)}{a.start ? ` · ${fmtTime(a.start)}` : ''}</span>
                </li>
              );
            })}
            {n > shown.length && <li className="review-more">and {n - shown.length} more</li>}
          </ul>
        )}
        {(stays.length > 0 || places.length > 0) && (
          <p className="muted review-extra">
            {[...stays.map((s) => `🛏 ${s.name}`), ...places.map((p) => `📍 ${p.city}`)].join(' · ')}
          </p>
        )}

        <div className="review-choices">
          {shift !== 0 && (
            <button type="button" className="review-choice is-primary" onClick={() => onChoose('shift')}>
              <Icon name="calendar" size={20} />
              <span>
                <strong>Move the whole plan {days} {days === 1 ? 'day' : 'days'} {shift > 0 ? 'later' : 'earlier'}</strong>
                <small>Every activity, hotel and city keeps its place in the trip — day 1 stays day 1.</small>
              </span>
            </button>
          )}
          {canFit && (
            <button type="button" className={`review-choice${shift === 0 ? ' is-primary' : ''}`} onClick={() => onChoose('fit')}>
              <Icon name="check" size={20} />
              <span>
                <strong>{n ? `Move ${n === 1 ? 'it' : 'them'} to ${where}` : 'Trim them to the new dates'}</strong>
                <small>
                  {n ? 'Same times as before. ' : ''}
                  {stays.length || places.length ? 'Hotels and cities are trimmed to fit.' : 'You can drag them to other days afterwards.'}
                </small>
              </span>
            </button>
          )}
          <button type="button" className="review-choice" onClick={() => onChoose(null)}>
            <Icon name="sparkle" size={20} />
            <span>
              <strong>Keep {n === 1 ? 'it' : 'them'} as Ideas</strong>
              <small>Nothing is deleted. Change the dates back later and everything returns to its day.</small>
            </span>
          </button>
        </div>
      </div>
    </Sheet>
  );
}
