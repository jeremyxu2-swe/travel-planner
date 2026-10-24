import { useEffect, useRef, useState } from 'react';
import { fmtTripDates } from '../lib/time.js';
import Icon from './Icon.jsx';

export function TripMenu({ trips, trip, counts, onSelect, onNewTrip, onEditTrip, onAllTrips, userEmail, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const pick = (fn) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="trip-menu" ref={ref}>
      <button type="button" className="trip-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="trip-btn-text">
          <span className="trip-btn-name">{trip?.name || 'No trip'}</span>
          <span className="trip-btn-dates">{trip ? fmtTripDates(trip) : 'Create a trip'}</span>
        </span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-label">Switch trip</div>
          <div className="menu-scroll">
            {trips.map((t) => (
              <button key={t.id} type="button" role="menuitemradio" aria-checked={t.id === trip?.id} className="menu-item" onClick={pick(() => onSelect(t.id))}>
                <span className="menu-check">{t.id === trip?.id && <Icon name="check" size={16} />}</span>
                <span className="menu-item-text">
                  <span>{t.name}</span>
                  <small>{fmtTripDates(t)}</small>
                </span>
                <span className="menu-count">{counts[t.id] || 0}</span>
              </button>
            ))}
          </div>
          <div className="menu-sep" />
          {trip && (
            <button type="button" role="menuitem" className="menu-item" onClick={pick(onEditTrip)}>
              <span className="menu-check"><Icon name="edit" size={16} /></span>Edit trip details
            </button>
          )}
          <button type="button" role="menuitem" className="menu-item" onClick={pick(onNewTrip)}>
            <span className="menu-check"><Icon name="plus" size={16} /></span>New trip
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={pick(onAllTrips)}>
            <span className="menu-check"><Icon name="globe" size={16} /></span>All trips
          </button>
          {userEmail && (
            <>
              <div className="menu-sep" />
              <div className="menu-label menu-email">Signed in as {userEmail}</div>
              <button type="button" role="menuitem" className="menu-item" onClick={pick(onSignOut)}>
                <span className="menu-check"><Icon name="external" size={16} /></span>Sign out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Logo() {
  return (
    <div className="logo">
      <img className="logo-mark" src="/favicon.svg" width="32" height="32" alt="" />
      <span className="logo-text">Itinerary</span>
    </div>
  );
}

export function ViewToggle({ view, onChange }) {
  const views = [
    ['day', 'Day'],
    ['week', 'Week'],
    ['list', 'List'],
    ['map', 'Map'],
  ];
  return (
    <div className="seg" role="group" aria-label="View">
      {views.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={view === id} className={view === id ? 'is-on' : ''} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange }) {
  return (
    <label className="search">
      <Icon name="search" size={16} />
      <span className="sr-only">Search activities</span>
      <input type="search" placeholder="Search activities" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
