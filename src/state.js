import { useEffect, useReducer } from 'react';
import { seedState } from './seed.js';
import { supabase } from './lib/supabase.js';
import { resolveOverlaps } from './lib/dayplaces.js';
import { DEFAULT_CATEGORIES } from './categories.js';
import { applyTripDates } from './lib/tripdates.js';
import { inTrip, isShared, ownerOf, sharedId } from './lib/owner.js';

const KEY = 'travel-planner:v1';

export const newId = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function emptyState() {
  return { version: 1, currentTripId: null, trips: [], activities: [], todos: [], stays: [], places: [], categories: DEFAULT_CATEGORIES };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.trips) && Array.isArray(data.activities)) {
        return withTypes({ todos: [], stays: [], places: [], ...data });
      }
    }
  } catch {
    /* storage unavailable or corrupt: fall back to seed */
  }
  // With accounts turned on, a fresh browser starts empty and fills from your account.
  return supabase ? emptyState() : withTypes(seedState());
}

// Older saves (and new accounts) have no activity types yet: use the defaults.
function withTypes(data) {
  return Array.isArray(data.categories) && data.categories.length ? data : { ...data, categories: DEFAULT_CATEGORIES };
}

// Keep each type's position in step with its place in the list (only replacing
// the objects that change, so sync sends real edits only).
function renumber(list) {
  return list.map((c, i) => (c.position === i ? c : { ...c, position: i }));
}

function baseReducer(state, action) {
  switch (action.type) {
    case 'selectTrip':
      return { ...state, currentTripId: action.id };

    case 'saveTrip': {
      const old = state.trips.find((t) => t.id === action.trip.id);
      const trips = old
        ? state.trips.map((t) => (t.id === action.trip.id ? action.trip : t))
        : [...state.trips, action.trip];
      // New dates can carry the trip's plans along: 'fit' (into the new dates) or 'shift'.
      const moved = old && action.plans ? applyTripDates(state, old, action.trip, action.plans) : state;
      return { ...moved, trips, currentTripId: action.trip.id };
    }

    // Trip notes: changes only the notes (and keeps the selected trip as it is).
    case 'setTripNotes':
      return { ...state, trips: state.trips.map((t) => (t.id === action.id ? { ...t, notes: action.notes } : t)) };

    case 'deleteTrip': {
      const trips = state.trips.filter((t) => t.id !== action.id);
      return {
        ...state,
        trips,
        activities: state.activities.filter((a) => a.tripId !== action.id),
        todos: state.todos.filter((t) => t.tripId !== action.id),
        stays: (state.stays || []).filter((s) => s.tripId !== action.id),
        places: (state.places || []).filter((s) => s.tripId !== action.id),
        currentTripId: state.currentTripId === action.id ? trips[0]?.id ?? null : state.currentTripId,
      };
    }

    // A shared trip you left: remove it from this device only (never from the owner's account).
    case 'forgetTrip': {
      const gone = (x) => x.tripId === action.id;
      const trips = state.trips.filter((t) => t.id !== action.id);
      return {
        ...state,
        trips,
        activities: state.activities.filter((a) => !gone(a)),
        todos: state.todos.filter((t) => !gone(t)),
        stays: (state.stays || []).filter((s) => !gone(s)),
        places: (state.places || []).filter((p) => !gone(p)),
        currentTripId: state.currentTripId === action.id ? trips[0]?.id ?? null : state.currentTripId,
      };
    }

    case 'saveActivity': {
      const exists = state.activities.some((a) => a.id === action.activity.id);
      return {
        ...state,
        activities: exists
          ? state.activities.map((a) => (a.id === action.activity.id ? action.activity : a))
          : [...state.activities, action.activity],
      };
    }

    case 'moveActivity':
      return {
        ...state,
        activities: state.activities.map((a) => (a.id === action.id ? { ...a, date: action.date } : a)),
      };

    case 'deleteActivity':
      return { ...state, activities: state.activities.filter((a) => a.id !== action.id) };

    case 'saveStay': {
      const stays = state.stays || [];
      const exists = stays.some((s) => s.id === action.stay.id);
      return { ...state, stays: exists ? stays.map((s) => (s.id === action.stay.id ? action.stay : s)) : [...stays, action.stay] };
    }

    case 'deleteStay':
      return { ...state, stays: (state.stays || []).filter((s) => s.id !== action.id) };

    case 'savePlace': {
      // Other cities in the trip give up the days this one now covers.
      const places = state.places || [];
      const { keep } = resolveOverlaps(action.place, places);
      const unchanged = new Map(places.map((p) => [p.id, p]));
      // Reuse the same objects when nothing changed so sync only sends real edits.
      const next = keep.map((p) => {
        const old = unchanged.get(p.id);
        return old && old.start === p.start && old.end === p.end ? old : p;
      });
      return { ...state, places: [...next, action.place] };
    }

    case 'deletePlace':
      return { ...state, places: (state.places || []).filter((p) => p.id !== action.id) };

    case 'addTodo':
      return { ...state, todos: [...state.todos, { id: newId('todo'), tripId: action.tripId, text: action.text, done: false }] };

    case 'toggleTodo':
      return { ...state, todos: state.todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)) };

    case 'deleteTodo':
      return { ...state, todos: state.todos.filter((t) => t.id !== action.id) };

    // ---- activity types
    case 'saveCategory': {
      const list = state.categories || DEFAULT_CATEGORIES;
      const exists = list.some((c) => c.id === action.category.id);
      return {
        ...state,
        categories: renumber(exists ? list.map((c) => (c.id === action.category.id ? action.category : c)) : [...list, action.category]),
      };
    }

    // Deleting a type moves its activities to another type (action.moveTo).
    case 'deleteCategory': {
      const list = state.categories || DEFAULT_CATEGORIES;
      if (list.length <= 1) return state;
      return {
        ...state,
        categories: renumber(list.filter((c) => c.id !== action.id)),
        // (Trips shared with you use their owner's types, so they're left alone.)
        activities: action.moveTo
          ? state.activities.map((a) => (a.category === action.id && !isShared(a.id) ? { ...a, category: action.moveTo } : a))
          : state.activities,
      };
    }

    // Drag-and-drop: move a type from one position to another.
    case 'moveCategoryTo': {
      const list = [...(state.categories || DEFAULT_CATEGORIES)];
      const { from, to } = action;
      if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return state;
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      return { ...state, categories: renumber(list) };
    }

    case 'moveCategory': {
      const list = [...(state.categories || DEFAULT_CATEGORIES)];
      const i = list.findIndex((c) => c.id === action.id);
      const j = i + action.by;
      if (i < 0 || j < 0 || j >= list.length) return state;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...state, categories: renumber(list) };
    }

    // Back to the seven defaults. Activities of removed custom types become "Other".
    case 'resetCategories': {
      const ids = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
      return {
        ...state,
        categories: DEFAULT_CATEGORIES,
        activities: state.activities.map((a) => (ids.has(a.category) || isShared(a.id) ? a : { ...a, category: 'other' })),
      };
    }

    // Importing a backup replaces your own trips; trips shared with you stay as they are.
    case 'replaceAll': {
      const data = withTypes({ todos: [], stays: [], places: [], ...action.data });
      const keepShared = (k) => [...(state[k] || []).filter((x) => isShared(x.id)), ...(data[k] || []).filter((x) => !isShared(x.id))];
      if (action.keepShared === false) return data;
      return { ...data, trips: keepShared('trips'), activities: keepShared('activities'), todos: keepShared('todos'), stays: keepShared('stays'), places: keepShared('places') };
    }

    // Data loaded from the cloud. Keeps the selected trip if it still exists.
    case 'hydrate': {
      const { trips, activities, todos, stays = [], places = [], categories, sharedTypes = [] } = action.data;
      const keep = trips.some((t) => t.id === state.currentTripId);
      return {
        ...state,
        trips,
        activities,
        todos,
        stays,
        places,
        categories: categories && categories.length ? categories : state.categories || DEFAULT_CATEGORIES,
        sharedTypes,
        currentTripId: keep ? state.currentTripId : trips[0]?.id ?? null,
      };
    }

    default:
      return state;
  }
}

