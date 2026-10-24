import { placeSummary } from '../lib/dayplaces.js';
import Icon from './Icon.jsx';

// "Kyoto, Japan · Day 2 of 2 in Kyoto · Seoul tomorrow" above a day's plan.
export default function WhereBanner({ date, dates, dayInfo, onEdit }) {
  const sum = date ? placeSummary(date, dayInfo || {}, dates) : null;
  if (!date) return null;
  if (!sum) {
    return (
      <button type="button" className="where where-empty" onClick={() => onEdit(date)}>
        <Icon name="pin" size={16} /> Which city are you in on this day? <span className="where-add">+ Add city</span>
      </button>
    );
  }
  const c = sum.info.to;
  return (
    <div className="where" style={{ background: c.soft, borderColor: c.line }}>
      <span className="where-badge" style={{ background: c.tint, color: c.color, borderColor: c.line }}>
        {c.cc || <Icon name="pin" size={15} />}
      </span>
      <div className="where-text">
        <div className="where-title">{sum.title}</div>
        <div className="where-sub">{sum.sub}</div>
      </div>
      <button type="button" className="icon-btn where-edit" aria-label="Change city" onClick={() => onEdit(date)}>
        <Icon name="edit" size={15} />
      </button>
    </div>
  );
}
