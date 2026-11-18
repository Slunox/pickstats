// Historique des actions du match en cours.

import { S, ui } from '../state.js';
import { LBL, TAGC, SWAP } from '../constants.js';
import { esc, qLabel } from '../util.js';
import { who } from '../model.js';
import { back, periodChips } from './common.js';

// Heure de saisie, « 14h32 » ; les actions d'avant cet enregistrement n'en ont pas.
const hhmm = t => { const d = new Date(t); return d.getHours() + 'h' + String(d.getMinutes()).padStart(2, '0'); };

export function hist() {
  const list = S.ev.map((e, i) => ({ e, i })).filter(o => ui.hq === 'all' || o.e.q === +ui.hq).reverse();
  const rows = list.length
    ? list.map(o => `<div class="hrow">
        <span class="hq">${qLabel(o.e.q)}${o.e.t ? `<small>${hhmm(o.e.t)}</small>` : ''}</span>
        <div class="hd"><b>${esc(who(o.e))}</b><span class="tag ${TAGC[o.e.a] || ''}">${LBL[o.e.a]}</span></div>
        ${SWAP[o.e.a]
          ? `<button class="swp" data-x="swapev" data-i="${o.i}" aria-label="Changer en ${LBL[SWAP[o.e.a][0]]}">⇄ ${SWAP[o.e.a][1]}</button>`
          : '<span></span>'}
        <button class="del" data-x="delev" data-i="${o.i}" aria-label="Supprimer cette action">✕</button>
      </div>`).join('')
    : '<p class="help">Aucune action enregistrée.</p>';

  return back('Saisie', 'view', 'play', 'Historique')
    + periodChips(ui.hq, 'hq', 'Tout')
    + `<div class="card">
      <h2>Historique (${list.length} action${list.length > 1 ? 's' : ''})</h2>
      ${rows}
      <p class="help">Le bouton ⇄ corrige un tir (2 pts ↔ 3 pts) ou un rebond (offensif ↔ défensif). La croix supprime l’action immédiatement. Les actions les plus récentes sont en haut.</p>
    </div>`;
}
