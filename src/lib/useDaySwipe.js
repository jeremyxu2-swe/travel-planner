import { useEffect, useRef } from 'react';

// Swipe left/right on the phone's day view to go to the next/previous day.
// Works with:
//  - a finger on a touch screen
//  - a two-finger sideways swipe on a laptop trackpad (sideways wheel events)
//  - a mouse drag (outside the calendar grid, where dragging creates activities)
// The content follows the gesture, then the new day slides in from that side.
// It stays out of the way of:
//  - vertical scrolling (the gesture locks to one direction after a few pixels)
//  - press-and-hold drags in the calendar (those call preventDefault on touchmove)
//  - anything that scrolls sideways itself, like the city chips
const LOCK_PX = 10; // movement before deciding horizontal vs vertical
const COMMIT_PX = 60; // distance that always changes the day
const FLICK_PX = 30; // a quick flick only needs this far…
const FLICK_SPEED = 0.45; // …at this speed (px per ms)
const WHEEL_COMMIT = 70; // sideways trackpad scroll needed to change the day
const WHEEL_QUIET_MS = 160; // the trackpad gesture is over after this long without events
const SKIP = '.city-filter, .daystrip, input, textarea, select, [data-noswipe]';
const MOUSE_SKIP = `${SKIP}, .cal-cols, .stay-row`; // mouse drags there create/move things

// `el` is the element (from a callback ref), so this re-attaches when it remounts.
export default function useDaySwipe(el, { enabled, canPrev, canNext, onPrev, onNext }) {
  const opts = useRef({});
  opts.current = { enabled, canPrev, canNext, onPrev, onNext };

  useEffect(() => {
    if (!el) return undefined;
    let g = null; // touch or mouse gesture in progress
    let w = null; // trackpad gesture in progress
    let swallowClick = false;

    const setX = (x) => el.style.setProperty('--swipe-x', `${x}px`);
    const follow = (dx) => {
      const { canPrev: p, canNext: n } = opts.current;
      const blocked = (dx > 0 && !p) || (dx < 0 && !n);
      el.classList.add('is-swiping');
      setX(blocked ? dx * 0.25 : dx); // rubber-band at the first/last day
    };
    const settle = () => {
      el.classList.remove('is-swiping');
      el.classList.add('is-settling');
      setX(0);
      setTimeout(() => el.classList.remove('is-settling'), 200);
    };
    const slideIn = (dir) => {
      el.classList.remove('is-swiping', 'is-settling', 'swipe-in-next', 'swipe-in-prev');
      setX(0);
      void el.offsetWidth; // restart the animation
      el.classList.add(dir > 0 ? 'swipe-in-next' : 'swipe-in-prev');
    };
    // dx < 0 = content moved left = next day.
    const commit = (dx) => {
      const { canPrev: p, canNext: n, onPrev: prev, onNext: next } = opts.current;
      if (dx < 0 && n) {
        next();
        slideIn(1);
        return true;
      }
      if (dx > 0 && p) {
        prev();
        slideIn(-1);
        return true;
      }
      settle();
      return false;
    };

    // ---- shared by touch and mouse
    const begin = (x, y, t, target, skip) => {
      g = null;
      if (!opts.current.enabled || target.closest(skip)) return;
      g = { x0: x, y0: y, t0: t, lock: null, dx: 0 };
    };
    // Returns true once the gesture is a sideways swipe.
    const track = (x, y) => {
      const dx = x - g.x0;
      const dy = y - g.y0;
      if (!g.lock) {
        if (Math.abs(dx) > LOCK_PX && Math.abs(dx) > Math.abs(dy) * 1.2) g.lock = 'x';
        else if (Math.abs(dy) > LOCK_PX) {
          g = null; // vertical scroll
          return false;
        } else return false;
      }
      g.dx = dx;
      follow(dx);
      return true;
    };
    const release = (t) => {
      const cur = g;
      g = null;
      if (!cur || cur.lock !== 'x') return false;
      const speed = Math.abs(cur.dx) / Math.max(1, t - cur.t0);
      const far = Math.abs(cur.dx) > COMMIT_PX || (Math.abs(cur.dx) > FLICK_PX && speed > FLICK_SPEED);
      if (far) commit(cur.dx);
      else settle();
      return true;
    };

    // ---- touch
    const touchStart = (e) => {
      if (e.touches.length !== 1) {
        g = null;
        return;
      }
      const t = e.touches[0];
      begin(t.clientX, t.clientY, e.timeStamp, e.target, SKIP);
    };
    const touchMove = (e) => {
      if (!g || g.mouse) return;
      if (e.defaultPrevented && g.lock !== 'x') {
        g = null; // the calendar is dragging an activity
        return;
      }
      const t = e.touches[0];
      if (track(t.clientX, t.clientY) && e.cancelable) e.preventDefault();
    };
    const touchEnd = (e) => {
      if (g && !g.mouse) release(e.timeStamp);
    };
    const touchCancel = () => {
      if (g?.lock === 'x') settle();
      g = null;
    };

    // ---- mouse
    const mouseMove = (e) => {
      if (!g?.mouse) return;
      if (track(e.clientX, e.clientY)) window.getSelection?.()?.removeAllRanges();
    };
    const mouseUp = (e) => {
      window.removeEventListener('pointermove', mouseMove);
      window.removeEventListener('pointerup', mouseUp);
      if (g?.mouse && release(e.timeStamp)) {
        swallowClick = true; // don't open whatever the drag ended on
        setTimeout(() => (swallowClick = false), 0);
      }
    };
    const pointerDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      begin(e.clientX, e.clientY, e.timeStamp, e.target, MOUSE_SKIP);
      if (!g) return;
      g.mouse = true;
      window.addEventListener('pointermove', mouseMove);
      window.addEventListener('pointerup', mouseUp);
    };
    const click = (e) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    };

    // ---- trackpad (sideways wheel)
    const wheel = (e) => {
      if (!opts.current.enabled || e.ctrlKey) return;
      if (e.target.closest?.(SKIP)) return;
      const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!w && !sideways) return;
      e.preventDefault(); // stops the browser's "swipe to go back"
      if (!w) w = { acc: 0, done: false, timer: 0 };
      clearTimeout(w.timer);
      w.timer = setTimeout(() => {
        if (w && !w.done) settle();
        w = null;
      }, WHEEL_QUIET_MS);
      if (w.done) return; // ignore the trackpad's momentum after changing day
      w.acc -= e.deltaX; // swiping fingers left scrolls right (deltaX > 0) → next day
      if (Math.abs(w.acc) >= WHEEL_COMMIT) {
        w.done = true;
        commit(w.acc);
      } else follow(w.acc * 0.6);
    };

    el.addEventListener('touchstart', touchStart, { passive: true });
    el.addEventListener('touchmove', touchMove, { passive: false });
    el.addEventListener('touchend', touchEnd);
    el.addEventListener('touchcancel', touchCancel);
    el.addEventListener('pointerdown', pointerDown);
    el.addEventListener('click', click, true);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('touchstart', touchStart);
      el.removeEventListener('touchmove', touchMove);
      el.removeEventListener('touchend', touchEnd);
      el.removeEventListener('touchcancel', touchCancel);
      el.removeEventListener('pointerdown', pointerDown);
      el.removeEventListener('click', click, true);
      el.removeEventListener('wheel', wheel);
      window.removeEventListener('pointermove', mouseMove);
      window.removeEventListener('pointerup', mouseUp);
      clearTimeout(w?.timer);
    };
  }, [el]);
}
