// Cloud sync with Supabase.
//
// How it works: the app keeps working from local state (and localStorage) as
// before. When you're signed in, every change is compared against the last
// state the server confirmed, and only the differences are sent. If a save
// fails (offline, server hiccup) the changes stay on this device and are
// retried. When the tab regains focus, the latest data is pulled from the
// server so edits made on your other devices show up.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { emptyState } from './state.js';
import { DEFAULT_CATEGORIES } from './categories.js';
import { isShared, ownerOf, rawId, sharedId } from './lib/owner.js';

const TABLES = ['trips', 'activities', 'todos', 'stays', 'places', 'categories'];
const RETRY_MS = 10000;
const DEBOUNCE_MS = 400;
const OWNER_KEY = 'travel-planner:owner';

// ---------- row mapping (app uses camelCase + '' for empty, DB uses snake_case + null)
const toRow = {
  trips: (t, uid) => ({
    user_id: uid,
    id: t.id,
    name: t.name,
    destination: t.destination || '',
    start_date: t.start || null,
    end_date: t.end || null,
    notes: t.notes || '',
  }),
  activities: (a, uid) => ({
    user_id: uid,
    id: a.id,
    trip_id: a.tripId,
    date: a.date || null,
    start_time: a.start || null,
    end_time: a.end || null,
    title: a.title,
    category: a.category || 'other',
    location: a.location || '',
    notes: a.notes || '',
    lat: a.lat ?? null,
    lng: a.lng ?? null,
  }),
  stays: (s, uid) => ({
    user_id: uid,
    id: s.id,
    trip_id: s.tripId,
    name: s.name,
    location: s.location || '',
    check_in: s.checkIn,
    check_in_time: s.checkInTime || null,
    check_out: s.checkOut,
    check_out_time: s.checkOutTime || null,
    notes: s.notes || '',
  }),
  todos: (t, uid) => ({ user_id: uid, id: t.id, trip_id: t.tripId, text: t.text, done: !!t.done }),
  categories: (c, uid) => ({
    user_id: uid,
    id: c.id,
    label: c.label,
    icon: c.icon,
    color: c.color,
    position: c.position ?? 0,
  }),
  places: (p, uid) => ({
    user_id: uid,
    id: p.id,
    trip_id: p.tripId,
    city: p.city,
    country: p.country || '',
    country_code: p.countryCode || '',
    code: p.code || '',
    start_date: p.start,
    end_date: p.end,
  }),
};

const fromRow = {
  trips: (r) => ({ id: r.id, name: r.name, destination: r.destination || '', start: r.start_date || '', end: r.end_date || '', notes: r.notes || '' }),
  activities: (r) => ({
    id: r.id,
    tripId: r.trip_id,
    date: r.date || '',
    start: r.start_time || '',
    end: r.end_time || '',
    title: r.title,
    category: r.category,
    location: r.location || '',
    notes: r.notes || '',
    ...(r.lat != null ? { lat: r.lat, lng: r.lng } : {}),
  }),
  stays: (r) => ({
    id: r.id,
    tripId: r.trip_id,
    name: r.name,
    location: r.location || '',
    checkIn: r.check_in,
    checkInTime: r.check_in_time || '',
    checkOut: r.check_out,
    checkOutTime: r.check_out_time || '',
    notes: r.notes || '',
  }),
  todos: (r) => ({ id: r.id, tripId: r.trip_id, text: r.text, done: !!r.done }),
  categories: (r) => ({ id: r.id, label: r.label, icon: r.icon, color: r.color, position: r.position ?? 0 }),
  places: (r) => ({
    id: r.id,
    tripId: r.trip_id,
    city: r.city,
    country: r.country || '',
    countryCode: r.country_code || '',
    code: r.code || '',
    start: r.start_date,
    end: r.end_date,
  }),
};

