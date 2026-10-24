import { useEffect, useRef } from 'react';
import { dayNum, dow, monthDay } from '../lib/time.js';

// Horizontal day picker. "tabs" on desktop, compact "chips" on phones.
export default function DayStrip({ dates, selected, onSelect, counts, showIdeas, ideasCount, variant = 'tabs', dayInfo }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector('[aria-current="date"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [selected]);

  const items = [...(showIdeas ? [''] : []), ...dates];
  return (
    <nav className={`daystrip daystrip-${variant}`} aria-label="Days" ref={ref}>
      {items.map((d) => {
        const on = d === selected;
        const n = d ? counts[d] || 0 : ideasCount;
        const info = d && dayInfo?.[d] && !dayInfo[d].implied ? dayInfo[d] : null;
        return (
          <button key={d || 'ideas'} type="button" aria-current={on ? 'date' : undefined} className={`day-btn${on ? ' is-on' : ''}`} onClick={() => onSelect(d)}>
            <span className="day-dow">{d ? dow(d).toUpperCase() : 'IDEAS'}</span>
            <span className="day-num">{d ? (variant === 'chips' ? dayNum(d) : monthDay(d)) : '✦'}</span>
            {variant === 'chips' ? (
              info ? (
                <span className="day-tag" style={{ background: on ? 'var(--surface)' : info.to.tint, color: info.to.color }} title={info.travel ? `${info.from.city} → ${info.to.city}` : info.to.city}>
                  {info.to.short}
                </span>
              ) : (
                <span className="day-dot" style={{ opacity: n ? 1 : 0 }} />
              )
            ) : (
              <span className="day-count">
                {info ? `${info.travel ? `${info.from.city} → ${info.to.city}` : info.to.city} · ` : ''}
                {n} {n === 1 ? 'item' : 'items'}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
