import { useRef, useState } from 'react';
import { fmtTripDates, todayISO, tripCountdown } from '../lib/time.js';
import { exportJSON, readImport } from '../state.js';
import Icon from './Icon.jsx';
import { CloudPanel } from './Cloud.jsx';
import { getCategories } from '../categories.js';
import TypeSheet from './TypeSheet.jsx';
import AccountProfile from './AccountProfile.jsx';
import SortableList from './SortableList.jsx';
import { isShared, ownerLabel } from '../lib/owner.js';

// "Oct 14 – 19" and "6 days" from "Oct 14 – 19 · 6 days".
const fmtRange = (t) => fmtTripDates(t).split(' · ')[0];
const fmtLength = (t) => fmtTripDates(t).split(' · ')[1] || '';
// "in 9 days", "tomorrow", "happening now"
const countdownText = (t, today) => tripCountdown(t, today).replace(/^Starts /, '').replace(/^Happening now$/, 'happening now');

function group(trips, today) {
  const g = { now: [], upcoming: [], planning: [], past: [] };
  trips.forEach((t) => {
    if (!t.start) g.planning.push(t);
    else if ((t.end || t.start) < today) g.past.push(t);
    else if (t.start <= today) g.now.push(t);
    else g.upcoming.push(t);
  });
  g.upcoming.sort((a, b) => a.start.localeCompare(b.start));
  g.past.sort((a, b) => b.start.localeCompare(a.start));
  return g;
}

