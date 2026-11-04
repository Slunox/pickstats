// Point d'entrée de l'appli.

import { S } from './state.js';
import { render, applyTheme } from './render.js';
import { keepAwake } from './awake.js';
import './actions.js'; // branche les écouteurs de clics et de saisie

try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.theme === 'auto') applyTheme(); });
} catch (e) {}

render();

document.addEventListener('visibilitychange', keepAwake);
document.addEventListener('click', keepAwake);
document.addEventListener('gesturestart', e => e.preventDefault());
keepAwake();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
