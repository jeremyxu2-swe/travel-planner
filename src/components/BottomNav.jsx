import Icon from './Icon.jsx';

const TABS = [
  ['itinerary', 'Itinerary', 'calendar'],
  ['map', 'Map', 'map'],
  ['todo', 'To-do', 'checklist'],
  ['notes', 'Notes', 'note'],
  ['trips', 'Trips', 'globe'],
];

export default function BottomNav({ tab, onChange, todoCount }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map(([id, label, icon]) => (
        <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'is-on' : ''} onClick={() => onChange(id)}>
          <span className="bn-icon">
            <Icon name={icon} size={20} />
            {id === 'todo' && todoCount > 0 && <span className="bn-badge">{todoCount}</span>}
          </span>
          {label}
        </button>
      ))}
    </nav>
  );
}
