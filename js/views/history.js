// Historique des actions du match en cours.

import { S, ui } from '../state.js';
import { LBL, TAGC } from '../constants.js';
import { esc, qLabel } from '../util.js';
import { who } from '../model.js';
import { back, periodChips } from './common.js';

export function hist() {
  const list = S.ev.map((e, i) => ({ e, i })).filter(o => ui.hq === 'all' || o.e.q === +ui.hq).reverse();
  const rows = list.length
    ? list.map(o => `<div class="hrow">
        <span class="hq">${qLabel(o.e.q)}</span>
        <div class="hd"><b>${esc(who(o.e))}</b><span class="tag ${TAGC[o.e.a] || ''}">${LBL[o.e.a]}</span></div>
        <button class="del" data-x="delev" data-i="${o.i}" aria-label="Supprimer cette action">✕</button>
      </div>`).join('')
    : '<p class="help">Aucune action enregistrée.</p>';

  return back('Saisie', 'view', 'play')
    + periodChips(ui.hq, 'hq', 'Tout')
    + `<div class="card">
      <h2>Historique (${list.length} action${list.length > 1 ? 's' : ''})</h2>
      ${rows}
      <p class="help">La croix supprime l’action immédiatement. Les actions les plus récentes sont en haut.</p>
    </div>`;
}
