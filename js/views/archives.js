// Matchs archivés : liste et détail.

import { S, ui, withMatch } from '../state.js';
import { esc, fdate } from '../util.js';
import { sortedTeams, curG, inTeam } from '../model.js';
import { back, periodChips, exportButtons, tables } from './common.js';

function gameRow(m) {
  return `<div class="grow">
    <div><b>${esc(m.me)} contre ${esc(m.opp)}</b><span>${fdate(m)} · ${m.ev.length} action${m.ev.length > 1 ? 's' : ''}</span></div>
    <div class="gbtn">
      <button class="btn" data-x="gopen" data-id="${m.id}">Voir</button>
      <button class="btn bad" data-x="gdel" data-id="${m.id}" aria-label="Supprimer ce match">Supprimer</button>
    </div>
  </div>`;
}

export function games() {
  const all = S.arch || [], teams = sortedTeams();
  const orphan = all.filter(m => !teams.some(t => inTeam(m, t)));
  let L = all;
  if (ui.gfilter === 'none') L = orphan;
  else if (ui.gfilter !== 'all') {
    const t = teams.find(z => z.id === ui.gfilter);
    if (t) L = all.filter(m => inTeam(m, t));
  }
  L = L.slice().reverse();

  const chip = (v, label) => `<button class="chip${ui.gfilter === v ? ' on' : ''}" data-x="gf" data-v="${v}">${label}</button>`;
  const chips = '<div class="chips scroll">'
    + chip('all', `Toutes (${all.length})`)
    + teams.map(t => chip(t.id, `${esc(t.name)} (${all.filter(m => inTeam(m, t)).length})`)).join('')
    + (orphan.length ? chip('none', `Autres (${orphan.length})`) : '')
    + '</div>';

  return back('Mon club', 'view', 'club') + chips
    + `<div class="card"><h2>Matchs archivés (${L.length})</h2>`
    + (L.length ? L.map(gameRow).join('') : '<p class="help">Aucun match archivé pour ce filtre.</p>')
    + '</div>';
}

export function game() {
  const m = curG();
  if (!m) return '<div class="card"><p class="help">Match introuvable.</p></div>';
  return back('Matchs archivés', 'gback') + withMatch(m, () => {
    const q = ui.sq === 'all' ? null : +ui.sq;
    return periodChips(ui.sq, 'sq', 'Total match')
      + `<div class="card"><h2>${esc(S.me)} contre ${esc(S.opp)} — ${fdate(m)}</h2>${tables(q)}</div>`
      + exportButtons()
      + `<button class="btn bad" data-x="gdel" data-id="${m.id}">Supprimer ce match</button>`;
  });
}
