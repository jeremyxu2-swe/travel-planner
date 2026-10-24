// What happens to a trip's plans when its dates change.
//
// changedPlans(oldTrip, newTrip, data) lists the activities, hotels and cities that
// sat on days the new dates no longer include, so the trip form can warn first.
// applyTripDates(state, oldTrip, newTrip, mode) then:
//   'fit'   — moves plans into the new dates (to the new first/last day, same times),
//             and trims hotels/cities to fit
//   'shift' — the whole trip moved by N days: moves every plan by N days too
//   null    — changes nothing (plans outside the dates show under Ideas)

import { addDays, daysBetween, fmtDate } from './time.js';

const within = (d, s, e) => !!(d && s && e && d >= s && d <= e);
const overlaps = (a1, a2, b1, b2) => !!(a1 && a2 && b1 && b2 && a1 <= b2 && b1 <= a2);
const clamp = (d, s, e) => (d < s ? s : d > e ? e : d);

// Days in the old range that the new range drops, as readable spans.
export function removedSpans(oldTrip, newTrip) {
  const { start: os, end: oe } = oldTrip;
  const { start: ns, end: ne } = newTrip;
  if (!os || !oe) return [];
  if (!ns || !ne || !overlaps(os, oe, ns, ne)) return [[os, oe]]; // no dates, or moved completely
  const out = [];
  if (ns > os) out.push([os, addDays(ns, -1)]);
  if (ne < oe) out.push([addDays(ne, 1), oe]);
  return out;
}

const dayText = (d) => fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' });
export const spanText = ([a, b]) => (a === b ? dayText(a) : `${dayText(a)} – ${dayText(b)}`);

// How many days the whole trip moved, when it kept its length (else 0).
export function tripShift(oldTrip, newTrip) {
  if (!oldTrip.start || !oldTrip.end || !newTrip.start || !newTrip.end) return 0;
  const a = daysBetween(oldTrip.start, newTrip.start);
  const b = daysBetween(oldTrip.end, newTrip.end);
  return a === b ? a : 0;
}

export function changedPlans(oldTrip, newTrip, { activities = [], stays = [], places = [] }) {
  const { start: os, end: oe } = oldTrip;
  const { start: ns, end: ne } = newTrip;
  const empty = { activities: [], stays: [], places: [], spans: [], shift: 0, any: false, canFit: false };
  if (!oldTrip.id || !os || !oe) return empty;
  const keepsAll = (s, e) => within(s, ns, ne) && within(e, ns, ne);
  const acts = activities
    .filter((a) => a.tripId === oldTrip.id && within(a.date, os, oe) && !within(a.date, ns, ne))
    .sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
  const st = stays.filter((s) => s.tripId === oldTrip.id && overlaps(s.checkIn, s.checkOut, os, oe) && !keepsAll(s.checkIn, s.checkOut));
  const pl = places.filter((p) => p.tripId === oldTrip.id && overlaps(p.start, p.end, os, oe) && !keepsAll(p.start, p.end));
  const any = acts.length + st.length + pl.length > 0;
  return {
    activities: acts,
    stays: st,
    places: pl,
    spans: removedSpans(oldTrip, newTrip),
    shift: tripShift(oldTrip, newTrip),
    any,
    canFit: !!(ns && ne),
  };
}

export function applyTripDates(state, oldTrip, newTrip, mode) {
  const { start: ns, end: ne } = newTrip;
  const id = oldTrip.id;
  if (!mode || !id || !ns || !ne) return state;
  const mine = (x) => x.tripId === id;

  if (mode === 'shift') {
    const n = tripShift(oldTrip, newTrip);
    if (!n) return state;
    const mv = (d) => (d ? addDays(d, n) : d);
    return {
      ...state,
      activities: state.activities.map((a) => (mine(a) && a.date ? { ...a, date: mv(a.date) } : a)),
      stays: (state.stays || []).map((s) => (mine(s) ? { ...s, checkIn: mv(s.checkIn), checkOut: mv(s.checkOut) } : s)),
      places: (state.places || []).map((p) => (mine(p) ? { ...p, start: mv(p.start), end: mv(p.end) } : p)),
    };
  }

  // 'fit': only plans that sat in the old dates move; ideas stay ideas.
  const { start: os, end: oe } = oldTrip;
  return {
    ...state,
    activities: state.activities.map((a) =>
      mine(a) && within(a.date, os, oe) && !within(a.date, ns, ne) ? { ...a, date: clamp(a.date, ns, ne) } : a
    ),
    stays: (state.stays || []).map((s) => {
      if (!mine(s) || (within(s.checkIn, ns, ne) && within(s.checkOut, ns, ne))) return s;
      const ci = clamp(s.checkIn, ns, ne);
      const co = clamp(s.checkOut, ns, ne);
      return ci < co ? { ...s, checkIn: ci, checkOut: co } : s; // nothing left inside: leave it be
    }),
    places: (state.places || []).map((p) => {
      if (!mine(p) || (within(p.start, ns, ne) && within(p.end, ns, ne))) return p;
      const s = clamp(p.start, ns, ne);
      const e = clamp(p.end, ns, ne);
      return overlaps(p.start, p.end, ns, ne) ? { ...p, start: s, end: e } : p;
    }),
  };
}