// Which trip an action changes (so trips you can only view stay unchanged).
function tripOfAction(state, a) {
  const find = (list, id) => (state[list] || []).find((x) => x.id === id)?.tripId;
  switch (a.type) {
    case 'saveTrip': return a.trip.id;
    case 'deleteTrip':
    case 'setTripNotes': return a.id;
    case 'saveActivity': return a.activity.tripId;
    case 'moveActivity':
    case 'deleteActivity': return find('activities', a.id);
    case 'saveStay': return a.stay.tripId;
    case 'deleteStay': return find('stays', a.id);
    case 'savePlace': return a.place.tripId;
    case 'deletePlace': return find('places', a.id);
    case 'addTodo': return a.tripId;
    case 'toggleTodo':
    case 'deleteTodo': return find('todos', a.id);
    default: return null;
  }
}

function reducer(state, action) {
  const tripId = tripOfAction(state, action);
  if (tripId && isShared(tripId)) {
    const trip = state.trips.find((t) => t.id === tripId);
    if (!trip || trip.role === 'viewer') return state; // view only
    if (action.type === 'deleteTrip') return state; // only the owner can delete a trip
    // New things in someone else's trip are stored in their account.
    if (action.type === 'saveActivity') action = { ...action, activity: inTrip(action.activity) };
    if (action.type === 'saveStay') action = { ...action, stay: inTrip(action.stay) };
    if (action.type === 'savePlace') action = { ...action, place: inTrip(action.place) };
    if (action.type === 'addTodo') {
      const next = baseReducer(state, action);
      const added = next.todos[next.todos.length - 1];
      return { ...next, todos: [...next.todos.slice(0, -1), { ...added, id: sharedId(ownerOf(tripId), added.id) }] };
    }
  }
  return baseReducer(state, action);
}

export function useStore() {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / private mode errors */
    }
  }, [state]);
  return [state, dispatch];
}

export function exportJSON(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `travel-planner-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function readImport(file) {
  const data = JSON.parse(await file.text());
  if (!data || !Array.isArray(data.trips) || !Array.isArray(data.activities)) {
    throw new Error('That file is not a Travel Planner export.');
  }
  return data;
}