// Items whose object identity changed are upserted; missing ids are deleted.
// (The reducer only replaces the objects it changes, so identity is a cheap
// and exact "was this edited" check.)
export function diffCollections(prev, next) {
  const out = {};
  let empty = true;
  // Trips shared with you: only changes an editor may make are sent. Trips (and
  // their contents) that disappear because you left or lost access are never
  // deleted from the owner's account.
  const tripNow = new Map((next.trips || []).map((t) => [t.id, t]));
  const editable = (tripId) => !isShared(tripId) || tripNow.get(tripId)?.role === 'editor';
  for (const table of TABLES) {
    const before = new Map((prev?.[table] || []).map((x) => [x.id, x]));
    const after = new Set();
    const upserts = [];
    const tripOf = (x) => (table === 'trips' ? x.id : x.tripId);
    for (const item of next[table] || []) {
      after.add(item.id);
      if (before.get(item.id) !== item && (table === 'categories' || editable(tripOf(item)))) upserts.push(item);
    }
    const deletes = [...before.keys()].filter((id) => {
      if (after.has(id)) return false;
      if (!isShared(id) || table === 'categories') return true;
      return table !== 'trips' && editable(tripOf(before.get(id)));
    });
    // Activity types are saved as a whole list: until you first change one, the
    // defaults only live on the device, so any change sends the full set.
    if (table === 'categories' && (upserts.length || deletes.length)) upserts.splice(0, upserts.length, ...(next[table] || []));
    out[table] = { upserts, deletes };
    if (upserts.length || deletes.length) empty = false;
  }
  return empty ? null : out;
}

// App object <-> database row, including the owner of shared items.
function rowFor(table, x, uid) {
  if (table === 'categories') return toRow.categories(x, uid);
  const tripId = table === 'trips' ? x.id : x.tripId;
  const plain = { ...x, id: rawId(x.id), ...(table === 'trips' ? {} : { tripId: rawId(x.tripId) }) };
  return toRow[table](plain, ownerOf(tripId) || uid);
}
function itemFor(table, r, uid) {
  const x = fromRow[table](r);
  if (!r.user_id || r.user_id === uid) return x;
  return { ...x, id: sharedId(r.user_id, x.id), ...(table === 'trips' ? { owner: r.user_id } : { tripId: sharedId(r.user_id, x.tripId) }) };
}

// Set when the database doesn't have the activity-types table yet (schema.sql
// not re-run since v0.11). Everything else keeps syncing; types stay on the device.
let typesTableMissing = false;

async function pushDiff(diff, uid) {
  const check = ({ error }) => {
    if (error) throw error;
  };
  const tables = (list) => list.filter((t) => !(t === 'categories' && typesTableMissing));
  // Children first when deleting, parents first when inserting.
  for (const table of tables(['todos', 'stays', 'places', 'activities', 'trips', 'categories'])) {
    // Grouped by owner: your rows, and rows in trips shared with you.
    const byOwner = new Map();
    for (const id of diff[table].deletes) {
      const owner = (table !== 'categories' && ownerOf(id)) || uid;
      byOwner.set(owner, [...(byOwner.get(owner) || []), rawId(id)]);
    }
    for (const [owner, ids] of byOwner) check(await supabase.from(table).delete().eq('user_id', owner).in('id', ids));
  }
  for (const table of tables(['categories', 'trips', 'activities', 'todos', 'stays', 'places'])) {
    const rows = diff[table].upserts.map((x) => rowFor(table, x, uid));
    if (rows.length) check(await supabase.from(table).upsert(rows, { onConflict: 'user_id,id' }));
  }
  // Types changed but can't be saved yet: say so (the rest did sync).
  if (typesTableMissing && (diff.categories.upserts.length || diff.categories.deletes.length)) {
    const e = new Error('schema');
    e.code = '42P01';
    throw e;
  }
}

