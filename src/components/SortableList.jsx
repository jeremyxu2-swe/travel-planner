import { useRef, useState } from 'react';
import Icon from './Icon.jsx';

// A list you reorder by dragging.
//  - Mouse: drag a row anywhere (a plain click still works as a click).
//  - Touch: drag the ⋮⋮ handle, so scrolling the page with a finger never moves rows.
//  - Keyboard: focus the handle and press ↑ / ↓.
// The other rows slide out of the way while you drag; onMove(fromIndex, toIndex) fires on drop.
const SLOP = 5; // px before a mouse press becomes a drag

export default function SortableList({ items, getKey, getLabel, onMove, renderRow, className = '' }) {
  const listRef = useRef(null);
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null); // { index, over, dy }
  const swallowClick = useRef(false);

  const begin = (e, index, viaHandle) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (!viaHandle && e.pointerType !== 'mouse') return; // touch drags only from the handle
    const rows = [...listRef.current.children];
    const rects = rows.map((r) => r.getBoundingClientRect());
    // On a page shrunk with CSS zoom, screen pixels and CSS pixels differ; translateY needs CSS pixels.
    const scale = rows[index].offsetHeight ? rects[index].height / rows[index].offsetHeight || 1 : 1;
    dragRef.current = { index, over: index, y0: e.clientY, dy: 0, rects, scale, active: viaHandle, pointerId: e.pointerId, el: e.currentTarget };
    if (viaHandle) {
      e.preventDefault();
      setDrag({ index, over: index, dy: 0 });
      capture(dragRef.current);
    }
    // A mouse press on the row only grabs the pointer once it turns into a drag,
    // so a plain click still reaches the row's button.
  };
  const capture = (d) => {
    try {
      d.el.setPointerCapture(d.pointerId);
    } catch {
      /* ignore */
    }
  };

  const move = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dy = e.clientY - d.y0;
    if (!d.active) {
      if (Math.abs(dy) < SLOP) return;
      d.active = true;
      capture(d);
    }
    d.dy = dy / d.scale;
    // Which slot is the dragged row's middle over now?
    const me = d.rects[d.index];
    const mid = me.top + me.height / 2 + dy;
    let over = d.index;
    d.rects.forEach((r, i) => {
      if (i < d.index && mid < r.top + r.height / 2) over = Math.min(over, i);
      if (i > d.index && mid > r.top + r.height / 2) over = Math.max(over, i);
    });
    d.over = over;
    setDrag({ index: d.index, over, dy: d.dy });
  };

  const end = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    if (!d.active) return; // just a click
    swallowClick.current = true; // the click that follows a drag shouldn't open the row
    setTimeout(() => (swallowClick.current = false), 0);
    if (d.over !== d.index) onMove(d.index, d.over);
  };

  const cancel = () => {
    dragRef.current = null;
    setDrag(null);
  };

  // How far each row shifts while dragging.
  const shiftOf = (i) => {
    if (!drag) return 0;
    if (i === drag.index) return drag.dy;
    const d = dragRef.current;
    const h = (d?.rects[drag.index]?.height || 0) / (d?.scale || 1);
    if (drag.index < drag.over && i > drag.index && i <= drag.over) return -h;
    if (drag.index > drag.over && i < drag.index && i >= drag.over) return h;
    return 0;
  };

  return (
    <ul ref={listRef} className={`sortable ${className}${drag ? ' is-sorting' : ''}`}>
      {items.map((item, i) => {
        const dragging = drag?.index === i;
        return (
          <li
            key={getKey(item)}
            className={`sortable-row${dragging ? ' is-dragging' : ''}`}
            style={{ transform: `translateY(${shiftOf(i)}px)` }}
            onPointerDown={(e) => !e.target.closest('.sort-handle') && begin(e, i, false)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={cancel}
            onClickCapture={(e) => {
              if (swallowClick.current) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
          >
            {renderRow(item, i)}
            <button
              type="button"
              className="sort-handle"
              aria-label={`Reorder ${getLabel(item)} (use arrow keys)`}
              title="Drag to reorder"
              onPointerDown={(e) => begin(e, i, true)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp' && i > 0) {
                  e.preventDefault();
                  onMove(i, i - 1);
                  requestAnimationFrame(() => listRef.current?.children[i - 1]?.querySelector('.sort-handle')?.focus());
                } else if (e.key === 'ArrowDown' && i < items.length - 1) {
                  e.preventDefault();
                  onMove(i, i + 1);
                  requestAnimationFrame(() => listRef.current?.children[i + 1]?.querySelector('.sort-handle')?.focus());
                }
              }}
            >
              <Icon name="grip" size={18} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