// Home page with a side menu: "Trips" (your trips) and "Account"
// (activity types, appearance, your data). On phones the menu is a switch at the top.
export default function TripsPage({ state, counts, todoCounts, onOpen, onNewTrip, dispatch, cloud, theme }) {
  const [section, setSection] = useState('trips');
  const go = (id, anchor) => {
    setSection(id);
    // Account sub-links scroll to their part of the page.
    if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    else window.scrollTo?.({ top: 0 });
  };
  const nav = [
    { id: 'trips', label: 'Trips', icon: 'globe' },
    {
      id: 'account',
      label: 'Account',
      icon: 'user',
      children: [
        ...(cloud?.user ? [{ anchor: 'acct-profile', label: 'Profile & security', icon: 'key' }] : []),
        { anchor: 'acct-types', label: 'Activity types', icon: 'tag' },
        { anchor: 'acct-appearance', label: 'Appearance', icon: 'palette' },
        { anchor: 'acct-data', label: 'Your data', icon: 'cloud' },
      ],
    },
  ];
  return (
    <div className="home">
      <nav className="home-nav" aria-label="Sections">
        {nav.map((n) => (
          <div key={n.id} className="home-nav-group">
            <button type="button" className={`home-nav-item${section === n.id ? ' is-on' : ''}`} aria-current={section === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
              <Icon name={n.icon} size={18} /> {n.label}
            </button>
            {n.children && section === n.id && (
              <div className="home-nav-sub">
                {n.children.map((c) => (
                  <button key={c.anchor} type="button" className="home-nav-subitem" onClick={() => go(n.id, c.anchor)}>
                    <Icon name={c.icon} size={15} /> {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="home-main">
        {section === 'trips' ? (
          <TripsSection state={state} counts={counts} todoCounts={todoCounts} onOpen={onOpen} onNewTrip={onNewTrip} cloud={cloud} />
        ) : (
          <AccountSection state={state} dispatch={dispatch} cloud={cloud} theme={theme} />
        )}
      </div>
    </div>
  );
}

function TripsSection({ state, counts, todoCounts, onOpen, onNewTrip, cloud }) {
  const today = todayISO();
  // Your trips are grouped by date; trips other people shared with you get their own section.
  const own = state.trips.filter((t) => !isShared(t.id));
  const sharedWithMe = state.trips.filter((t) => isShared(t.id)).sort((a, b) => (a.start || '9').localeCompare(b.start || '9'));
  const g = group(own, today);
  const featured = [...g.now, ...g.upcoming];
  const sharedCount = (t) => cloud?.membersOf?.(t).length || 0;

  const Row = ({ t }) => (
    <li>
      <button type="button" className="trip-row" onClick={() => onOpen(t.id)}>
        <span className="trip-initial">{t.name.charAt(0)}</span>
        <span className="trip-row-text">
          <span>{t.name}</span>
          <small>
            {t.start ? fmtTripDates(t) : 'No dates yet'} · {counts[t.id] ? `${counts[t.id]} activities` : 'Empty'}
            {isShared(t.id) && ` · ${ownerLabel(t)} · ${t.role === 'editor' ? 'can edit' : 'view only'}`}
            {!isShared(t.id) && sharedCount(t) > 0 && ` · shared with ${sharedCount(t)}`}
          </small>
        </span>
        <Icon name="chevronRight" size={16} className="muted" />
      </button>
    </li>
  );

  return (
    <div className="trips-page">
      <div className="trips-head">
        <h1>Trips</h1>
        <button type="button" className="btn btn-primary" onClick={onNewTrip}>
          <Icon name="plus" size={16} /> New trip
        </button>
      </div>

      {state.trips.length === 0 && (
        <div className="empty empty-lg">
          <h2>Where to first?</h2>
          <p>Create a trip, add your dates, and start filling in each day.</p>
          <button type="button" className="btn btn-primary" onClick={onNewTrip}>
            <Icon name="plus" size={16} /> Create your first trip
          </button>
        </div>
      )}

      {featured.length > 0 && (
        <section>
          <h2 className="section-label">{g.now.length ? 'NOW & UPCOMING' : 'UPCOMING'}</h2>
          <div className="trip-cards">
            {featured.map((t) => (
              // Compact row (design C): name, dates and countdown, plus open to-dos.
              <button key={t.id} type="button" className="trip-card" onClick={() => onOpen(t.id)}>
                <span className="trip-card-main">
                  <span className="trip-card-name">{t.name}</span>
                  <span className="trip-card-sub">
                    {fmtRange(t)}
                    <span className="trip-card-len"> · {fmtLength(t)}</span>
                    {' · '}
                    <em>{countdownText(t, today)}</em>
                  </span>
                </span>
                <span className={`trip-card-todo${todoCounts[t.id] ? '' : ' is-zero'}`}>
                  <Icon name="checklist" size={14} />
                  {todoCounts[t.id] ? `${todoCounts[t.id]} to-do${todoCounts[t.id] === 1 ? '' : 's'} left` : 'No to-dos'}
                </span>
                <Icon name="chevronRight" size={16} className="trip-card-chev" />
              </button>
            ))}
          </div>
        </section>
      )}

      {g.planning.length > 0 && (
        <section>
          <h2 className="section-label">PLANNING · NO DATES YET</h2>
          <ul className="trip-list">
            {g.planning.map((t) => (
              <Row key={t.id} t={t} />
            ))}
          </ul>
        </section>
      )}

      {sharedWithMe.length > 0 && (
        <section>
          <h2 className="section-label">SHARED WITH YOU</h2>
          <ul className="trip-list">
            {sharedWithMe.map((t) => (
              <Row key={t.id} t={t} />
            ))}
          </ul>
        </section>
      )}

      {g.past.length > 0 && (
        <section>
          <h2 className="section-label">PAST</h2>
          <ul className="trip-list">
            {g.past.map((t) => (
              <Row key={t.id} t={t} />
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}

function AccountSection({ state, dispatch, cloud, theme }) {
  const fileRef = useRef(null);
  const [typeSheet, setTypeSheet] = useState(null);
  const types = getCategories();
  const usage = {};
  state.activities.forEach((a) => (usage[a.category] = (usage[a.category] || 0) + 1));

  const doImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = await readImport(file);
      if (window.confirm(cloud?.user ? 'Replace all trips in your account with the imported file?' : 'Replace everything in this browser with the imported file?')) dispatch({ type: 'replaceAll', data });
    } catch (err) {
      window.alert(err.message);
    }
  };

  return (
    <div className="trips-page account-page">
      <div className="trips-head">
        <h1>Account</h1>
      </div>
      {cloud?.user && <p className="muted account-hello">Signed in as {cloud.displayName ? <><strong>{cloud.displayName}</strong> · {cloud.user.email}</> : <strong>{cloud.user.email}</strong>}</p>}

      {cloud?.user && <AccountProfile cloud={cloud} state={state} />}

      <section className="data-tools" id="acct-types">
        <div className="section-row">
          <h2 className="section-label">ACTIVITY TYPES</h2>
          <button type="button" className="btn btn-sm" onClick={() => setTypeSheet({})}>
            <Icon name="plus" size={14} /> Add type
          </button>
        </div>
        <p className="muted">Used for every trip. Pick a symbol and a color for each type — that's how activities show on the calendar. Drag to change the order.</p>
        <SortableList
          className="type-list"
          items={types}
          getKey={(c) => c.id}
          getLabel={(c) => c.label}
          onMove={(from, to) => dispatch({ type: 'moveCategoryTo', from, to })}
          renderRow={(c) => (
            <button type="button" className="type-main" onClick={() => setTypeSheet(state.categories.find((x) => x.id === c.id))} aria-label={`Edit ${c.label}`}>
              <span className="cat-icon" style={{ width: 34, height: 34, background: c.tint, color: c.color }}>
                <Icon name={c.icon} size={18} />
              </span>
              <span className="type-text">
                <span className="type-name">{c.label}</span>
                <small className="muted">{usage[c.id] ? `${usage[c.id]} ${usage[c.id] === 1 ? 'activity' : 'activities'}` : 'Not used yet'}</small>
              </span>
              <span className="type-chip" style={{ background: c.tint, color: c.color }}>{c.label}</span>
            </button>
          )}
        />
        <button
          type="button"
          className="link-btn type-reset"
          onClick={() =>
            window.confirm('Go back to the seven default types? Activities using your own types will become “Other”.') && dispatch({ type: 'resetCategories' })
          }
        >
          Reset to defaults
        </button>
      </section>

      {theme && (
        <section className="data-tools" id="acct-appearance">
          <h2 className="section-label">APPEARANCE</h2>
          <div className="appearance">
            <Icon name={theme.resolved === 'dark' ? 'moon' : 'sun'} size={20} />
            <div className="grow">
              <strong>{theme.resolved === 'dark' ? 'Midnight' : 'Daylight'}</strong>
              <p className="muted">{theme.pref === 'system' ? 'Following your device setting' : 'Saved on this device'}</p>
            </div>
            <div className="seg" role="group" aria-label="Theme">
              {[['system', 'Auto', 'monitor'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']].map(([id, label, icon]) => (
                <button key={id} type="button" aria-pressed={theme.pref === id} className={theme.pref === id ? 'is-on' : ''} onClick={() => theme.setPref(id)}>
                  <Icon name={icon} size={14} /> {label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="data-tools" id="acct-data">
        <h2 className="section-label">YOUR DATA</h2>
        {cloud && <CloudPanel cloud={cloud} />}
        <p className="muted">You can also export a backup file at any time.</p>
        <div className="row-gap">
          <button type="button" className="btn" onClick={() => exportJSON(state)}>
            <Icon name="download" size={16} /> Export backup
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} /> Import backup
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
        </div>
      </section>

      {typeSheet && (
        <TypeSheet
          initial={typeSheet}
          usage={usage[typeSheet.id] || 0}
          canDelete={types.length > 1}
          onClose={() => setTypeSheet(null)}
          onSave={(category) => {
            dispatch({ type: 'saveCategory', category });
            setTypeSheet(null);
          }}
          onDelete={(id, moveTo) => {
            dispatch({ type: 'deleteCategory', id, moveTo });
            setTypeSheet(null);
          }}
        />
      )}
    </div>
  );
}
