// "Explore": find things to do near the day's city, using free OpenStreetMap data.
//  - Kinds of places ("popular spots", "restaurants", "tacos", "museums"…) are looked up
//    with the Overpass API: every matching place within a few km of the city center.
//    OpenStreetMap has no ratings, so "popular" is estimated: places with a Wikipedia /
//    Wikidata entry (i.e. well-known) come first, then ones with more details, then nearer ones.
//  - Anything else ("Willis Tower", "Lou Malnati's") is a name search through Photon.
// Both are free and need no API key. Results are cached, and a search only runs when
// typing pauses. Data © OpenStreetMap contributors (ODbL) — credited under the results.

import { categoryFromOsm, osmLabel } from './infer.js';
import { searchPlaces } from './places.js';

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const cache = new Map();

// Quick picks shown as chips. `q` is the Overpass filter (one or more statements),
// `r` the search radius in meters.
export const PRESETS = [
  {
    id: 'popular', label: 'Popular spots', icon: 'sparkle', r: 6000, popular: true,
    q: [
      '["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park)$"]',
      '["historic"~"^(monument|castle|memorial|fort|palace|ruins|building)$"]["wikidata"]',
      '["leisure"~"^(park|garden)$"]["wikidata"]',
      '["amenity"~"^(theatre|planetarium|marketplace)$"]["wikidata"]',
      '["man_made"~"^(tower|lighthouse|pier)$"]["wikidata"]',
    ],
  },
  { id: 'food', label: 'Restaurants', icon: 'utensils', r: 1800, q: ['["amenity"~"^(restaurant|food_court)$"]'] },
  { id: 'coffee', label: 'Coffee', icon: 'coffee', r: 1500, q: ['["amenity"="cafe"]', '["shop"="coffee"]'] },
  { id: 'museums', label: 'Museums', icon: 'landmark', r: 8000, q: ['["tourism"~"^(museum|gallery)$"]'] },
  { id: 'parks', label: 'Parks', icon: 'tree', r: 6000, q: ['["leisure"~"^(park|garden|nature_reserve)$"]'] },
  { id: 'nightlife', label: 'Bars & nightlife', icon: 'wine', r: 1800, q: ['["amenity"~"^(bar|pub|nightclub|biergarten)$"]'] },
  { id: 'shopping', label: 'Shopping', icon: 'bag', r: 5000, q: ['["shop"~"^(mall|department_store)$"]', '["amenity"="marketplace"]'] },
];
const preset = (id) => PRESETS.find((p) => p.id === id);

// Words that mean a kind of place rather than a name.
const KINDS = [
  ['popular', /\b(popular|things? to (do|see)|attractions?|sights?|sightseeing|landmarks?|must[\s-]?sees?|tourist|top spots?|what to see|famous|spots?)\b/i],
  ['museums', /\b(museums?|galler(y|ies)|art|exhibits?|history)\b/i],
  ['parks', /\b(parks?|gardens?|outdoors?|nature|green spaces?|hikes?|trails?)\b/i],
  ['coffee', /\b(coffee|caf[eé]s?|espresso|latte|tea ?houses?)\b/i],
  ['nightlife', /\b(bars?|pubs?|nightlife|drinks?|clubs?|cocktails?|beers?|breweries|brewery|wine bars?|night ?out)\b/i],
  ['shopping', /\b(shop(s|ping)?|malls?|markets?|stores?|boutiques?)\b/i],
  ['food', /\b(restaurants?|food|eat(s|ing)?|dinner|lunch|brunch|breakfast|places? to eat|cheap eats|dining)\b/i],
];
// Cuisine words → OpenStreetMap "cuisine" values.
const CUISINES = [
  [/\btacos?|mexican|burritos?|taqueri/i, 'mexican|tacos?|tex-mex'],
  [/\bsushi\b/i, 'sushi|japanese'],
  [/\bramen\b/i, 'ramen|japanese|noodle'],
  [/\bjapanese\b/i, 'japanese|sushi|ramen'],
  [/\bpizza\b/i, 'pizza'],
  [/\bitalian|pasta\b/i, 'italian|pizza'],
  [/\bthai\b/i, 'thai'],
  [/\bindian|curry\b/i, 'indian'],
  [/\bchinese|dim sum|dumplings?\b/i, 'chinese|dim_sum|dumpling'],
  [/\bkorean\b/i, 'korean'],
  [/\bvietnamese|pho|banh mi\b/i, 'vietnamese'],
  [/\bburgers?\b/i, 'burger'],
  [/\bbbq|barbecue\b/i, 'bbq|barbecue'],
  [/\bsteak(house)?s?\b/i, 'steak'],
  [/\bseafood|oysters?|fish\b/i, 'seafood|fish'],
  [/\bfrench\b/i, 'french'],
  [/\bgreek\b/i, 'greek'],
  [/\bmediterranean\b/i, 'mediterranean|greek|lebanese'],
  [/\bmiddle eastern|lebanese|falafel|shawarma\b/i, 'lebanese|middle_eastern|falafel|kebab|turkish'],
  [/\bvegan|vegetarian\b/i, 'vegan|vegetarian'],
  [/\bbreakfast|brunch\b/i, 'breakfast|brunch'],
  [/\bdesserts?|ice cream|gelato\b/i, 'ice_cream|dessert|gelato'],
  [/\bbakery|bakeries|pastr(y|ies)\b/i, 'bakery|pastry'],
  [/\bdeep dish\b/i, 'pizza'],
];

