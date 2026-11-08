// Affichage de l'écran courant.

import { S, ui } from './state.js';
import { $ } from './util.js';
import { home } from './views/home.js';
import { club, tedit } from './views/club.js';
import { pick } from './views/pick.js';
import { games, game } from './views/archives.js';
import { play } from './views/play.js';
import { hist } from './views/history.js';
import { stats } from './views/stats.js';
import { comp } from './views/composition.js';
import { settings } from './views/settings.js';
import { importView } from './views/import.js';
import { members } from './views/account.js';

const VIEWS = { home, club, tedit, pick, games, game, play, hist, stats, comp, set: settings, import: importView, members };

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

export function render() {
  applyTheme();
  const inMatch = S.active && MATCH_VIEWS.includes(ui.view);
  $('#app').innerHTML = (inMatch ? nav() : '') + (VIEWS[ui.view] || home)();
  // Les filtres défilants sont recréés à chaque rendu : on garde le filtre choisi visible.
  document.querySelectorAll('.chips.scroll').forEach(c => {
    const on = c.querySelector('.chip.on');
    if (on) c.scrollLeft = on.offsetLeft - c.offsetLeft - (c.clientWidth - on.offsetWidth) / 2;
  });
}
