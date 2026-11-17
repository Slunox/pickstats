// Affichage de l'écran courant.

import { S, ui } from './state.js';
import { $ } from './util.js';
import { home } from './views/home.js';
import { club, tedit } from './views/club.js';
import { pick } from './views/pick.js';
import { games, game, report } from './views/archives.js';
import { play } from './views/play.js';
import { playLock } from './views/playlock.js';
import { hist } from './views/history.js';
import { stats } from './views/stats.js';
import { comp } from './views/composition.js';
import { settings } from './views/settings.js';
import { importView } from './views/import.js';
import { members } from './views/account.js';
import { emCheck } from './views/emarque.js';
import { emSheet } from './views/emsheet.js';

// Écran de saisie : le classique est celui de la démo, l'autre est à l'essai (Réglages).
const playView = () => (S.entry === 'lock' ? playLock() : play());

const VIEWS = { home, club, tedit, pick, games, game, play: playView, hist, stats, comp, set: settings, import: importView, members, emcheck: emCheck, emsheet: emSheet, report };

// Écrans qui affichent la barre d'onglets du match en cours
const MATCH_VIEWS = ['play', 'hist', 'stats', 'comp', 'set'];
const TABS = [['play', 'Saisie'], ['stats', 'Statistiques'], ['comp', 'Composition']];

export function applyTheme() {
  const t = S.theme || 'light';
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = dark ? '#0E181E' : '#16242C';
}

function nav() {
  const v = ui.view;
  const isOn = t => v === t || (v === 'hist' && t === 'play');
  return '<nav>'
    + '<button class="homebtn" data-x="view" data-v="home" aria-label="Accueil">⌂</button>'
    + TABS.map(([t, label]) => `<button class="${isOn(t) ? 'on' : ''}" data-x="view" data-v="${t}">${label}</button>`).join('')
    + `<button class="gear${v === 'set' ? ' on' : ''}" data-x="view" data-v="set" aria-label="Réglages">⚙</button>`
    + '</nav>';
}

// Dernier écran affiché : on remonte en haut quand on en change, et seulement là. Remonter à
// chaque rendu ferait sauter la page à chaque action saisie pendant un match.
let shown = null;

export function render() {
  applyTheme();
  const inMatch = S.active && MATCH_VIEWS.includes(ui.view);
  const moved = ui.view !== shown;
  shown = ui.view;
  // Marge du bas : la barre d'actions de la saisie (classique ou essai) est une carte collante
  // mais dans le flux, qui prend sa place elle-même ; ailleurs, pas de barre du tout.
  document.documentElement.dataset.bar = ui.view === 'play' ? 'flow' : '';
  // La fenêtre du compte est recréée elle aussi : on garde l'endroit où elle était défilée.
  const sh = $('#app .sheet'), shTop = sh ? sh.scrollTop : 0;
  $('#app').innerHTML = (inMatch ? nav() : '') + (VIEWS[ui.view] || home)();
  if (moved) window.scrollTo(0, 0);
  if (shTop) { const n = $('#app .sheet'); if (n) n.scrollTop = shTop; }
  // Filtres et palettes défilants sont recréés à chaque rendu : on garde le choix visible.
  document.querySelectorAll('.chips.scroll, .swatches.scroll').forEach(c => {
    const on = c.querySelector('.on');
    if (on) c.scrollLeft = on.offsetLeft - c.offsetLeft - (c.clientWidth - on.offsetWidth) / 2;
  });
}