// The app is newer than the database tables (schema.sql needs to be run again).
const SCHEMA_HELP = 'Your Supabase database needs a quick update: open supabase/schema.sql, paste it into Supabase → SQL Editor and click Run. Your changes are kept on this device until then.';
function isSchemaError(e) {
  const m = `${e?.code || ''} ${e?.message || ''}`;
  return /PGRST20[2345]|42P01|42703|42883|schema cache|does not exist|could not find the function/i.test(m);
}

// Set when the database doesn't have the sharing table yet (schema.sql not re-run since v0.15).
let membersTableMissing = false;
const isAccessError = (e) => /42501|row-level security/i.test(`${e?.code || ''} ${e?.message || ''}`);

// localTypes: used when the account has no saved types (yet), or the table is missing.
async function fetchAll(uid, email, localTypes) {
  const [results, memberRes] = await Promise.all([
    Promise.all(TABLES.map((t) => supabase.from(t).select('*'))),
    supabase.from('trip_members').select('*'),
  ]);
  membersTableMissing = !!memberRes.error && isSchemaError(memberRes.error);
  if (memberRes.error && !membersTableMissing) throw memberRes.error;
  const memberRows = memberRes.data || [];
  const me = (email || '').toLowerCase();
  // Your access to each trip shared with you, and who your own trips are shared with.
  const access = new Map(memberRows.filter((m) => m.owner_id !== uid && m.email === me).map((m) => [sharedId(m.owner_id, m.trip_id), m]));
  const data = {
    members: memberRows.filter((m) => m.owner_id === uid).map((m) => ({ tripId: m.trip_id, email: m.email, role: m.role })),
  };
  results.forEach(({ data: rows, error }, i) => {
    const table = TABLES[i];
    if (table === 'categories') {
      typesTableMissing = !!error && isSchemaError(error);
      if (error && !typesTableMissing) throw error;
      const own = (rows || []).filter((r) => r.user_id === uid || !r.user_id);
      const list = own.map(fromRow.categories).sort((a, b) => a.position - b.position);
      data.categories = list.length ? list : localTypes || DEFAULT_CATEGORIES;
      // Types of the people who shared trips with you (so their activities keep their look).
      data.sharedTypes = (rows || []).filter((r) => r.user_id && r.user_id !== uid).map((r) => ({ ...fromRow.categories(r), owner: r.user_id }));
      return;
    }
    if (error) throw error;
    let items = rows.map((r) => itemFor(table, r, uid));
    if (table === 'trips') {
      items = items
        .filter((t) => !t.owner || access.has(t.id))
        .map((t) => (t.owner ? { ...t, role: access.get(t.id).role, ownerEmail: access.get(t.id).owner_email || '', ownerName: access.get(t.id).owner_name || '' } : t));
    }
    data[table] = items;
  });
  // Drop anything whose shared trip you no longer have.
  const tripIds = new Set(data.trips.map((t) => t.id));
  for (const t of ['activities', 'todos', 'stays', 'places']) data[t] = data[t].filter((x) => !isShared(x.tripId) || tripIds.has(x.tripId));
  return data;
}

const fingerprint = (d) =>
  JSON.stringify([
    TABLES.map((t) => [...(d[t] || [])].sort((a, b) => (a.id < b.id ? -1 : 1)).map((x) => toRow[t](x, ''))),
    (d.trips || []).map((t) => `${t.id}|${t.role || ''}|${t.ownerEmail || ''}|${t.ownerName || ''}`).sort(),
    (d.sharedTypes || []).map((c) => `${c.owner}|${c.id}|${c.label}|${c.icon}|${c.color}`).sort(),
  ]);

// The name someone chose for themselves ('' if none).
export const displayName = (user) => (user?.user_metadata?.display_name || '').trim();

