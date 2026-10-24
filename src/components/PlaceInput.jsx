import { useEffect, useId, useRef, useState } from 'react';
import { category, knownType } from '../categories.js';
import { locate, searchCities, searchPlaces } from '../lib/places.js';
import Icon from './Icon.jsx';

const WAIT_MS = 400; // pause after typing before searching

// Text field with OpenStreetMap place suggestions underneath.
// Typing anything is fine; picking a suggestion also fills in the address and type.
export default function PlaceInput({ id, value, onChange, onPick, near, placeholder, invalid, autoFocus, cities }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const typed = useRef(false); // only search after the person types (not for an existing name)
  const listId = useId();
  const box = useRef(null);

  useEffect(() => {
    if (!typed.current) return undefined;
    const q = value.trim();
    if (q.length < (cities ? 2 : 3)) {
      setResults([]);
      setStatus('idle');
      return undefined;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus('loading');
      try {
        let found;
        if (cities) found = await searchCities(q, ctrl.signal);
        else {
          const center = near ? await locate(near, ctrl.signal).catch(() => null) : null;
          found = await searchPlaces(q, center, ctrl.signal);
        }
        setResults(found);
        setActive(-1);
        setOpen(true);
        setStatus('idle');
      } catch (e) {
        if (e.name !== 'AbortError') {
          setResults([]);
          setStatus('error');
        }
      }
    }, WAIT_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, near, cities]);

  // Close when clicking elsewhere.
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const pick = (p) => {
    typed.current = false;
    setOpen(false);
    setResults([]);
    onPick(p);
  };

  const onKeyDown = (e) => {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') {
      e.stopPropagation(); // close the list, not the whole form
      setOpen(false);
    }
  };

  const showList = open && results.length > 0;
  return (
    <div className="place" ref={box}>
      <div className="place-field">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            typed.current = true;
            onChange(e.target.value);
          }}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {status === 'loading' && <span className="place-spin" aria-label="Searching places" />}
      </div>
      {showList && (
        <div className="place-list">
          <ul id={listId} role="listbox" aria-label="Places">
            {results.map((p, i) => {
              const c = knownType(p.category) ? category(p.category) : null;
              return (
                <li
                  key={p.id + i}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? 'is-active' : ''}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p)}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className="place-icon" style={c ? { background: c.tint, color: c.color } : undefined}>
                    <Icon name={c ? c.icon : 'pin'} size={15} />
                  </span>
                  <span className="place-text">
                    <span className="place-name">{p.name}</span>
                    <small>{[p.kind, p.area].filter(Boolean).join(' · ')}</small>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="place-credit">Places © OpenStreetMap contributors</div>
        </div>
      )}
    </div>
  );
}
