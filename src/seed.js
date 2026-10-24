// Starting data: the Chicago trip from the original planner, with repeated
// hourly rows merged into single blocks. Other trips start empty.
let n = 0;
const id = (p) => `${p}_${(++n).toString(36)}`;

const a = (date, start, end, title, category, extra = {}) => ({
  id: id('act'),
  tripId: 'chicago',
  date,
  start,
  end,
  title,
  category,
  location: '',
  notes: '',
  ...extra,
});

export function seedState() {
  n = 0;
  const trips = [
    { id: 'chicago', name: 'Chicago Trip', destination: 'Chicago, IL', start: '2026-10-14', end: '2026-10-19' },
    ...['East Asia Trip', 'Europe Trip', 'Italy Trip', 'Mexico City Trip', 'NJ, NY, Boston Trip', 'Portland Trip', 'Southeast Asia', 'Texas Trip'].map(
      (name) => ({ id: id('trip'), name, destination: '', start: '', end: '' })
    ),
  ];

  const activities = [
    a('2026-10-14', '16:15', '19:38', 'SNA → DEN', 'flight', { notes: 'Times are local to each airport.' }),
    a('2026-10-14', '20:29', '23:59', 'DEN → ORD', 'flight', { notes: '51 min layover in Denver.' }),

    a('2026-10-15', '09:00', '09:45', 'Hero Coffee and Bagel Bar', 'coffee'),
    a('2026-10-15', '10:00', '14:00', 'Work @ Happy Monday Coffee', 'work'),
    a('2026-10-15', '15:00', '19:00', 'Work @ Overflow Coffee', 'work'),
    a('2026-10-15', '20:00', '21:30', 'Adler Planetarium', 'sight'),

    a('2026-10-16', '10:00', '10:45', 'Goddess and the Baker', 'food'),
    a('2026-10-16', '11:00', '11:45', 'Millennium Park & Cloud Gate', 'sight'),
    a('2026-10-16', '12:00', '12:45', 'Maggie Daley Park', 'sight'),
    a('2026-10-16', '13:00', '14:30', 'The Art Institute of Chicago', 'sight'),
    a('2026-10-16', '15:00', '15:45', "Fontano's Subs & Pizzeria", 'food'),
    a('2026-10-16', '16:00', '16:45', 'Chicago Riverwalk', 'sight'),
    a('2026-10-16', '17:00', '17:45', 'Architecture Tour from Downtown', 'sight'),
    a('2026-10-16', '18:00', '18:45', 'Harry Potter Shop', 'sight'),
    a('2026-10-16', '18:00', '19:00', 'Chicago 360 Observation Deck', 'sight'),
    a('2026-10-16', '19:00', '20:00', 'Magnificent Mile', 'sight'),
    a('2026-10-16', '19:00', '19:45', 'Starbucks Reserve Roastery', 'coffee'),
    a('2026-10-16', '20:00', '21:00', 'Navy Pier', 'sight'),
    a('2026-10-16', '21:00', '22:30', 'Bar / Dinner', 'food'),

    a('2026-10-17', '09:00', '09:30', 'Holiday Inn & Suites Chicago', 'stay'),
    a('2026-10-17', '10:00', '10:45', 'Chicago Waffles – South Loop', 'food'),
    a('2026-10-17', '11:00', '13:30', 'Field Museum', 'sight'),
    a('2026-10-17', '14:00', '14:45', 'Pokemon Fossil Museum', 'sight'),
    a('2026-10-17', '15:00', '15:45', 'Lunch', 'food'),
    a('2026-10-17', '18:00', '19:30', "Giordano's", 'food'),

    a('2026-10-18', '11:00', '12:30', 'Willis Tower – Skydeck', 'sight'),
    a('2026-10-18', '13:00', '13:45', '88 Marketplace', 'food', { notes: 'Chinese supermarket' }),
    a('2026-10-18', '14:00', '14:45', 'Chinatown Square Plaza', 'sight'),
    a('2026-10-18', '15:00', '15:45', 'HingKee – soup dumplings', 'food'),
    a('2026-10-18', '16:00', '16:30', 'Hotel check-in', 'stay'),
    a('2026-10-18', '17:00', '18:30', 'Shedd Aquarium', 'sight'),
    a('2026-10-18', '19:00', '20:30', 'Dinner', 'food'),

    a('2026-10-19', '10:00', '14:00', 'Work @ Starbucks Reserve', 'work'),
  ];

  return { version: 1, currentTripId: 'chicago', trips, activities, todos: [], stays: [], places: [] };
}
