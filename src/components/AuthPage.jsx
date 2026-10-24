import { useState } from 'react';
import Icon from './Icon.jsx';
import { Logo } from './Header.jsx';

const MIN_PASSWORD = 8;

// Turns Supabase's error messages into plain language.
function friendly(err) {
  const m = (err?.message || '').toLowerCase();
  if (m.includes('invalid login credentials')) return "That email and password don't match. Try again, or reset your password.";
  if (m.includes('already registered') || m.includes('already exists')) return 'ALREADY_REGISTERED';
  if (m.includes('email not confirmed')) return 'NOT_CONFIRMED';
  // Supabase's built-in email service sends at most 2 emails an hour for the whole app.
  if (m.includes('email rate limit')) return 'Too many emails have been sent from this app in the last hour. Wait up to an hour, then try again.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  // Usually Supabase's built-in email service refusing an address outside the project's team.
  if (m.includes('error sending') || m.includes('sending confirmation') || m.includes('sending magic link') || m.includes('sending recovery'))
    return "The confirmation email couldn't be sent. If you run this app: Supabase only emails your own team's addresses until you set up an email service (Authentication → Emails → SMTP Settings).";
  if (m.includes('failed to fetch') || m.includes('network')) return "Can't reach the server. Check your internet connection.";
  if (m.includes('password')) return err.message;
  return err?.message || 'Something went wrong. Please try again.';
}

function PasswordField({ label, value, onChange, autoComplete, id }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} />
        <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
}

// "Resend" with a short cooldown so people don't hit Supabase's email limit.
function ResendButton({ cloud, email }) {
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [msg, setMsg] = useState('');
  const send = async () => {
    setState('sending');
    try {
      await cloud.resendConfirmation(email);
      setState('sent');
      setMsg('Sent — check your inbox (and spam).');
      setTimeout(() => setState('idle'), 60000);
    } catch (err) {
      setState('error');
      setMsg(friendly(err));
    }
  };
  return (
    <span className="resend">
      <button type="button" className="link-btn" onClick={send} disabled={state === 'sending' || state === 'sent'}>
        {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Email sent' : 'Resend confirmation email'}
      </button>
      {msg && state !== 'idle' && <span className={state === 'error' ? 'resend-err' : 'resend-ok'}>{msg}</span>}
    </span>
  );
}

function Shell({ children }) {
  return (
    <div className="auth">
      <aside className="auth-brand">
        <Logo />
        <h1>Plan every day of your trip — on any device.</h1>
        <ul>
          <li><Icon name="calendar" size={18} /> Day-by-day timelines that flag clashing times</li>
          <li><Icon name="route" size={18} /> One tap to open each day's route in Google Maps</li>
          <li><Icon name="cloud" size={18} /> Your trips sync between phone and laptop</li>
        </ul>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-mobile-logo"><Logo /></div>
          {children}
        </div>
      </main>
    </div>
  );
}

export default function AuthPage({ cloud }) {
  const [mode, setMode] = useState('signin'); // signin | signup | forgot | confirm | resetSent
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const go = (m) => {
    setMode(m);
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const addr = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(addr)) return setError('Enter a valid email address.');
    if (mode !== 'forgot' && !password) return setError('Enter your password.');
    if (mode === 'signup' && password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
    setError('');
    setBusy(true);
    try {
      if (mode === 'signin') await cloud.signIn(addr, password);
      else if (mode === 'signup') {
        const { needsConfirmation } = await cloud.signUp(addr, password);
        if (needsConfirmation) setMode('confirm');
      } else if (mode === 'forgot') {
        await cloud.resetPassword(addr);
        setMode('resetSent');
      }
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'confirm' || mode === 'resetSent') {
    return (
      <Shell>
        <h2 className="auth-title">{mode === 'confirm' ? 'Confirm your email' : 'Check your email'}</h2>
        {mode === 'confirm' ? (
          <>
            <p className="auth-text">
              We sent a link to <strong>{email}</strong>. Click it to confirm your account — you only need to do this once.
            </p>
            <p className="auth-text muted">
              Open the link on this device and you'll be signed in automatically. Otherwise, come back here and sign in with your email and password.
            </p>
            <p className="auth-text muted">
              Didn't get it? Check spam, or <ResendButton cloud={cloud} email={email} />
            </p>
          </>
        ) : (
          <p className="auth-text">
            If there's an account for <strong>{email}</strong>, we've sent a link to reset your password.
          </p>
        )}
        <button type="button" className="btn btn-primary auth-submit" onClick={() => go('signin')}>
          Back to sign in
        </button>
      </Shell>
    );
  }

  const isUp = mode === 'signup';
  return (
    <Shell>
      {mode === 'forgot' ? (
        <>
          <h2 className="auth-title">Reset your password</h2>
          <p className="auth-text">Enter your account email and we'll send you a link to choose a new password.</p>
        </>
      ) : (
        <>
          {cloud.deleted && <p className="auth-deleted" role="status">Your account and everything in it were deleted.</p>}
          <h2 className="auth-title">{isUp ? 'Create your account' : 'Welcome back'}</h2>
          <div className="seg auth-seg" role="group" aria-label="Sign in or create account">
            <button type="button" aria-pressed={!isUp} className={!isUp ? 'is-on' : ''} onClick={() => go('signin')}>Sign in</button>
            <button type="button" aria-pressed={isUp} className={isUp ? 'is-on' : ''} onClick={() => go('signup')}>Create account</button>
          </div>
        </>
      )}

      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="auth-email">Email</label>
          <input id="auth-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        {mode !== 'forgot' && (
          <PasswordField
            id="auth-password"
            label={isUp ? `Password (at least ${MIN_PASSWORD} characters)` : 'Password'}
            value={password}
            onChange={setPassword}
            autoComplete={isUp ? 'new-password' : 'current-password'}
          />
        )}
        {mode === 'signin' && (
          <button type="button" className="link-btn auth-forgot" onClick={() => go('forgot')}>Forgot password?</button>
        )}

        {error && (
          <p className="auth-error" role="alert">
            {error === 'NOT_CONFIRMED' ? (
              <>
                Please confirm your email first — click the link we sent when you signed up.{' '}
                <ResendButton cloud={cloud} email={email.trim()} />
              </>
            ) : error === 'ALREADY_REGISTERED' ? (
              <>
                There's already an account with this email.{' '}
                <button type="button" className="link-btn" onClick={() => go('signin')}>Sign in instead</button>
              </>
            ) : (
              error
            )}
          </p>
        )}

        <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? 'One moment…' : mode === 'forgot' ? 'Send reset link' : isUp ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="auth-switch">
        {mode === 'forgot' ? (
          <button type="button" className="link-btn" onClick={() => go('signin')}>Back to sign in</button>
        ) : isUp ? (
          <>Already have an account? <button type="button" className="link-btn" onClick={() => go('signin')}>Sign in</button></>
        ) : (
          <>New here? <button type="button" className="link-btn" onClick={() => go('signup')}>Create an account</button></>
        )}
      </p>
    </Shell>
  );
}

// Shown after opening a password-reset link.
export function SetPasswordPage({ cloud }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    try {
      await cloud.updatePassword(password);
    } catch (err) {
      setError(friendly(err));
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h2 className="auth-title">Choose a new password</h2>
      <p className="auth-text">Signed in as <strong>{cloud.user?.email}</strong>.</p>
      <form className="form" onSubmit={submit} noValidate>
        <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
        <PasswordField id="confirm-password" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </Shell>
  );
}

export function Splash({ text = 'Loading…' }) {
  return (
    <div className="splash" role="status">
      <Logo />
      <p>{text}</p>
    </div>
  );
}
