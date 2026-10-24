import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

// Modal dialog on desktop, bottom sheet on phones (styling decides).
// readOnly: every field is shown but can't be changed, and the footer is just Close
// (used for trips shared with you as view only).
export default function Sheet({ title, onClose, children, footer, placement, readOnly }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // A tap that opens a sheet is followed by a fake "mouse down" from the browser,
  // which can land on the backdrop that just appeared. Only a press that *starts*
  // after the sheet opened (its own pointerdown) may close it.
  const pressed = useRef(false);
  useEffect(() => {
    const on = () => (pressed.current = true);
    document.addEventListener('pointerdown', on, true);
    return () => document.removeEventListener('pointerdown', on, true);
  }, []);
  useEffect(() => {
    const prev = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      prev?.focus?.();
    };
  }, []);

  return (
    <div className={`sheet-backdrop${placement ? ` is-peek is-${placement}` : ''}`} onMouseDown={(e) => e.target === e.currentTarget && pressed.current && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <span className="sheet-grabber" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn round" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="sheet-body">
          {readOnly ? (
            <>
              <p className="ro-note"><Icon name="eye" size={15} /> View only — the owner shared this trip with you to look at.</p>
              <fieldset disabled className="ro-fieldset">{children}</fieldset>
            </>
          ) : (
            children
          )}
        </div>
        {readOnly ? (
          <div className="sheet-foot">
            <button type="button" className="btn btn-grow" onClick={onClose}>Close</button>
          </div>
        ) : (
          footer && <div className="sheet-foot">{footer}</div>
        )}
      </div>
    </div>
  );
}
