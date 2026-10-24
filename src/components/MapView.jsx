import { dowLong, monthDay } from '../lib/time.js';
import RoutePanel from './RoutePanel.jsx';

// Every day's stops, each with a Google Maps route.
export default function MapView({ trip, dates, byDate, ideas }) {
  const days = dates.filter((d) => (byDate[d] || []).length);
  return (
    <div className="map-view">
      {days.map((d) => (
        <RoutePanel key={d} trip={trip} items={byDate[d]} title={`${dowLong(d)}, ${monthDay(d)}`} />
      ))}
      {ideas.length > 0 && <RoutePanel trip={trip} items={ideas} title="Ideas · not scheduled" />}
      {days.length === 0 && ideas.length === 0 && (
        <div className="empty">
          <p>Add some places to see them here.</p>
        </div>
      )}
    </div>
  );
}
