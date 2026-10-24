import { useState } from 'react';
import Icon from './Icon.jsx';

const LABELS = {
  off: 'Saved in this browser',
  signedOut: 'Saved in this browser',
  loading: 'Loading your trips…',
  syncing: 'Saving…',
  synced: 'Synced',
  error: 'Offline · saved on this device',
  schema: 'Database update needed',
};

// Small status line: green when synced, amber while saving/offline.
export function SyncStatus({ cloud }) {
  const color = cloud.status === 'synced' ? 'var(--ok)' : cloud.status === 'error' || cloud.status === 'schema' ? 'var(--warn)' : cloud.status === 'off' || cloud.status === 'signedOut' ? 'var(--faint)' : 'var(--accent)';
  return (
    <span className="saved" title={cloud.error || undefined}>
      <span className="saved-dot" style={{ background: color }} />
      {LABELS[cloud.status]}
      {cloud.status === 'schema' && (
        <button type="button" className="link-btn" onClick={() => window.alert(cloud.error)}>
          How to fix
        </button>
      )}
      {cloud.status === 'error' && (
        <button type="button" className="link-btn" onClick={cloud.retry}>
          Retry
        </button>
      )}
    </span>
  );
}

export async function confirmSignOut(cloud) {
  const warn = cloud.pending ? '\n\nSome changes haven’t reached the server yet and will be lost.' : '';
  if (!window.confirm(`Sign out? Your trips stay in your account and this device's copy is cleared.${warn}`)) return;
  await cloud.signOut();
}

// Account section shown on the Trips page.
export function CloudPanel({ cloud, onSignIn }) {
  const [busy, setBusy] = useState(false);
  if (!cloud.enabled) {
    return (
      <div className="cloud-panel">
        <Icon name="cloud" size={20} />
        <div className="grow">
          <strong>Sync isn't set up</strong>
          <p className="muted">Trips are saved in this browser only. The README explains how to connect Supabase to sync across devices.</p>
        </div>
      </div>
    );
  }
  if (!cloud.user) {
    return (
      <div className="cloud-panel">
        <Icon name="cloud" size={20} />
        <div className="grow">
          <strong>Sync across your devices</strong>
          <p className="muted">Sign in with your email to keep trips the same on your phone and laptop.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onSignIn}>
          Sign in
        </button>
      </div>
    );
  }
  const signOut = async () => {
    setBusy(true);
    try {
      await confirmSignOut(cloud);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cloud-panel">
      <Icon name="cloud" size={20} />
      <div className="grow">
        <strong>{cloud.user.email}</strong>
        <p className="muted">
          <SyncStatus cloud={cloud} />
        </p>
      </div>
      <button type="button" className="btn" onClick={signOut} disabled={busy}>
        Sign out
      </button>
    </div>
  );
}
