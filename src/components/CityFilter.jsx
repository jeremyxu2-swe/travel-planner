// "All days · United States, Chicago · United States, New York" — narrows the
// calendar to the days spent in one city. Only shown when a trip has 2+ cities.
export default function CityFilter({ options, value, onChange }) {
  if (options.length < 2) return null;
  return (
    <div className="filters city-filter" role="group" aria-label="Filter by country and city">
      <button type="button" aria-pressed={!value} className={`chip${!value ? ' is-on' : ''}`} onClick={() => onChange(null)}>
        All cities
      </button>
      {options.map((c) => {
        const on = value === c.key;
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={on}
            className={`chip${on ? ' is-on' : ''}`}
            style={on ? { background: c.color, borderColor: c.color, color: 'var(--pin-ink)' } : undefined}
            onClick={() => onChange(on ? null : c.key)}
          >
            <span className="chip-dot" style={{ background: on ? 'var(--pin-ink)' : c.color }} />
            {c.label} <span className="chip-n">{c.dates.length} {c.dates.length === 1 ? 'day' : 'days'}</span>
          </button>
        );
      })}
    </div>
  );
}
