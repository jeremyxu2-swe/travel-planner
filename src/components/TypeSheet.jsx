import { useState } from 'react';
import { SWATCHES, TYPE_ICONS, getCategories } from '../categories.js';
import { newId } from '../state.js';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';

// Add or edit one activity type: name, symbol and color.
// Deleting a type that's in use asks where its activities should go.
export default function TypeSheet({ initial, usage = 0, canDelete, onSave, onDelete, onClose }) {
  const isNew = !initial.id;
  const [form, setForm] = useState({ label: '', icon: 'star', color: 'teal', ...initial });
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const others = getCategories().filter((c) => c.id !== initial.id);
  const [moveTo, setMoveTo] = useState(others.find((c) => c.id === 'other')?.id || others[0]?.id || '');
  const preview = { color: `var(--sw-${form.color})`, tint: `var(--sw-${form.color}-bg)` };

  const submit = (e) => {
    e.preventDefault();
    const label = form.label.trim();
    if (!label) return setError('Give the type a name.');
    const clash = getCategories().find((c) => c.id !== initial.id && c.label.toLowerCase() === label.toLowerCase());
    if (clash) return setError(`You already have a type called “${clash.label}”.`);
    onSave({ id: form.id || newId('type'), label, icon: form.icon, color: form.color, position: form.position ?? 999 });
  };

  return (
    <Sheet
      title={isNew ? 'New activity type' : 'Edit activity type'}
      onClose={onClose}
      footer={
        deleting ? (
          <>
            <button type="button" className="btn" onClick={() => setDeleting(false)}>Keep it</button>
            <button type="button" className="btn btn-danger btn-grow" onClick={() => onDelete(initial.id, usage ? moveTo : null)}>
              <Icon name="trash" size={16} /> Delete “{initial.label}”
            </button>
          </>
        ) : (
          <>
            {!isNew && canDelete && (
              <button type="button" className="btn btn-danger-ghost" onClick={() => setDeleting(true)}>
                <Icon name="trash" size={16} /> Delete
              </button>
            )}
            <button type="submit" form="type-form" className="btn btn-primary btn-grow">
              {isNew ? 'Add type' : 'Save changes'}
            </button>
          </>
        )
      }
    >
      {deleting ? (
        <div className="form">
          {usage > 0 ? (
            <>
              <p>
                {usage} {usage === 1 ? 'activity uses' : 'activities use'} “{initial.label}”. Where should {usage === 1 ? 'it' : 'they'} go?
              </p>
              <label className="field">
                <span className="field-label">Move to</span>
                <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                  {others.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <p>No activities use “{initial.label}”, so nothing else changes.</p>
          )}
        </div>
      ) : (
        <form id="type-form" className="form" onSubmit={submit} noValidate>
          <label className="field">
            <span className="field-label">Name</span>
            <input
              type="text"
              value={form.label}
              maxLength={24}
              autoFocus={isNew}
              placeholder="e.g. Shopping"
              aria-invalid={!!error}
              onChange={(e) => {
                setError('');
                setForm((f) => ({ ...f, label: e.target.value }));
              }}
            />
            {error && <span className="field-error">{error}</span>}
          </label>

          <fieldset className="field">
            <legend className="field-label">Symbol</legend>
            <div className="sym-grid">
              {TYPE_ICONS.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`sym-opt${form.icon === name ? ' is-on' : ''}`}
                  aria-pressed={form.icon === name}
                  aria-label={name}
                  title={name}
                  style={form.icon === name ? { background: preview.tint, color: preview.color } : undefined}
                  onClick={() => setForm((f) => ({ ...f, icon: name }))}
                >
                  <Icon name={name} size={18} />
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend className="field-label">Color</legend>
            <div className="sw-grid">
              {SWATCHES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`sw-opt${form.color === s.key ? ' is-on' : ''}`}
                  aria-pressed={form.color === s.key}
                  aria-label={s.label}
                  title={s.label}
                  style={{ background: `var(--sw-${s.key}-bg)`, color: `var(--sw-${s.key})` }}
                  onClick={() => setForm((f) => ({ ...f, color: s.key }))}
                >
                  <span className="sw-dot" style={{ background: `var(--sw-${s.key})` }} />
                  {form.color === s.key && <Icon name="check" size={14} stroke={3} />}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <span className="field-label">Preview</span>
            <div className="type-preview">
              <span className="cat-icon" style={{ width: 34, height: 34, background: preview.tint, color: preview.color }}>
                <Icon name={form.icon} size={18} />
              </span>
              <div className="type-preview-block" style={{ background: preview.tint, color: preview.color }}>
                <strong>{form.label.trim() || 'Activity name'}</strong>
                <span>10:00 – 11:30 AM</span>
              </div>
            </div>
            <p className="field-help">This is how it looks on the calendar, in both light and dark mode.</p>
          </div>
        </form>
      )}
    </Sheet>
  );
}
