// Works out which city/country each day of a trip is in, from the trip's
// "places" (city + date range). A travel day can belong to two places:
// the one you leave (its end date) and the one you arrive in (its start date).

import { daysBetween } from './time.js';

// Each city, and each country, gets its own color, in order of first visit.
// Colors are CSS variables (--city-0 … --city-7) so they follow the light/dark theme.
export const PALETTE = Array.from({ length: 8 }, (_, i) => ({
  color: `var(--city-${i})`,
  tint: `var(--city-${i}-bg)`,
  soft: `var(--city-${i}-soft)`,
  line: `var(--city-${i}-line)`,
}));
// Countries use a different color order than cities, so a country band
// doesn't look like it belongs to one city.
const COUNTRY_ORDER = [0, 2, 3, 4, 5, 6, 7, 1];
const NEUTRAL = { color: 'var(--muted)', tint: 'var(--seg-bg)', soft: 'var(--surface-2)', line: 'var(--line)' };

export const cityCode = (p) => (p.code || p.city.replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 3)).toUpperCase();
export const countryCode = (p) => (p.countryCode || p.country.replace(/[^A-Za-z]/g, '').slice(0, 2)).toUpperCase();

export function dayPlaces(dates, places, trip) {
  const sorted = [...places].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const cityColor = new Map();
  const countryColor = new Map();
  sorted.forEach((p) => {
    const ck = `${p.city}|${p.country}`.toLowerCase();
    if (!cityColor.has(ck)) cityColor.set(ck, PALETTE[cityColor.size % PALETTE.length]);
    const nk = (p.country || p.city).toLowerCase();
    if (!countryColor.has(nk)) countryColor.set(nk, PALETTE[COUNTRY_ORDER[countryColor.size % COUNTRY_ORDER.length]]);
  });
  const deco = (p) => ({ ...p, cc: countryCode(p), short: cityCode(p), ...cityColor.get(`${p.city}|${p.country}`.toLowerCase()), country$: countryColor.get((p.country || p.city).toLowerCase()) });

  // Fallback when no cities are set: the trip's destination, in grey.
  const fallback = !places.length && trip?.destination
    ? { city: trip.destination.split(',')[0].trim(), country: trip.destination.split(',').slice(1).join(',').trim(), implied: true }
    : null;

  const out = {};
  dates.forEach((d) => {
    const here = sorted.filter((p) => p.start <= d && d <= p.end).map(deco);
    if (!here.length) {
      out[d] = fallback ? { from: null, to: { ...fallback, cc: '', short: cityCode(fallback), ...NEUTRAL, country$: NEUTRAL }, travel: false, implied: true } : null;
      return;
    }
    // Leaving one place and arriving in another on the same day.
    const leaving = here.find((p) => p.end === d && p.start < d);
    const arriving = here.find((p) => p.start === d && p !== leaving);
    const travel = !!(leaving && arriving);
    const main = travel ? arriving : here[here.length - 1];
    out[d] = { from: travel ? leaving : null, to: main, travel };
  });
  return out;
}

// Consecutive days in the same city, for the "Country, City" band.
// A travel day belongs to the city you arrive in.
export function countrySpans(dates, map) {
  const spans = [];
  dates.forEach((d, i) => {
    const info = map[d];
    const key = info && !info.implied ? `${info.to.country}|${info.to.city}`.toLowerCase() : null;
    const last = spans[spans.length - 1];
    if (last && last.key === key) last.span += 1;
    else spans.push({ key, start: i, span: 1, info });
  });
  return spans.map((s) => ({
    ...s,
    label: s.info && !s.info.implied ? [s.info.to.country, s.info.to.city].filter(Boolean).join(', ') : '',
    colors: s.info && !s.info.implied ? s.info.to : null,
  }));
}

// "Day 2 of 3 in Kyoto · Seoul tomorrow"
export function placeSummary(date, map, dates) {
  const info = map[date];
  if (!info) return null;
  if (info.implied) return { title: [info.to.city, info.to.country].filter(Boolean).join(', '), sub: 'Set the cities for this trip to see where each day is', info };
  if (info.travel) return { title: `${info.from.city} → ${info.to.city}`, sub: `Travel day · ${[info.to.city, info.to.country].filter(Boolean).join(', ')} tonight`, info };
  const p = info.to;
  const total = daysBetween(p.start, p.end) + 1;
  const n = daysBetween(p.start, date) + 1;
  const i = dates.indexOf(date);
  const next = map[dates[i + 1]];
  let tail = '';
  if (next && !next.implied && next.to.city !== p.city) tail = ` · ${next.to.city} tomorrow`;
  else if (next?.travel) tail = ` · ${next.to.city} tomorrow`;
  return { title: [p.city, p.country].filter(Boolean).join(', '), sub: `Day ${n} of ${total} in ${p.city}${tail}`, info };
}

// Saving a city takes over its days from any other city in the trip.
// Sharing a single boundary day is fine — that's a travel day ("Chicago → New York").
// Returns { keep: updated other places, removed: [...], changed: [...] }.
export function resolveOverlaps(place, others) {
  const keep = [];
  const removed = [];
  const changed = [];
  const extra = [];
  for (const o of others) {
    if (o.id === place.id || o.tripId !== place.tripId || o.end <= place.start || o.start >= place.end) {
      // No overlap, or only touching on a travel day.
      if (o.id !== place.id) keep.push(o);
      continue;
    }
    const startsBefore = o.start < place.start;
    const endsAfter = o.end > place.end;
    if (!startsBefore && !endsAfter) {
      removed.push(o); // fully covered by the new city
    } else if (startsBefore && endsAfter) {
      // New city sits in the middle: split the old one around it.
      const a = { ...o, end: place.start };
      const b = { ...o, id: `${o.id}_b${Date.now().toString(36)}`, start: place.end };
      keep.push(a);
      extra.push(b);
      changed.push(o);
    } else if (startsBefore) {
      keep.push({ ...o, end: place.start });
      changed.push(o);
    } else {
      keep.push({ ...o, start: place.end });
      changed.push(o);
    }
  }
  return { keep: [...keep, ...extra], removed, changed };
}

// Options for the "Country, City" filter: one per city, with the days spent there.
export function cityFilterOptions(dates, map) {
  const byKey = new Map();
  dates.forEach((d) => {
    const info = map[d];
    if (!info || info.implied) return;
    [info.from, info.to].filter(Boolean).forEach((p) => {
      const key = `${p.country}|${p.city}`.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, { key, label: [p.country, p.city].filter(Boolean).join(', '), color: p.color, tint: p.tint, dates: [] });
      const o = byKey.get(key);
      if (!o.dates.includes(d)) o.dates.push(d);
    });
  });
  return [...byKey.values()];
}
