import { useState } from 'react';
import Icon from './Icon.jsx';

export default function TodoPanel({ trip, todos, dispatch, readOnly }) {
  const [text, setText] = useState('');
  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  const add = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    dispatch({ type: 'addTodo', tripId: trip.id, text: text.trim() });
    setText('');
  };

  const Item = ({ t }) => (
    <li className={`todo${t.done ? ' is-done' : ''}`}>
      <label>
        <input type="checkbox" checked={t.done} disabled={readOnly} onChange={() => dispatch({ type: 'toggleTodo', id: t.id })} />
        <span>{t.text}</span>
      </label>
      {!readOnly && (
        <button type="button" className="icon-btn" aria-label={`Delete "${t.text}"`} onClick={() => dispatch({ type: 'deleteTodo', id: t.id })}>
          <Icon name="trash" size={16} />
        </button>
      )}
    </li>
  );

  return (
    <div className="todo-panel">
      {!readOnly && <form className="todo-add" onSubmit={add}>
        <label className="sr-only" htmlFor="todo-input">New to-do</label>
        <input id="todo-input" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Book tickets, pack charger…" />
        <button type="submit" className="btn btn-primary">Add</button>
      </form>}
      {todos.length === 0 && <p className="muted">Things to book or pack for {trip.name}.</p>}
      <ul className="todo-list">
        {open.map((t) => (
          <Item key={t.id} t={t} />
        ))}
      </ul>
      {done.length > 0 && (
        <>
          <h3 className="agenda-sub">Done · {done.length}</h3>
          <ul className="todo-list">
            {done.map((t) => (
              <Item key={t.id} t={t} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
