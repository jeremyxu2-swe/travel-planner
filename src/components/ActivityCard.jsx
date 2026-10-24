import { category } from '../categories.js';
import { durationMin, fmtDuration, fmtRange } from '../lib/time.js';
import { CategoryIcon } from './Icon.jsx';

// Compact card used in the week board.
export default function ActivityCard({ activity, conflictWith, onOpen, onDragStart, onDragEnd }) {
  const cat = category(activity.category);
  const dur = durationMin(activity.start, activity.end);
  const showDur = dur != null && dur >= 120 && activity.category !== 'flight';
  return (
    <button
      type="button"
      className={`week-card${conflictWith ? ' is-conflict' : ''}`}
      onClick={() => onOpen(activity)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', activity.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(activity.id);
      }}
      onDragEnd={onDragEnd}
    >
      <CategoryIcon cat={cat} size={30} />
      <span className="week-card-body">
        <span className="week-card-time">{fmtRange(activity.start, activity.end)}</span>
        <span className="week-card-title">{activity.title}</span>
        {showDur && <span className="week-card-sub">{fmtDuration(dur)} block</span>}
        {conflictWith && <span className="badge-conflict">Overlaps {conflictWith}</span>}
      </span>
    </button>
  );
}
