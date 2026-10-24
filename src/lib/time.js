// Time and date helpers. Times are "HH:MM" (24h) strings, dates are "YYYY-MM-DD".

export function toMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function fromMin(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function parts(t) {
  const m = toMin(t);
  let h = Math.floor(m / 60) % 24;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return { clock: `${h}:${String(m % 60).padStart(2, '0')}`, ap };
}

export function fmtTime(t) {
  if (!t) return '';
  const p = parts(t);
  return `${p.clock} ${p.ap}`;
}

export function fmtRange(start, end) {
  if (!start) return 'Anytime';
  if (!end) return fmtTime(start);
  const a = parts(start);
  const b = parts(end);
  return a.ap === b.ap ? `${a.clock} – ${b.clock} ${b.ap}` : `${a.clock} ${a.ap} – ${b.clock} ${b.ap}`;
}

export function durationMin(start, end) {
  if (!start || !end) return null;
  let d = toMin(end) - toMin(start);
  if (d <= 0) d += 1440;
  return d;
}

export function fmtDuration(min) {
  if (min == null) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function addDays(iso, n) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

export function dateRange(start, end) {
  if (!start) return [];
  if (!end || end < start) return [start];
  const out = [];
  for (let d = start; d <= end && out.length < 60; d = addDays(d, 1)) out.push(d);
  return out;
}

export function fmtDate(iso, opts) {
  return parseDate(iso).toLocaleDateString('en-US', opts);
}

export const dow = (iso) => fmtDate(iso, { weekday: 'short' });
export const dowLong = (iso) => fmtDate(iso, { weekday: 'long' });
export const monthDay = (iso) => fmtDate(iso, { month: 'short', day: 'numeric' });
export const dayNum = (iso) => fmtDate(iso, { day: 'numeric' });

export function fmtTripDates(trip) {
  if (!trip.start) return 'No dates yet';
  const days = dateRange(trip.start, trip.end).length;
  const a = parseDate(trip.start);
  const b = parseDate(trip.end || trip.start);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const range = trip.end && trip.end !== trip.start
    ? `${monthDay(trip.start)} – ${sameMonth ? dayNum(trip.end) : monthDay(trip.end)}`
    : monthDay(trip.start);
  return `${range} · ${days} day${days === 1 ? '' : 's'}`;
}

export function tripCountdown(trip, today = todayISO()) {
  if (!trip.start) return '';
  const end = trip.end || trip.start;
  if (today > end) return 'Finished';
  if (today >= trip.start) return 'Happening now';
  const n = daysBetween(today, trip.start);
  return n === 1 ? 'Starts tomorrow' : `Starts in ${n} days`;
}
