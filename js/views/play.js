// Écran de saisie pendant le match.

import { S, ui } from '../state.js';
import { ACTS, TACTS, OACTS, WON, SG } from '../constants.js';
import { esc, qLabel } from '../util.js';
import { allP, tally, cnt, roster1, evText, statsMode, lastAction } from '../model.js';

// Barre du bas avec les boutons d'action du joueur (ou de l'équipe) sélectionné.
function actionBar() {
  const sel = ui.sel;
  if (!sel) return '';
  const k = sel === '__team' ? 't' : sel === '__opp' ? 'o' : 'p';
  const p = roster1(sel);
  const list = k === 't' ? TACTS : k === 'o' ? OACTS : ACTS;
  const title = k === 't' ? esc(S.me) + ' : ballons gagnés'
    : k === 'o' ? esc(S.opp) + ' : rebonds'
    : '#' + esc(p.n) + ' ' + esc(p.name);
  return `<div class="bar"><div class="in">
    <div class="who"><span>${title}</span><button data-x="desel">Fermer</button></div>
    <div class="acts${k === 't' ? ' t4' : k === 'o' ? ' t2' : ''}">
      ${list.map(a => `<button class="${a[2]}" data-x="act" data-a="${a[0]}">${a[1]}</button>`).join('')}
    </div>
  </div></div>`;
}

function playerButton(p, r, stk, mode) {
  let c = [];
  if (mode === 'all') c = SG.filter(k => r[k[0]] > 0);
  else if (mode === 'last') {
    const e = lastAction(p.n, S.q);
    if (e) c = SG.filter(k => k[0] === e.a);
  }
  const chips = c.length ? `<div class="sg">${c.map(k => `<span class="${k[2]}">${k[1]} ${r[k[0]]}</span>`).join('')}</div>` : '';
  return `<button class="pl${stk ? ' st' : ''}${c.length ? '' : ' ns'}${ui.sel === p.n ? ' on' : ''}" data-x="pl" data-p="${esc(p.n)}">`
    + `<b>${esc(p.n)}</b><span>${esc(p.name) || '&nbsp;'}</span>${chips}</button>`;
}

export function play() {
  const T = tally(S.q);
  const stk = S.layout === 'stack', mode = statsMode(), shw = mode !== 'off';
  const last = S.ev[S.ev.length - 1];

  return `<div class="top">
    <div class="me">
      <div class="nm">${esc(S.me)}</div>
      <button class="open${ui.sel === '__team' ? ' on' : ''}" data-x="pl" data-p="__team">Ajouter un ballon gagné</button>
      <div class="tiles">${WON.map(w => `<div class="tile"><small>${w[2] || w[1]}</small><b>${cnt(w[0], S.q)}</b></div>`).join('')}</div>
    </div>
    <div class="mid">
      <div class="q">
        <button data-x="q-" aria-label="Période précédente">‹</button>
        <b>${qLabel(S.q)}</b>
        <button data-x="q+" aria-label="Période suivante">›</button>
      </div>
      <div class="ur">
        <button class="undo" data-x="undo"${last ? '' : ' disabled'}>Annuler la dernière<small>${last ? esc(evText(last)) + ' · ' + qLabel(last.q) : 'Aucune action'}</small></button>
        <button class="undo hb" data-x="view" data-v="hist">Historique</button>
      </div>
    </div>
    <div class="opp">
      <div class="nm">${esc(S.opp)}</div>
      <button class="open${ui.sel === '__opp' ? ' on' : ''}" data-x="pl" data-p="__opp">Ajouter un rebond</button>
      <div class="tiles">
        <div class="tile"><small>Off.</small><b>${cnt('orb', S.q)}</b></div>
        <div class="tile"><small>Déf.</small><b>${cnt('odr', S.q)}</b></div>
      </div>
    </div>
  </div>
  ${shw ? `<div class="qnote">Stats du quart en cours : ${qLabel(S.q)}</div>` : ''}
  <div class="grid${stk ? ' stk' : ''}">
    ${allP().filter(p => p.in).map(p => playerButton(p, T[p.n], stk, mode)).join('')}
  </div>
  ${actionBar()}`;
}
