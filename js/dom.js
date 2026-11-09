// Notifications et fenêtre de confirmation.

import { S } from './state.js';
import { $, esc } from './util.js';

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 1400);
  try { if (S.vibe !== false && navigator.vibrate) navigator.vibrate(25); } catch (e) {}
}

// Fenêtre intégrée (les confirm()/alert() natifs peuvent être bloqués).
let onYes = null, onNo = null;

// ask(message, libellé du bouton, action si oui, bouton rouge ?, action si annulé)
// Sans libellé : simple message avec un bouton OK.
export function ask(msg, ok, yes, bad, no) {
  onYes = yes || null;
  onNo = no || null;
  const m = $('#modal');
  m.innerHTML = `<div class="mbox"><p>${esc(msg)}</p><div class="mbtn">`
    + (ok ? '<button class="btn alt" data-x="mno">Annuler</button>' : '')
    + `<button class="btn${bad ? ' bad' : ''}" data-x="myes">${esc(ok || 'OK')}</button></div></div>`;
  m.classList.add('on');
}

export const note = msg => ask(msg, null, null);

// Fenêtre à plusieurs choix : list = [{ label, sub, cls, fn }].
// Toucher en dehors de la fenêtre la ferme sans rien faire.
let choices = [];
export function choose(title, list) {
  onYes = onNo = null;
  choices = list.map(o => o.fn || null);
  const m = $('#modal');
  m.innerHTML = `<div class="mbox"><p>${esc(title)}</p><div class="mopts">`
    + list.map((o, i) => `<button class="mopt ${o.cls || ''}"${o.style ? ` style="${o.style}"` : ''} data-x="mopt" data-i="${i}"><b>${esc(o.label)}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}</button>`).join('')
    + '</div></div>';
  m.classList.add('on');
}

export function chosen(i) {
  const f = choices[i] || null;
  choices = [];
  answer(false);
  return f;
}

// Ferme la fenêtre et renvoie l'action correspondant à la réponse.
export function answer(yes) {
  const f = yes ? onYes : onNo;
  onYes = onNo = null;
  const m = $('#modal');
  m.classList.remove('on');
  m.innerHTML = '';
  return f;
}
