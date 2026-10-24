import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { applyTheme, readThemePref } from './theme.js';

// Set the theme before the first paint so there's no flash of the wrong colors.
applyTheme(readThemePref());

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
