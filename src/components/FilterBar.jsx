import { getCategories } from '../categories.js';

export default function FilterBar({ counts, total, value, onChange }) {
  const present = getCategories().filter((c) => counts[c.id]);
  return (
    <div className="filters" role="group" aria-label="Filter by type">
      <button type="button" aria-pressed={value === 'all'} className={`chip${value === 'all' ? ' is-on' : ''}`} onClick={() => onChange('all')}>
        All <span className="chip-n">{total}</span>
      </button>
      {present.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={value === c.id}
          className={`chip${value === c.id ? ' is-on' : ''}`}
          onClick={() => onChange(value === c.id ? 'all' : c.id)}
        >
          <span className="chip-dot" style={{ background: c.color }} />
          {c.label} <span className="chip-n">{counts[c.id]}</span>
        </button>
      ))}
    </div>
  );
}
