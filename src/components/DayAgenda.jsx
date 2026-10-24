import { category } from '../categories.js';
import { analyzeDay, buildTimeline } from '../lib/schedule.js';
import { dowLong, durationMin, fmtDuration, fmtRange, fmtTime, monthDay } from '../lib/time.js';
import Icon, { CategoryIcon } from './Icon.jsx';
import { staysOn } from './StayRow.jsx';

function StopCard({ activity, n, conflict, onEdit }) {
  const cat = category(activity.category);
  // Flights cross time zones, so their local times don't give a true duration.
  const dur = activity.category === 'flight' ? null : durationMin(activity.start, activity.end);
  return (
    <li className="tl-row">
      <div className="tl-time">
        {activity.start ? (
          <>
            <span className="tl-start">{fmtTime(activity.start)}</span>
            {activity.end && <span className="tl-end">{fmtTime(activity.end)}</span>}
          </>
        ) : (
          <span className="tl-end">Anytime</span>
        )}
      </div>
      <div className="tl-pin-col">
        <span className="tl-pin" style={{ background: cat.color }}>{n ?? '•'}</span>
      </div>
      <button type="button" className={`tl-card${conflict ? ' is-conflict' : ''}`} onClick={() => onEdit(activity)}>
        <CategoryIcon cat={cat} />
        <span className="tl-card-body">
          <span className="tl-title">{activity.title}</span>
          <span className="tl-meta">
            <span className="tl-meta-time">{fmtRange(activity.start, activity.end)} · </span>
            {cat.label}
            {dur != null && ` · ${fmtDuration(dur)}`}
            {activity.location && ` · ${activity.location}`}
          </span>
          {activity.notes && <span className="tl-notes">{activity.notes}</span>}
          {conflict && <span className="tl-conflict">Overlaps {conflict.join(', ')}</span>}
        </span>
      </button>
    </li>
  );
}

export default function DayAgenda({ date, items, onEdit, onAdd, actions, stays = [], onEditStay }) {
  const { timed, untimed, conflicts, pairs } = analyzeDay(items);
  const rows = buildTimeline(timed);
  const isIdeas = !date;
  const first = timed[0];
  const last = timed[timed.length - 1];

  return (
    <section className="agenda" aria-label={isIdeas ? 'Ideas' : `${dowLong(date)} plan`}>
      <div className="agenda-head">
        <div className="agenda-title">
          <h1>{isIdeas ? 'Ideas · not scheduled' : `${dowLong(date)}, ${monthDay(date)}`}</h1>
          <p>
            {items.length} {items.length === 1 ? 'item' : 'items'}
            {first && ` · ${fmtTime(first.start)} – ${fmtTime(last.end || last.start)}`}
          </p>
        </div>
        {actions}
      </div>

      {date && staysOn(stays, date).length > 0 && (
        <div className="cal-stay-day agenda-stays">
          {staysOn(stays, date).map(({ s, note, out }) => (
            <button key={s.id} type="button" className={`stay-chip${out ? ' is-out' : ''}`} onClick={() => onEditStay?.(s)}>
              <Icon name="bed" size={13} />
              <span className="stay-name">{s.name}</span>
              <span className="stay-note">{note}</span>
            </button>
          ))}
        </div>
      )}

      {pairs.length > 0 && (
        <div className="conflict-banner" role="status">
          <Icon name="alert" size={20} />
          <div>
            <strong>
              {pairs.length} overlap{pairs.length > 1 ? 's' : ''}.
            </strong>{' '}
            {pairs
              .slice(0, 3)
              .map(([x, y]) => `${x.title} and ${y.title} at ${fmtTime(y.start)}`)
              .join('; ')}
            . Tap an item to change its time or move it to another day.
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="empty">
          <p>{isIdeas ? 'Save places here before you know which day they fit.' : 'Nothing planned yet.'}</p>
          {onAdd && (
            <button type="button" className="btn btn-primary" onClick={() => onAdd(date)}>
              <Icon name="plus" size={16} /> Add activity
            </button>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <ol className="timeline">
          {rows.map((r) =>
            r.type === 'stop' ? (
              <StopCard key={r.key} activity={r.activity} n={r.n} conflict={conflicts.get(r.activity.id)} onEdit={onEdit} />
            ) : (
              <li key={r.key} className="tl-row tl-gap">
                <span />
                <span className="tl-pin-col">
                  <span className="tl-dash" />
                </span>
                {onAdd ? (
                  <button type="button" className="gap-btn" onClick={() => onAdd(date, r.from)}>
                    Free · {fmtDuration(r.minutes)} <span aria-hidden="true">·</span> + Fill this gap
                  </button>
                ) : (
                  <span className="gap-btn is-static">Free · {fmtDuration(r.minutes)}</span>
                )}
              </li>
            )
          )}
        </ol>
      )}

      {untimed.length > 0 && (
        <>
          {!isIdeas && <h2 className="agenda-sub">Anytime today</h2>}
          <ol className="timeline">
            {untimed.map((a) => (
              <StopCard key={a.id} activity={a} onEdit={onEdit} />
            ))}
          </ol>
        </>
      )}

      {items.length > 0 && onAdd && (
        <button type="button" className="add-row" onClick={() => onAdd(date)}>
          <Icon name="plus" size={16} /> Add to {isIdeas ? 'ideas' : dowLong(date)}
        </button>
      )}
    </section>
  );
}
