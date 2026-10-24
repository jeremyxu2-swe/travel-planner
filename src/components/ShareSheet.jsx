import { useState } from 'react';
import { isShared } from '../lib/owner.js';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';

const ROLES = [
  { id: 'viewer', label: 'Can view', help: 'Sees the whole trip, changes nothing' },
  { id: 'editor', label: 'Can edit', help: 'Adds, moves and changes plans' },
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Share a trip with other people by email, change their access, or remove them.
// For a trip someone shared with you: who shared it, your access, and "Leave trip".
export default function ShareSheet({ trip, cloud, onClose, onLeft }) {
  const shared = isShared(trip.id);
  const me = (cloud.user?.email || '').toLowerCase();
  const members = cloud.membersOf(trip);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const run = async (key, fn, done) => {
    setBusy(key);
    setError('');
    setNote('');
    try {
      await fn();
      if (done) setNote(done);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const invite = (e) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!EMAIL.test(addr)) return setError('Enter an email address, like sam@example.com.');
    if (addr === me) return setError('That’s you — you already have this trip.');
    if (members.some((m) => m.email === addr)) return setError(`${addr} already has access. Change it in the list below.`);
    run('invite', () => cloud.shareTrip(trip, addr, role), `Shared with ${addr}. They’ll see “${trip.name}” when they sign in with that email.`).then(() => setEmail(''));
  };

  if (shared) {
    return (
      <Sheet title={`“${trip.name}”`} onClose={onClose} footer={<button type="button" className="btn btn-grow" onClick={onClose}>Done</button>}>
        <div className="form share">
          <div className="share-person">
            <span className="avatar">{(trip.ownerName || trip.ownerEmail || '?').charAt(0).toUpperCase()}</span>
            <span className="share-who">
              <strong>{trip.ownerName || trip.ownerEmail || 'The owner'}</strong>
              <small>Owner · {trip.ownerName && trip.ownerEmail ? `${trip.ownerEmail} · ` : ''}shared this trip with you</small>
            </span>
          </div>
          <div className="share-person">
            <span className="avatar is-me">{me.charAt(0).toUpperCase()}</span>
            <span className="share-who">
              <strong>{me} (you)</strong>
              <small>{trip.role === 'editor' ? 'Can edit — add, move and change plans' : 'Can view — you can look but not change anything'}</small>
            </span>
          </div>
          <p className="field-help">Only the owner can change who has access.</p>
          <button
            type="button"
            className="btn btn-danger-ghost share-leave"
            disabled={!!busy}
            onClick={() =>
              window.confirm(`Leave “${trip.name}”? It disappears from your trips. The owner can share it with you again.`) &&
              run('leave', async () => {
                await cloud.leaveTrip(trip);
                onLeft?.();
              })
            }
          >
            <Icon name="logout" size={16} /> {busy === 'leave' ? 'Leaving…' : 'Leave this trip'}
          </button>
          {error && <p className="field-error">{error}</p>}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={`Share “${trip.name}”`} onClose={onClose} footer={<button type="button" className="btn btn-grow" onClick={onClose}>Done</button>}>
      <div className="form share">
        <form className="share-invite" onSubmit={invite} noValidate>
          <label className="field">
            <span className="field-label">Invite by email</span>
            <input
              type="email"
              value={email}
              autoComplete="off"
              placeholder="friend@example.com"
              aria-invalid={!!error}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
            />
          </label>
          <div className="share-invite-row">
            <div className="seg share-role" role="group" aria-label="Access">
              {ROLES.map((r) => (
                <button key={r.id} type="button" className={role === r.id ? 'is-on' : ''} aria-pressed={role === r.id} onClick={() => setRole(r.id)} title={r.help}>
                  <Icon name={r.id === 'viewer' ? 'eye' : 'edit'} size={14} /> {r.label}
                </button>
              ))}
            </div>
            <button type="submit" className="btn btn-primary" disabled={!!busy}>
              <Icon name="userPlus" size={16} /> {busy === 'invite' ? 'Sharing…' : 'Share'}
            </button>
          </div>
          <p className="field-help">{ROLES.find((r) => r.id === role).help}. They don’t need an account yet — they can create one with this email.</p>
        </form>

        {error && <p className="field-error" role="alert">{error}</p>}
        {note && <p className="share-note" role="status"><Icon name="check" size={15} /> {note}</p>}

        <div className="field">
          <span className="field-label">People with access</span>
          <ul className="share-list">
            <li className="share-person">
              <span className="avatar is-me">{me.charAt(0).toUpperCase()}</span>
              <span className="share-who">
                <strong>{me} (you)</strong>
                <small>Owner</small>
              </span>
            </li>
            {members.map((m) => (
              <li key={m.email} className="share-person">
                <span className="avatar">{m.email.charAt(0).toUpperCase()}</span>
                <span className="share-who">
                  <strong>{m.email}</strong>
                  <small>{m.role === 'editor' ? 'Can edit' : 'Can view'}</small>
                </span>
                <select
                  className="share-select"
                  aria-label={`Access for ${m.email}`}
                  value={m.role}
                  disabled={!!busy}
                  onChange={(e) => run(`role:${m.email}`, () => cloud.shareTrip(trip, m.email, e.target.value), `${m.email} ${e.target.value === 'editor' ? 'can now edit' : 'can now only view'}.`)}
                >
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="icon-btn share-remove"
                  aria-label={`Remove ${m.email}`}
                  title="Remove access"
                  disabled={!!busy}
                  onClick={() =>
                    window.confirm(`Remove ${m.email} from “${trip.name}”? They’ll lose access right away.`) &&
                    run(`remove:${m.email}`, () => cloud.removeMember(trip, m.email), `${m.email} no longer has access.`)
                  }
                >
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>
          {members.length === 0 && <p className="muted share-empty">Not shared with anyone yet.</p>}
        </div>
      </div>
    </Sheet>
  );
}
