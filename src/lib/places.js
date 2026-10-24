// Place search with OpenStreetMap data through Photon (photon.komoot.io).
// Free and needs no API key. Fair use: we wait until typing pauses, keep at
// most one request in flight, and remember results.
// Data © OpenStreetMap contributors (ODbL) — credit is shown under the results.

import { categoryFromOsm, osmLabel } from './infer.js';

const API = 'https://photon.komoot.io/api/';
const cache = new Map();

function addressOf(p) {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const parts = [street, p.city || p.town || p.village || p.district, p.state, p.country];
  // Leave out the name itself and repeats.
  return [...new Set(parts.filter((x) => x && x !== p.name))].join(', ');
}

function toPlace(f) {
  const p = f.properties || {};
  const [lng, lat] = f.geometry?.coordinates || [];
  const name = p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || p.city || '';
  const address = addressOf(p);
  return {
    id: `${p.osm_type || ''}${p.osm_id || name}`,
    name,
    address: [name, address].filter(Boolean).join(', '),
    area: [p.city || p.town || p.village || p.district, p.country].filter(Boolean).join(', '),
    kind: osmLabel(p.osm_key, p.osm_value),
    category: categoryFromOsm(p.osm_key, p.osm_value),
    lat,
    lng,
  };
}

async function photon(params, signal) {
  const url = `${API}?${new URLSearchParams(params).toString()}`;
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const data = await res.json();
  cache.set(url, data);
  return data;
}

// Center of the trip's destination, so "Starbucks" finds the one in Chicago.
const BIAS_KEY = 'travel-planner:geo:';
export async function locate(destination, signal) {
  const q = (destination || '').trim();
  if (!q) return null;
  try {
    const hit = localStorage.getItem(BIAS_KEY + q.toLowerCase());
    if (hit) return JSON.parse(hit);
  } catch {
    /* ignore */
  }
  const data = await photon({ q, limit: '1', lang: 'en' }, signal);
  const c = data.features?.[0]?.geometry?.coordinates;
  if (!c) return null;
  const point = { lng: c[0], lat: c[1] };
  try {
    localStorage.setItem(BIAS_KEY + q.toLowerCase(), JSON.stringify(point));
  } catch {
    /* ignore */
  }
  return point;
}

export async function searchPlaces(query, near, signal) {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = { q, limit: '6', lang: 'en' };
  if (near) {
    params.lat = String(near.lat);
    params.lon = String(near.lng);
  }
  const data = await photon(params, signal);
  const seen = new Set();
  return (data.features || [])
    .map(toPlace)
    .filter((p) => p.name && !seen.has(p.address) && seen.add(p.address));
}

// Cities / towns only, for "where are you on these days".
export async function searchCities(query, signal) {
  const q = query.trim();
  if (q.length < 2) return [];
  const data = await photon({ q, limit: '6', lang: 'en', osm_tag: 'place' }, signal);
  const seen = new Set();
  return (data.features || [])
    .map((f) => {
      const p = f.properties || {};
      return {
        id: `${p.osm_type || ''}${p.osm_id || p.name}`,
        name: p.name || '',
        city: p.name || '',
        country: p.country || '',
        countryCode: (p.countrycode || '').toUpperCase(),
        area: [p.state, p.country].filter(Boolean).join(', '),
        kind: (p.osm_value || 'place').replace(/_/g, ' '),
        category: null,
      };
    })
    .filter((c) => c.city && !seen.has(`${c.city}|${c.area}`) && seen.add(`${c.city}|${c.area}`));
}
