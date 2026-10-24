// Guess an activity's type from its name, and from OpenStreetMap place tags.

// Checked in order: the first rule that matches wins
// ("Work @ Happy Monday Coffee" is Work, not Coffee).
const RULES = [
  ['flight', /\b(flight|fly|airport|airlines?|terminal|layover)\b|→|->/i],
  ['flight', /^[A-Z]{3}\s*(-|–|to)\s*[A-Z]{3}\b/], // airport codes like "SFO - CDG" (capitals only)
  ['stay', /\b(hotel|inn|hostel|motel|airbnb|resort|suites?|lodge|ryokan|check[\s-]?(in|out))\b/i],
  ['work', /^work\b|\bwork\s*@|\b(meeting|standup|stand-up|coworking|co-working|conference|office)\b/i],
  ['coffee', /\b(coffee|caf[eé]|espresso|starbucks|roaster[sy]?|roastery|tea\s?house|boba|bubble tea|matcha)\b/i],
  ['food', /\b(lunch|dinner|breakfast|brunch|supper|snack|restaurant|bistro|brasserie|trattoria|osteria|pizz(a|eria)|sushi|ramen|udon|pho|taco|taqueria|burger|bbq|barbecue|steak(house)?|diner|deli|bakery|bagels?|boulangerie|patisserie|dumplings?|noodles?|dim sum|food|market|subs|sandwich|waffles?|pancakes?|creperie|ice cream|gelato|dessert|bar|pub|brewery|winery|tapas|izakaya|hawker|kitchen|grill|eatery|cantina)\b/i],
  ['sight', /\b(museum|musée|museo|gallery|galerie|park|garden|gardens|tower|cathedral|church|basilica|chapel|temple|shrine|mosque|palace|castle|fort|bridge|aquarium|zoo|tour|observatory|planetarium|observation|deck|monument|memorial|statue|square|plaza|piazza|beach|pier|harbor|harbour|viewpoint|lookout|waterfall|lake|mountain|trail|hike|old town|riverwalk|mile|landmark|ruins|stadium|theater|theatre|opera|show|concert|festival|exhibit(ion)?|cruise)\b/i],
];

export function inferCategory(name) {
  const text = (name || '').trim();
  if (text.length < 3) return null;
  for (const [cat, re] of RULES) if (re.test(text)) return cat;
  return null;
}

// OpenStreetMap tags → our types. See https://wiki.openstreetmap.org/wiki/Map_features
const OSM = {
  tourism: { hotel: 'stay', motel: 'stay', hostel: 'stay', guest_house: 'stay', apartment: 'stay', chalet: 'stay', camp_site: 'stay', alpine_hut: 'stay', _: 'sight' },
  amenity: {
    restaurant: 'food', fast_food: 'food', food_court: 'food', pub: 'food', bar: 'food', biergarten: 'food', ice_cream: 'food',
    cafe: 'coffee',
    theatre: 'sight', arts_centre: 'sight', cinema: 'sight', place_of_worship: 'sight', planetarium: 'sight', fountain: 'sight', marketplace: 'food',
    coworking_space: 'work', library: 'work',
  },
  shop: { coffee: 'coffee', tea: 'coffee', bakery: 'food', pastry: 'food', confectionery: 'food', deli: 'food', chocolate: 'food', wine: 'food' },
  historic: { _: 'sight' },
  leisure: { park: 'sight', garden: 'sight', nature_reserve: 'sight', stadium: 'sight', beach_resort: 'sight', water_park: 'sight', marina: 'sight' },
  natural: { peak: 'sight', beach: 'sight', waterfall: 'sight', volcano: 'sight', bay: 'sight', cave_entrance: 'sight' },
  aeroway: { aerodrome: 'flight', terminal: 'flight', gate: 'flight' },
  man_made: { tower: 'sight', lighthouse: 'sight', bridge: 'sight', pier: 'sight' },
  building: { cathedral: 'sight', church: 'sight', temple: 'sight', mosque: 'sight', hotel: 'stay' },
  office: { coworking: 'work', _: 'work' },
};

export function categoryFromOsm(key, value) {
  const group = OSM[key];
  if (!group) return null;
  return group[value] || group._ || null;
}

export function osmLabel(key, value) {
  if (!value || value === 'yes') return key ? key.replace(/_/g, ' ') : '';
  return value.replace(/_/g, ' ');
}
