// Activity types. Each user has their own list (name, symbol, color), stored with
// their trips and synced. These seven are the starting set, and "Reset to defaults"
// brings them back.
//
// Each type pairs a color with a symbol so items are never told apart by color alone.
// Colors are names from a fixed palette; each name has a light and a dark value in
// styles.css (--sw-<name> / --sw-<name>-bg), so every type follows the theme.

export const DEFAULT_CATEGORIES = [
  { id: 'sight', label: 'Sight', icon: 'landmark', color: 'blue' },
  { id: 'food', label: 'Food', icon: 'utensils', color: 'orange' },
  { id: 'coffee', label: 'Coffee', icon: 'coffee', color: 'brown' },
  { id: 'work', label: 'Work', icon: 'laptop', color: 'slate' },
  { id: 'flight', label: 'Flight', icon: 'plane', color: 'steel' },
  { id: 'stay', label: 'Stay', icon: 'bed', color: 'violet' },
  { id: 'other', label: 'Other', icon: 'pin', color: 'gray' },
].map((c, i) => ({ ...c, position: i }));

export const SWATCHES = [
  ['blue', 'Blue'], ['sky', 'Sky'], ['indigo', 'Indigo'], ['violet', 'Violet'], ['pink', 'Pink'], ['red', 'Red'], ['orange', 'Orange'],
  ['amber', 'Amber'], ['brown', 'Brown'], ['green', 'Green'], ['teal', 'Teal'], ['steel', 'Steel'], ['slate', 'Slate'], ['gray', 'Gray'],
].map(([key, label]) => ({ key, label }));

export const TYPE_ICONS = [
  'landmark', 'utensils', 'coffee', 'wine', 'laptop', 'plane', 'train', 'car', 'ship', 'bed',
  'camera', 'ticket', 'music', 'bag', 'tree', 'beach', 'dumbbell', 'book', 'people', 'heart', 'star', 'pin',
];

const SWATCH_KEYS = new Set(SWATCHES.map((s) => s.key));
const decorate = (c) => {
  const sw = SWATCH_KEYS.has(c.color) ? c.color : 'gray';
  return { ...c, swatch: sw, color: `var(--sw-${sw})`, tint: `var(--sw-${sw}-bg)` };
};
const FALLBACK = { id: '', label: 'Other', icon: 'pin', color: 'gray' };

// The app sets the signed-in user's list on every render (see App.jsx), so the
// many components that draw activities can look types up without extra props.
let raw = DEFAULT_CATEGORIES;
let decorated = raw.map(decorate);
let byId = new Map(decorated.map((c) => [c.id, c]));
// Types of people who shared a trip with you: used for their custom types you don't have.
let sharedRaw = null;
let sharedById = new Map();

export function setUserCategories(list, shared) {
  const next = list && list.length ? list : DEFAULT_CATEGORIES;
  if (next !== raw) {
    raw = next;
    decorated = raw.map(decorate);
    byId = new Map(decorated.map((c) => [c.id, c]));
  }
  if (shared !== sharedRaw) {
    sharedRaw = shared;
    sharedById = new Map((shared || []).map((c) => [c.id, decorate(c)]));
  }
}

export function getCategories() {
  return decorated;
}

// A type for drawing: unknown ids (a deleted type) show as a grey "Other".
export function category(id) {
  return byId.get(id) || sharedById.get(id) || decorate({ ...FALLBACK, id: id || 'other' });
}

// The id if the user still has that type, else null (used by type guessing).
export function knownType(id) {
  return id && byId.has(id) ? id : null;
}

// Type for new activities: Sight if the user has it, else their first type.
export function defaultType() {
  return knownType('sight') || decorated[0]?.id || 'other';
}
