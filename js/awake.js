// Empêche la tablette de se mettre en veille pendant le match.

import { S } from './state.js';

let lock = null;

export async function keepAwake() {
  try {
    if (S.awake === false || !('wakeLock' in navigator) || document.visibilityState !== 'visible' || lock) return;
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; });
  } catch (e) {
    lock = null;
  }
}

export function releaseAwake() {
  if (lock) { lock.release(); lock = null; }
}
