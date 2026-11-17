// Notifications et fenêtre de confirmation.

import { S } from './state.js';
import { $, esc } from './util.js';

// Petit son à chaque action enregistrée (Réglages › Son, désactivé par défaut) : le retour
// pour les iPad, qui n'ont pas de vibreur, et les iPhone, dont Safari ignore navigator.vibrate.
// Un « tic » synthétisé, sans fichier à charger. Le contexte audio naît au premier appui (iOS
// ne joue de son qu'après un geste) ; le bouton sourdine de l'appareil le coupe, comme il se doit.
let actx = null;
export function tick() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = actx || new AC();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1320, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.07);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + 0.1);
  } catch (e) {}
}

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 1400);
  try { if (S.vibe !== false && navigator.vibrate) navigator.vibrate(25); } catch (e) {}
  if (S.sound) tick();
}

// Fenêtre intégrée (les confirm()/alert() natifs peuvent être bloqués).
let onYes = null, onNo = null;

// ask(message, libellé du bouton, action si oui, bouton rouge ?, action si annulé, libellé du bouton Annuler)
// Sans libellé : simple message avec un bouton OK.
export function ask(msg, ok, yes, bad, no, noLabel) {
  onYes = yes || null;
  onNo = no || null;
  const m = $('#modal');
  m.innerHTML = `<div class="mbox"><p>${esc(msg)}</p><div class="mbtn">`
    + (ok ? `<button class="btn alt" data-x="mno">${esc(noLabel || 'Annuler')}</button>` : '')
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
