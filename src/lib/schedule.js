import { toMin, fromMin } from './time.js';

const DEFAULT_LENGTH = 60; // minutes assumed when an activity has no end time
const MIN_GAP = 30; // free time shorter than this is not shown

function span(a) {
  const s = toMin(a.start);
  let e = a.end ? toMin(a.end) : s + DEFAULT_LENGTH;
  if (e <= s) e += 1440;
  return [s, e];
}

export function sortActivities(items) {
  return [...items].sort((a, b) => {
    if (!a.start && !b.start) return (a.order ?? 0) - (b.order ?? 0);
    if (!a.start) return 1;
    if (!b.start) return -1;
    return toMin(a.start) - toMin(b.start) || a.title.localeCompare(b.title);
  });
}

// Splits a day's activities into timed and untimed lists and finds overlaps.
// Returns conflicts as Map<id, string[]> naming what each item overlaps with.
export function analyzeDay(items) {
  const sorted = sortActivities(items);
  const timed = sorted.filter((a) => a.start);
  const untimed = sorted.filter((a) => !a.start);
  const conflicts = new Map();
  const pairs = [];
  for (let i = 0; i < timed.length; i++) {
    const [si, ei] = span(timed[i]);
    for (let j = i + 1; j < timed.length; j++) {
      const [sj, ej] = span(timed[j]);
      if (sj >= ei) break;
      if (si < ej && sj < ei) {
        pairs.push([timed[i], timed[j]]);
        conflicts.set(timed[i].id, [...(conflicts.get(timed[i].id) || []), timed[j].title]);
        conflicts.set(timed[j].id, [...(conflicts.get(timed[j].id) || []), timed[i].title]);
      }
    }
  }
  return { timed, untimed, conflicts, pairs };
}

// Timeline rows for a day: stops, plus "free time" rows between them.
export function buildTimeline(timed) {
  const rows = [];
  let lastEnd = null;
  timed.forEach((a, i) => {
    const [s, e] = span(a);
    if (lastEnd != null && s - lastEnd >= MIN_GAP) {
      rows.push({ type: 'gap', key: `gap-${a.id}`, minutes: s - lastEnd, from: fromMin(lastEnd) });
    }
    rows.push({ type: 'stop', key: a.id, activity: a, n: i + 1 });
    lastEnd = lastEnd == null ? e : Math.max(lastEnd, e);
  });
  return rows;
}

export function placeQuery(activity, trip) {
  if (activity.location) return activity.location;
  return [activity.title, trip?.destination].filter(Boolean).join(', ');
}

export function mapsSearchUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// Google Maps directions through up to 10 stops (origin + 8 waypoints + destination).
export function mapsRouteUrl(queries) {
  const q = queries.filter(Boolean).slice(0, 10);
  if (q.length === 0) return null;
  if (q.length === 1) return mapsSearchUrl(q[0]);
  const params = new URLSearchParams({
    api: '1',
    origin: q[0],
    destination: q[q.length - 1],
    travelmode: 'walking',
  });
  if (q.length > 2) params.set('waypoints', q.slice(1, -1).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// Activities that should not be routed on a map (flights, untitled placeholders).
export function isRoutable(activity) {
  return activity.category !== 'flight';
}
