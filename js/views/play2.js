// Écrans de saisie à l'essai (Réglages › Écran de saisie). La v1 (play.js) ne bouge pas :
// c'est elle que pilote la démo. Les deux versions ci-dessous vivent dans le même fichier pour
// se supprimer d'un bloc le jour où l'une des trois l'emporte.
//
// v2 — la saisie ne bouge plus :
//   · la barre d'actions est toujours là, grisée tant qu'aucun joueur n'est choisi, pour qu'on
//     puisse viser à l'avance au lieu de la voir surgir ;
//   · le joueur reste sélectionné après une action, les enchaînements coûtent un appui de moins ;
//   · plus de fenêtre après un tir raté : les boutons rebond déjà à l'écran s'animent, et on peut
//     les ignorer pour enchaîner.
//
// v3 — v2, plus l'attribution décalée : toucher une action sans joueur enregistre l'événement
//   « à attribuer ». On dit qui plus tard, à la première balle morte. C'est le seul moyen de
//   suivre une mêlée (tir, rebond, tir, rebond… en cinq secondes).

import { S, ui } from '../state.js';
import { ACTS, WON, SG, TEAM_REB, OPP_REB, LBL } from '../constants.js';
import { esc, qLabel } from '../util.js';
import { allP, tally, cnt, roster1, evText, statsMode, lastAction, shortNames, myColor, oppColor, isLight, colorVars } from '../model.js';

// Barre d'actions, toujours présente. Sans joueur choisi elle reste en place, estompée :
// en v3 elle sert quand même (l'action part « à attribuer »), en v2 elle est inerte.
function actionBar(v3) {
  const p = ui.sel ? roster1(ui.sel) : null;
  const nm = p ? (shortNames(allP())[p.n] || p.name) : '';
  const who = p
    ? `<span>#${esc(p.n)} ${esc(nm)}</span><button data-x="desel">Fermer</button>`
    : `<span class="dim">${v3 ? 'Sans joueur : l’action partira « à attribuer »' : 'Touche un joueur'}</span>`;
  return `<div class="bar${p ? '' : ' idle'}"><div class="in">
    <div class="who">${who}</div>
    <div class="acts t4">
      ${ACTS.map(a => `<button class="${a[2]}" data-x="act" data-a="${a[0]}"${p || v3 ? '' : ' disabled'}>${a[1]}</button>`).join('')}
    </div>
  </div></div>`;
}

// Groupe de boutons d'équipe. Après un tir raté, les deux rebonds s'animent : c'est ce qui
// remplace la fenêtre « qui a pris le rebond ? ». L'animation s'arrête au prochain événement.
const teamGroup = (title, list, label, ask) => `<div class="tbg"><small>${title}</small><div class="tbs">`
  + list.map(w => `<button class="tb${ask ? ' ask' : ''}" data-x="tact" data-a="${w[0]}" aria-label="Ajouter : ${label} ${w[1]}"><small><span class="tbp">+</span> ${w[1]}</small><b>${cnt(w[0], S.q)}</b></button>`).join('')
  + '</div></div>';

function playerButton(p, r, stk, mode, nm, armed) {
  let c = [];
  if (mode === 'all') c = SG.filter(k => r[k[0]] > 0);
  else if (mode === 'last') {
    const e = lastAction(p.n, S.q);
    if (e) c = SG.filter(k => k[0] === e.a);
  }
  const chips = c.length ? `<div class="sg">${c.map(k => `<span class="${k[2]}">${k[1]} ${r[k[0]]}</span>`).join('')}</div>` : '';
  return `<button class="pl${stk ? ' st' : ''}${c.length ? '' : ' ns'}${ui.sel === p.n ? ' on' : ''}${armed ? ' arm' : ''}" data-x="pl" data-p="${esc(p.n)}">`
    + `<b>${esc(p.n)}</b><span>${esc(nm) || '&nbsp;'}</span>${chips}</button>`;
}

// v3 : bandeau des actions captées sans leur auteur. On en touche une, puis le joueur.
function pending() {
  const list = S.pend || [];
  if (!list.length) return '';
  const chip = (e, i) => `<span class="pch${ui.pendSel === i ? ' on' : ''}">`
    + `<button data-x="psel" data-i="${i}">${esc(LBL[e.a] || e.a)}<small>${qLabel(e.q)}</small></button>`
    + `<button class="px" data-x="pdel" data-i="${i}" aria-label="Retirer cette action">✕</button></span>`;
  return `<div class="pend"><small>${list.length} à attribuer${ui.pendSel != null ? ' · touche le joueur' : ' · touche-en une, puis le joueur'}</small>`
    + `<div class="pchs">${list.map(chip).join('')}</div></div>`;
}

function screen(v3) {
  const T = tally(S.q);
  const stk = S.layout === 'stack', mode = statsMode(), shw = mode !== 'off';
  const last = S.ev[S.ev.length - 1], names = shortNames(allP());
  const ask = !!ui.rebAsk;
  const armed = v3 && ui.pendSel != null;

  return `<div class="top">
    <div class="me${isLight(myColor()) ? ' lt' : ''}" style="${colorVars(myColor())}">
      <div class="nm">${esc(S.me)}</div>
      ${teamGroup('Rebonds', TEAM_REB, 'Rebond', ask)}
      ${teamGroup('Ballons gagnés', WON, 'Ballon gagné', false)}
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
    <div class="opp${isLight(oppColor()) ? ' lt' : ''}" style="${colorVars(oppColor())}">
      <div class="nm">${esc(S.opp)}</div>
      ${teamGroup('Rebonds', OPP_REB, 'Rebond adverse', ask)}
    </div>
  </div>
  ${ask ? '<div class="qnote reb">Tir raté : qui a pris le rebond ? Les boutons clignotent — ou enchaîne, rien n’est obligatoire.</div>' : ''}
  ${v3 ? pending() : ''}
  ${shw ? `<div class="qnote">Stats du quart en cours : ${qLabel(S.q)}</div>` : ''}
  <div class="grid${stk ? ' stk' : ''}${armed ? ' arm' : ''}">
    ${allP().filter(p => p.in).map(p => playerButton(p, T[p.n], stk, mode, names[p.n], armed)).join('')}
  </div>
  ${actionBar(v3)}`;
}

export const play2 = () => screen(false);
export const play3 = () => screen(true);
