// Statistiques du match en cours.

import { S, ui } from '../state.js';
import { esc, qLabel } from '../util.js';
import { periodChips, exportButtons, sendCard, statsView } from './common.js';

export function stats() {
  const q = ui.sq === 'all' ? null : +ui.sq;
  return periodChips(ui.sq, 'sq', 'Total match')
    + `<div class="card"><h2>${esc(S.me)} contre ${esc(S.opp)} — ${q == null ? 'total du match' : qLabel(q)}</h2>${statsView(q)}</div>`
    + exportButtons()
    + sendCard();
}
