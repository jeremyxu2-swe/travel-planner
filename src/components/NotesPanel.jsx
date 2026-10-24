import { useEffect, useRef, useState } from 'react';

// One free-form notes page per trip. Saves as you type (half a second after you
// stop), and syncs with the trip like everything else.
// Render with key={trip.id} so switching trips saves the old trip's notes first.
export default function NotesPanel({ trip, dispatch, readOnly }) {
  const [text, setText] = useState(trip.notes || '');
  const [pending, setPending] = useState(false);
  const timer = useRef(null);
  const textRef = useRef(text);
  const tripRef = useRef(trip);
  tripRef.current = trip;

  const save = (value) => {
    clearTimeout(timer.current);
    timer.current = null;
    if ((tripRef.current.notes || '') !== value) dispatch({ type: 'setTripNotes', id: tripRef.current.id, notes: value });
    setPending(false);
  };

  // Notes changed somewhere else (another device, someone you share with): show them,
  // unless you're in the middle of typing here.
  useEffect(() => {
    if (!timer.current) {
      setText(trip.notes || '');
      textRef.current = trip.notes || '';
    }
  }, [trip.notes]);

  // Closing the panel never loses the last few keystrokes.
  useEffect(() => () => timer.current && save(textRef.current), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (e) => {
    const v = e.target.value;
    setText(v);
    textRef.current = v;
    setPending(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(v), 500);
  };

  return (
    <div className="notes-panel">
      <label className="sr-only" htmlFor="trip-notes">Notes for {trip.name}</label>
      <textarea
        id="trip-notes"
        className="notes-area"
        value={text}
        onChange={onChange}
        onBlur={() => timer.current && save(textRef.current)}
        readOnly={readOnly}
        placeholder={readOnly ? 'No notes yet.' : `Anything for ${trip.name}: confirmation numbers, packing reminders, ideas, who’s paying for what…`}
      />
      <p className="muted notes-status" aria-live="polite">
        {readOnly ? 'You can view this trip’s notes but not change them.' : pending ? 'Saving…' : 'Saved'}
      </p>
    </div>
  );
}
