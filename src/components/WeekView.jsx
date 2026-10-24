import { useState } from 'react';
import { analyzeDay } from '../lib/schedule.js';
import { dow, monthDay } from '../lib/time.js';
import ActivityCard from './ActivityCard.jsx';
import Icon from './Icon.jsx';

function summary(items, pairs) {
  if (items.length === 0) return 'Free day';
  const flights = items.filter((a) => a.category === 'flight').length;
  const work = items.filter((a) => a.category === 'work').length;
  const parts = [];
  if (flights) parts.push(`${flights} flight${flights > 1 ? 's' : ''}`);
  if (work) parts.push(`${work} work block${work > 1 ? 's' : ''}`);
  const other = items.length - flights - work;
  if (other) parts.push(`${other} stop${other > 1 ? 's' : ''}`);
  if (pairs) parts.push(`${pairs} overlap${pairs > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

function Column({ date, items, onEdit, onAdd, onDrop, onOpenDay, dragging }) {
  const [over, setOver] = useState(false);
  const { timed, untimed, conflicts, pairs } = analyzeDay(items);
  const ordered = [...timed, ...untimed];
  const isIdeas = !date;
  return (
    <section
      className={`week-col${over ? ' is-over' : ''}${isIdeas ? ' is-ideas' : ''}`}
      onDragOver={(e) => {
        if (!dragging) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDrop(id, date);
      }}
    >
      <header className="week-col-head">
        <button type="button" className="week-col-title" onClick={() => onOpenDay(date)}>
          <span className="week-dow">{isIdeas ? 'UNSCHEDULED' : dow(date).toUpperCase()}</span>
          <span className="week-date">{isIdeas ? 'Ideas' : monthDay(date)}</span>
          <span className={`week-sum${pairs.length ? ' is-warn' : ''}`}>{summary(items, pairs.length)}</span>
        </button>
        <button type="button" className="icon-btn" aria-label={`Add to ${isIdeas ? 'ideas' : monthDay(date)}`} onClick={() => onAdd(date)}>
          <Icon name="plus" size={16} />
        </button>
      </header>
      <div className="week-col-body">
        {ordered.map((a) => (
          <ActivityCard
            key={a.id}
            activity={a}
            conflictWith={conflicts.get(a.id)?.[0]}
            onOpen={onEdit}
          />
        ))}
        <button type="button" className="add-dashed" onClick={() => onAdd(date)}>
          + Add to {isIdeas ? 'ideas' : dow(date)}
        </button>
      </div>
    </section>
  );
}

export default function WeekView({ dates, byDate, ideas, onEdit, onAdd, onMove, onOpenDay, onAddDay, onSetDates }) {
  const [dragging, setDragging] = useState(false);
  if (dates.length === 0) {
    return (
      <div className="empty empty-lg">
        <h2>When is this trip?</h2>
        <p>Add dates to lay out your days. Until then, everything you add is saved as an idea.</p>
        <div className="row-gap">
          <button type="button" className="btn btn-primary" onClick={onSetDates}>Set trip dates</button>
          <button type="button" className="btn" onClick={() => onAdd('')}>Add an idea</button>
        </div>
        {ideas.length > 0 && (
          <div className="week-scroll" style={{ marginTop: 24 }}>
            <div className="week-grid" style={{ gridTemplateColumns: 'minmax(260px, 360px)' }}>
              <Column date="" items={ideas} onEdit={onEdit} onAdd={onAdd} onDrop={onMove} onOpenDay={onOpenDay} dragging={false} />
            </div>
          </div>
        )}
      </div>
    );
  }
  const cols = (ideas.length ? 1 : 0) + dates.length;
  return (
    <div
      className="week-scroll"
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      onDrop={() => setDragging(false)}
    >
      <div className="week-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(196px, 1fr)) 112px`, minWidth: cols * 210 + 112 }}>
        {ideas.length > 0 && (
          <Column date="" items={ideas} onEdit={onEdit} onAdd={onAdd} onDrop={onMove} onOpenDay={onOpenDay} dragging={dragging} />
        )}
        {dates.map((d) => (
          <Column key={d} date={d} items={byDate[d] || []} onEdit={onEdit} onAdd={onAdd} onDrop={onMove} onOpenDay={onOpenDay} dragging={dragging} />
        ))}
        <button type="button" className="add-day" onClick={onAddDay}>
          <Icon name="plus" size={20} />
          Add day
        </button>
      </div>
      <p className="hint">Tip: drag a card onto another day to move it. Click a day's name to open it.</p>
    </div>
  );
}