// status: 'off' (not configured) | 'signedOut' | 'loading' | 'syncing' | 'synced' | 'error'
export function useCloudSync(state, dispatch) {
  const enabled = !!supabase;
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState(enabled ? 'loading' : 'off');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(!enabled); // true once we know whether you're signed in
  const [recovery, setRecovery] = useState(false); // opened a password-reset link

  const stateRef = useRef(state);
  stateRef.current = state;
  const baseline = useRef(null); // last state the server confirmed; null = don't push yet
  const awaitingHydrate = useRef(false);
  const busy = useRef(false);
  const timer = useRef(null);
  const uid = session?.user?.id || null;
  const uidRef = useRef(uid);
  uidRef.current = uid;
  const emailRef = useRef('');
  emailRef.current = (session?.user?.email || '').toLowerCase();
  const nameRef = useRef('');
  nameRef.current = displayName(session?.user);
  const [deleted, setDeleted] = useState(false); // just deleted the account (shown on the sign-in page)
  const pullRef = useRef(null);
  const [members, setMembers] = useState([]); // who your trips are shared with

  // ---- auth
  useEffect(() => {
    if (!enabled) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setStatus('signedOut');
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (!s) setStatus('signedOut');
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [enabled]);

  // ---- push local changes
  const push = useCallback(async () => {
    clearTimeout(timer.current);
    const id = uidRef.current;
    if (!id || !baseline.current || busy.current) return;
    const target = stateRef.current;
    const diff = diffCollections(baseline.current, target);
    if (!diff) {
      setStatus('synced');
      return;
    }
    busy.current = true;
    setStatus('syncing');
    try {
      await pushDiff(diff, id);
      if (uidRef.current !== id) return; // signed out meanwhile
      baseline.current = target;
      setError('');
      setStatus('synced');
      if (stateRef.current !== target) timer.current = setTimeout(push, DEBOUNCE_MS);
    } catch (e) {
      busy.current = false;
      // Your access to a shared trip changed (removed, or now view-only): reload
      // from the server instead of retrying changes that will never be allowed.
      if (isAccessError(e)) {
        setError('Some changes to a shared trip couldn’t be saved because your access changed.');
        return pullRef.current?.({ discard: true });
      }
      const schema = isSchemaError(e);
      setError(schema ? SCHEMA_HELP : e.message || 'Could not reach the server');
      setStatus(schema ? 'schema' : 'error');
      timer.current = setTimeout(push, schema ? RETRY_MS * 3 : RETRY_MS);
    } finally {
      busy.current = false;
    }
  }, []);

  // ---- pull server data
  const pull = useCallback(async ({ initial = false, discard = false } = {}) => {
    const id = uidRef.current;
    if (!id || busy.current) return;
    // Never overwrite edits that haven't reached the server yet.
    if (!initial && !discard && baseline.current && diffCollections(baseline.current, stateRef.current)) return push();
    busy.current = true;
    if (initial) setStatus('loading');
    try {
      const remote = await fetchAll(id, emailRef.current, stateRef.current.categories);
      if (uidRef.current !== id) return;
      setMembers(remote.members);
      const localOwn = stateRef.current.trips.filter((t) => !isShared(t.id)).length;
      if (initial && localOwn > 0 && !remote.trips.some((t) => !isShared(t.id))) {
        // Brand-new account: upload what's on this device, then load everything.
        baseline.current = { trips: [], activities: [], todos: [] };
        busy.current = false;
        await push();
        return pullRef.current?.();
      }
      if (fingerprint(remote) !== fingerprint(stateRef.current)) {
        awaitingHydrate.current = true;
        dispatch({ type: 'hydrate', data: remote });
      } else {
        baseline.current = stateRef.current;
        setStatus('synced');
      }
      setError('');
    } catch (e) {
      const schema = isSchemaError(e);
      setError(schema ? SCHEMA_HELP : e.message || 'Could not reach the server');
      setStatus(schema ? 'schema' : 'error');
      timer.current = setTimeout(() => pull({ initial }), schema ? RETRY_MS * 3 : RETRY_MS);
    } finally {
      busy.current = false;
    }
  }, [dispatch, push]);
  pullRef.current = pull;

  // Signed in (or switched account): load from the server.
  useEffect(() => {
    baseline.current = null;
    if (!uid) return;
    // Data left on this device by a different account is never uploaded to yours.
    let owner = null;
    try {
      owner = localStorage.getItem(OWNER_KEY);
    } catch {
      /* ignore */
    }
    if (owner && owner !== uid) dispatch({ type: 'replaceAll', data: emptyState(), keepShared: false });
    pull({ initial: true }).then(() => {
      try {
        if (uidRef.current === uid) localStorage.setItem(OWNER_KEY, uid);
      } catch {
        /* ignore */
      }
    });
  }, [uid, pull, dispatch]);

  // Every state change: either record the hydrated state as the baseline, or schedule a push.
  useEffect(() => {
    if (awaitingHydrate.current) {
      awaitingHydrate.current = false;
      baseline.current = state;
      setStatus('synced');
      return;
    }
    if (!uid || !baseline.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(push, DEBOUNCE_MS);
  }, [state, uid, push]);

  // Refresh when you come back to the tab or the connection returns.
  useEffect(() => {
    if (!uid) return;
    const onFocus = () => document.visibilityState === 'visible' && baseline.current && pull();
    const onOnline = () => push();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [uid, pull, push]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Shared trips: check for other people's changes every 20 seconds while the app is open.
  const sharing = state.trips.some((t) => isShared(t.id)) || members.length > 0;
  useEffect(() => {
    if (!uid || !sharing) return undefined;
    const t = setInterval(() => document.visibilityState === 'visible' && baseline.current && pull(), 20000);
    return () => clearInterval(t);
  }, [uid, sharing, pull]);

  // ---- sharing
  const SHARE_SCHEMA = 'Sharing needs a quick database update: open supabase/schema.sql, paste it into Supabase → SQL Editor and click Run.';
  const membersOf = useCallback((trip) => (trip ? members.filter((m) => m.tripId === rawId(trip.id)) : []), [members]);
  const refreshMembers = useCallback(async () => {
    const { data, error: e } = await supabase.from('trip_members').select('*').eq('owner_id', uidRef.current);
    if (!e) setMembers((data || []).map((m) => ({ tripId: m.trip_id, email: m.email, role: m.role })));
  }, []);
  const failed = (e) => {
    if (isSchemaError(e) || membersTableMissing) return new Error(SHARE_SCHEMA);
    if (/23503|foreign key/i.test(`${e?.code} ${e?.message}`)) return new Error('This trip hasn’t finished saving to your account yet. Try again in a moment.');
    return new Error(e?.message || 'Could not reach the server');
  };
  // Invite someone (or change their access): role is 'viewer' or 'editor'.
  const shareTrip = useCallback(async (trip, email, role) => {
    await push(); // make sure the trip itself is saved first
    const { error: e } = await supabase
      .from('trip_members')
      .upsert({ owner_id: uidRef.current, trip_id: rawId(trip.id), email: email.trim().toLowerCase(), role, owner_email: emailRef.current, owner_name: nameRef.current }, { onConflict: 'owner_id,trip_id,email' });
    if (e) throw failed(e);
    await refreshMembers();
  }, [push, refreshMembers]);
  const removeMember = useCallback(async (trip, email) => {
    const { error: e } = await supabase.from('trip_members').delete().eq('owner_id', uidRef.current).eq('trip_id', rawId(trip.id)).eq('email', email);
    if (e) throw failed(e);
    await refreshMembers();
  }, [refreshMembers]);
  // Stop seeing a trip someone shared with you.
  const leaveTrip = useCallback(async (trip) => {
    const { error: e } = await supabase.from('trip_members').delete().eq('owner_id', ownerOf(trip.id)).eq('trip_id', rawId(trip.id)).eq('email', emailRef.current);
    if (e) throw failed(e);
    dispatch({ type: 'forgetTrip', id: trip.id });
    setTimeout(() => pullRef.current?.({ discard: true }), 0);
  }, [dispatch]);

  const here = () => window.location.origin + window.location.pathname;

  const signIn = useCallback(async (email, password) => {
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    if (e) throw e;
  }, []);

  // Returns { needsConfirmation: true } when Supabase's "Confirm email" setting is on.
  const signUp = useCallback(async (email, password) => {
    const { data, error: e } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: here() } });
    if (e) throw e;
    // When "Confirm email" is on, Supabase answers a sign-up for an email that already has an
    // account with an empty user and sends nothing (so strangers can't tell who's registered).
    if (!data.session && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('User already registered');
    }
    return { needsConfirmation: !data.session };
  }, []);

  const resendConfirmation = useCallback(async (email) => {
    const { error: e } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: here() } });
    if (e) throw e;
  }, []);

  const resetPassword = useCallback(async (email) => {
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: here() });
    if (e) throw e;
  }, []);

  const updatePassword = useCallback(async (password) => {
    const { error: e } = await supabase.auth.updateUser({ password });
    if (e) throw e;
    setRecovery(false);
  }, []);

  // ---- profile & security
  // Your name, shown in the app and to the people you share trips with.
  const updateName = useCallback(async (name) => {
    const clean = name.trim().slice(0, 60);
    const { data, error: e } = await supabase.auth.updateUser({ data: { display_name: clean } });
    if (e) throw e;
    if (data?.user) setSession((s) => (s ? { ...s, user: data.user } : s));
    // Trips you've shared show the new name too (ignored if the database is older).
    await supabase.from('trip_members').update({ owner_name: clean }).eq('owner_id', uidRef.current);
  }, []);

  // Checks the current password first, so an unattended open laptop can't be used to take over the account.
  const checkPassword = async (password) => {
    const { error: e } = await supabase.auth.signInWithPassword({ email: emailRef.current, password });
    if (e) throw new Error(/invalid login/i.test(e.message) ? 'That’s not your current password.' : e.message);
  };
  const changePassword = useCallback(async (current, next) => {
    await checkPassword(current);
    const { error: e } = await supabase.auth.updateUser({ password: next });
    if (e) throw new Error(/different from the old/i.test(e.message) ? 'Choose a password different from your current one.' : e.message);
  }, []);

  // Permanently deletes your account and everything you own (database function delete_my_account).
  const deleteAccount = useCallback(async (password) => {
    await checkPassword(password);
    const { error: e } = await supabase.rpc('delete_my_account');
    if (e) {
      if (isSchemaError(e)) throw new Error('Deleting accounts needs a quick database update: open supabase/schema.sql, paste it into Supabase → SQL Editor and click Run.');
      throw new Error(e.message || 'Could not reach the server');
    }
    baseline.current = null;
    clearTimeout(timer.current);
    try {
      localStorage.removeItem(OWNER_KEY);
    } catch {
      /* ignore */
    }
    dispatch({ type: 'replaceAll', data: emptyState(), keepShared: false });
    setMembers([]);
    setDeleted(true);
    await supabase.auth.signOut().catch(() => {});
  }, [dispatch]);

  const signOut = useCallback(async () => {
    baseline.current = null;
    clearTimeout(timer.current);
    await supabase.auth.signOut();
    // Your trips stay in your account; clear this device's copy.
    dispatch({ type: 'replaceAll', data: emptyState(), keepShared: false });
  }, [dispatch]);

  const pending = status === 'error' || status === 'syncing' || status === 'schema';
  return {
    enabled,
    ready,
    recovery,
    status,
    error,
    user: session?.user || null,
    signIn,
    signUp,
    resetPassword,
    resendConfirmation,
    updatePassword,
    signOut,
    pending,
    retry: push,
    deleted,
    displayName: displayName(session?.user),
    updateName,
    changePassword,
    deleteAccount,
    members,
    membersOf,
    shareTrip,
    removeMember,
    leaveTrip,
  };
}
