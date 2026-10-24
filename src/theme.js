// Light ("Daylight") / dark ("Midnight") theme. "system" follows the device setting.
import { useEffect, useState } from 'react';

const KEY = 'travel-planner:theme';
const mq = () => window.matchMedia('(prefers-color-scheme: dark)');

export function readThemePref() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

export function applyTheme(pref) {
  const dark = pref === 'dark' || (pref === 'system' && mq().matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1220' : '#f4f5fa');
  return dark ? 'dark' : 'light';
}

export function useTheme() {
  const [pref, setPref] = useState(readThemePref);
  const [resolved, setResolved] = useState(() => applyTheme(readThemePref()));
  useEffect(() => {
    setResolved(applyTheme(pref));
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      /* ignore */
    }
    if (pref !== 'system') return undefined;
    const m = mq();
    const on = () => setResolved(applyTheme('system'));
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [pref]);
  return { pref, resolved, setPref, toggle: () => setPref(resolved === 'dark' ? 'light' : 'dark') };
}
