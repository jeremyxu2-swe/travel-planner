import { category } from '../categories.js';
import { isRoutable, mapsRouteUrl, mapsSearchUrl, placeQuery, sortActivities } from '../lib/schedule.js';
import { fmtTime } from '../lib/time.js';
import Icon from './Icon.jsx';

// Ordered stops for one day with links into Google Maps.
export default function RoutePanel({ trip, items, title = 'Route for the day' }) {
  const stops = sortActivities(items).filter(isRoutable);
  const url = mapsRouteUrl(stops.map((a) => placeQuery(a, trip)));
  return (
    <aside className="route-panel" aria-label={title}>
      <div className="route-head">
        <div>
          <h2>{title}</h2>
          <p>{stops.length ? `${stops.length} stops in visit order` : 'No places to map yet'}</p>
        </div>
        {url && (
          <a className="btn btn-dark" href={url} target="_blank" rel="noreferrer">
            <Icon name="route" size={16} /> Open route
          </a>
        )}
      </div>
      <ol className="route-list">
        {stops.map((a, i) => {
          const cat = category(a.category);
          return (
            <li key={a.id}>
              <span className="route-n" style={{ background: cat.color }}>{i + 1}</span>
              <span className="route-name">
                <span>{a.title}</span>
                <small>{a.start ? fmtTime(a.start) : 'Anytime'}{a.location ? ` · ${a.location}` : ''}</small>
              </span>
              <a className="icon-btn" href={mapsSearchUrl(placeQuery(a, trip))} target="_blank" rel="noreferrer" aria-label={`Open ${a.title} in Google Maps`}>
                <Icon name="external" size={16} />
              </a>
            </li>
          );
        })}
      </ol>
      {stops.length > 10 && <p className="route-note">Google Maps routes up to 10 stops, so the route link covers the first 10.</p>}
      {!trip.destination && stops.length > 0 && (
        <p className="route-note">Tip: set the trip's destination so place names are searched in the right city.</p>
      )}
    </aside>
  );
}