// What a typed search means: a kind of place (Overpass) or a name (Photon).
export function interpret(text) {
  const q = (text || '').trim();
  if (!q) return null;
  const cuisine = CUISINES.find(([re]) => re.test(q));
  if (cuisine) {
    const dessert = /ice_cream|bakery/.test(cuisine[1]);
    return {
      kind: 'food', label: q, r: 3000,
      q: dessert
        ? [`["cuisine"~"${cuisine[1]}",i]`, '["amenity"="ice_cream"]', '["shop"~"^(bakery|pastry)$"]']
        : [`["amenity"~"^(restaurant|fast_food|food_court|cafe)$"]["cuisine"~"${cuisine[1]}",i]`],
    };
  }
  const kind = KINDS.find(([, re]) => re.test(q));
  if (kind) return { ...preset(kind[0]), kind: kind[0], label: q };
  return { name: q };
}
export const presetQuery = (id) => ({ ...preset(id), kind: id });

const km = (a, b) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

const KIND_KEYS = ['tourism', 'amenity', 'leisure', 'historic', 'shop', 'man_made', 'natural'];
function fromOsm(el, center) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const key = KIND_KEYS.find((k) => t[k]);
  let kind = key ? osmLabel(key, t[key]) : '';
  if (kind === 'attraction') kind = t.historic ? osmLabel('historic', t.historic) : 'attraction';
  const cuisine = (t.cuisine || '').split(';')[0].replace(/_/g, ' ');
  if (cuisine && /restaurant|fast food|cafe|food court/.test(kind)) kind = `${kind} · ${cuisine}`;
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const city = t['addr:city'] || '';
  const addr = [street, city].filter(Boolean).join(', ');
  const dist = center && lat != null ? km(center, { lat, lng }) : null;
  const famous = !!(t.wikidata || t.wikipedia);
  return {
    id: `${el.type}${el.id}`,
    name: t['name:en'] || t.name,
    address: [t['name:en'] || t.name, addr].filter(Boolean).join(', '),
    street: addr,
    kind,
    category: key ? categoryFromOsm(key, t[key]) : null,
    lat,
    lng,
    dist,
    famous,
    website: t.website || t['contact:website'] || '',
    // Rough "how well-known / how useful" score — OpenStreetMap has no ratings.
    score:
      (t.wikidata ? 4 : 0) + (t.wikipedia ? 2 : 0) + (t.tourism === 'attraction' ? 1 : 0) + (t.tourism === 'museum' ? 0.8 : 0) +
      (t.website || t['contact:website'] ? 0.6 : 0) + (t.opening_hours ? 0.4 : 0) + (t.phone || t['contact:phone'] ? 0.2 : 0) +
      (t.cuisine ? 0.2 : 0) + (street ? 0.2 : 0),
  };
}

async function overpass(body, signal) {
  let last;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: body }), signal });
      if (res.ok) return await res.json();
      last = new Error(res.status === 429 ? 'The map service is busy — try again in a few seconds.' : `Search failed (${res.status})`);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      last = new Error('Couldn’t reach the map service. Check your connection and try again.');
    }
  }
  throw last;
}

// Places of a kind around `center` ({lat, lng}), best first.
export async function explore(query, center, signal) {
  if (!query) return [];
  if (query.name) {
    const hits = await searchPlaces(query.name, center, signal);
    return hits
      .map((p) => ({ ...p, street: p.address.replace(`${p.name}, `, ''), dist: center && p.lat != null ? km(center, p) : null, famous: false }))
      .filter((p) => p.dist == null || p.dist < 80);
  }
  if (!center) return [];
  const key = `${query.q.join('|')}@${center.lat.toFixed(3)},${center.lng.toFixed(3)}/${query.r}`;
  if (!cache.has(key)) {
    const around = `(around:${query.r},${center.lat},${center.lng})`;
    const body = `[out:json][timeout:20];(${query.q.map((f) => `nwr${f}["name"]${around};`).join('')});out center tags 300;`;
    cache.set(key, overpass(body, signal).catch((e) => { cache.delete(key); throw e; }));
  }
  const data = await cache.get(key);
  const seen = new Set();
  const radiusKm = query.r / 1000;
  return (data.elements || [])
    .map((el) => fromOsm(el, center))
    .filter((p) => p.name && p.lat != null && !seen.has(p.name.toLowerCase()) && seen.add(p.name.toLowerCase()))
    // Well-known first, nearer ones break ties (distance counts more for food, where nearby matters).
    .map((p) => ({ ...p, rank: p.score - (p.dist / radiusKm) * (query.popular ? 1.5 : 2.5) }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 25);
}

const MILES = typeof navigator !== 'undefined' && /^(en-(US|LR|MM)|my)\b/i.test(navigator.language || '');
export function fmtDist(d) {
  if (d == null) return '';
  if (MILES) {
    const mi = d * 0.621371;
    return mi < 0.1 ? 'nearby' : `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
  }
  return d < 1 ? `${Math.max(50, Math.round((d * 1000) / 50) * 50)} m` : `${d < 10 ? d.toFixed(1) : Math.round(d)} km`;
}
