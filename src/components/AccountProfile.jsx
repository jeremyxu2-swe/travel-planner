import { useState } from 'react';
import { exportJSON } from '../state.js';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';

const MIN_PASSWORD = 8;

// Account → Profile & security: your name, password, and deleting your account.
export default function AccountProfile({ cloud, state }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <section className="data-tools" id="acct-profile">
      <h2 className="section-label">PROFILE &amp; SECURITY</h2>
      <div className="profile-card">
        <NameRow cloud={cloud} />
        <div className="profile-row">
          <Icon name="user" size={18} />
          <div className="grow">
            <strong>Email</strong>
            <p className="muted">{cloud.user.email} · used to sign in</p>
          </div>
        </div>
        <PasswordRow cloud={cloud} />
        <div className="profile-row">
          <Icon name="trash" size={18} className="danger-ink" />
          <div className="grow">
            <strong>Delete account</strong>
            <p className="muted">Permanently removes your account and everything in it.</p>
          </div>
          <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => setDeleting(true)}>
            Delete…
          </button>
        </div>
      </div>
      {deleting && <DeleteAccountSheet cloud={cloud} state={state} onClose={() => setDeleting(false)} />}
    </section>
  );
}

function NameRow({ cloud }) {
  const [name, setName] = useState(cloud.displayName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const changed = name.trim() !== cloud.displayName;
  const save = async (e) => {
    e.preventDefault();
    if (!changed) return;
    setBusy(true);
    setMsg(null);
    try {
      await cloud.updateName(name);
      setMsg({ ok: true, text: name.trim() ? 'Saved. People you share trips with will see this name.' : 'Name removed — your email is shown instead.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="profile-row profile-name" onSubmit={save}>
      <Icon name="tag" size={18} />
      <div className="grow">
        <label htmlFor="profile-name"><strong>Name</strong></label>
        <p className="muted">Shown in the app and to people you share trips with.</p>
        <div className="profile-inline">
          <input id="profile-name" type="text" value={name} maxLength={60} placeholder="e.g. Jeremy" onChange={(e) => { setName(e.target.value); setMsg(null); }} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={!changed || busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
        {msg && <p className={msg.ok ? 'profile-ok' : 'field-error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      </div>
    </form>
  );
}

function PasswordRow({ cloud }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    setMsg(null);
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!f.current) return setMsg({ ok: false, text: 'Enter your current password.' });
    if (f.next.length < MIN_PASSWORD) return setMsg({ ok: false, text: `Use at least ${MIN_PASSWORD} characters for the new password.` });
    if (f.next !== f.confirm) return setMsg({ ok: false, text: 'The new passwords don’t match.' });
    if (f.next === f.current) return setMsg({ ok: false, text: 'Choose a password different from your current one.' });
    setBusy(true);
    setMsg(null);
    try {
      await cloud.changePassword(f.current, f.next);
      setF({ current: '', next: '', confirm: '' });
      setOpen(false);
      setMsg({ ok: true, text: 'Password changed. Use the new one next time you sign in.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };
  const type = show ? 'text' : 'password';
  return (
    <div className="profile-row">
      <Icon name="key" size={18} />
      <div className="grow">
        <strong>Password</strong>
        {!open ? (
          <>
            <p className="muted">Change the password you sign in with.</p>
            {msg?.ok && <p className="profile-ok" role="status">{msg.text}</p>}
          </>
        ) : (
          <form className="profile-pw" onSubmit={submit} noValidate>
            <label className="field">
              <span className="field-label">Current password</span>
              <input id="pw-current" type={type} value={f.current} onChange={set('current')} autoComplete="current-password" />
            </label>
            <label className="field">
              <span className="field-label">New password <span className="optional">at least {MIN_PASSWORD} characters</span></span>
              <input id="pw-new" type={type} value={f.next} onChange={set('next')} autoComplete="new-password" />
            </label>
            <label className="field">
              <span className="field-label">Type the new password again</span>
              <input id="pw-confirm" type={type} value={f.confirm} onChange={set('confirm')} autoComplete="new-password" />
            </label>
            <label className="profile-show">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords
            </label>
            {msg && !msg.ok && <p className="field-error" role="alert">{msg.text}</p>}
            <div className="row-gap">
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</button>
              <button type="button" className="btn btn-sm" onClick={() => { setOpen(false); setF({ current: '', next: '', confirm: '' }); setMsg(null); }}>Cancel</button>
            </div>
          </form>
        )}
      </div>
      {!open && (
        <button type="button" className="btn btn-sm" onClick={() => { setOpen(true); setMsg(null); }}>
          Change…
        </button>
      )}
    </div>
  );
}

function DeleteAccountSheet({ cloud, state, onClose }) {
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const own = state.trips.filter((t) => !t.id.includes('~'));
  const ownIds = new Set(own.map((t) => t.id));
  const acts = state.activities.filter((a) => ownIds.has(a.tripId)).length;
  const sharedOut = (cloud.members || []).length;
  const sharedIn = state.trips.length - own.length;
  const ready = password && typed.trim().toUpperCase() === 'DELETE';

  const go = async () => {
    setBusy(true);
    setError('');
    try {
      await cloud.deleteAccount(password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Delete your account?"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-danger btn-grow" disabled={!ready || busy} onClick={go}>
            <Icon name="trash" size={16} /> {busy ? 'Deleting…' : 'Delete my account'}
          </button>
        </>
      }
    >
      <div className="form">
        <p className="review-lead">
          <Icon name="alert" size={18} />
          <span>This can’t be undone. Your login for <strong>{cloud.user.email}</strong> and everything below is deleted for good.</span>
        </p>
        <ul className="delete-list">
          <li>{own.length} {own.length === 1 ? 'trip' : 'trips'} and {acts} {acts === 1 ? 'activity' : 'activities'}, with their hotels, cities and to-dos</li>
          <li>Your activity types</li>
          {sharedOut > 0 && <li>Access for the {sharedOut} {sharedOut === 1 ? 'person' : 'people'} you shared trips with</li>}
          {sharedIn > 0 && <li>{sharedIn} {sharedIn === 1 ? 'trip' : 'trips'} shared with you disappear from your list (the owners keep them)</li>}
        </ul>
        <button type="button" className="btn btn-sm delete-backup" onClick={() => exportJSON(state)}>
          <Icon name="download" size={14} /> Download a backup first
        </button>
        <label className="field">
          <span className="field-label">Your password</span>
          <input id="delete-password" type="password" value={password} autoComplete="current-password" onChange={(e) => { setPassword(e.target.value); setError(''); }} />
        </label>
        <label className="field">
          <span className="field-label">Type DELETE to confirm</span>
          <input id="delete-typed" type="text" value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" />
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}
