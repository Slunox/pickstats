// Écran de saisie pendant le match.

import { S, ui } from '../state.js';
import { ACTS, WON, SG, TEAM_REB, OPP_REB } from '../constants.js';
import { esc, qLabel } from '../util.js';
import { allP, tally, cnt, roster1, evText, statsMode, lastAction, shortNames, curTeamColor, oppColor, isLight, colorVars } from '../model.js';

// Barre du bas avec les boutons d'action du joueur sélectionné.
function actionBar() {
  if (!ui.sel) return '';
  const p = roster1(ui.sel), nm = shortNames(allP())[p.n] || p.name;
  return `<div class="bar"><div class="in">
    <div class="who"><span>#${esc(p.n)} ${esc(nm)}</span><button data-x="desel">Fermer</button></div>
    <div class="acts t4">
      ${ACTS.map(a => `<button class="${a[2]}" data-x="act" data-a="${a[0]}">${a[1]}</button>`).join('')}
    </div>
  </div></div>`;
}

// Groupe de boutons d'équipe : chaque bouton ajoute directement +1.
const teamGroup = (title, list, label) => `<div class="tbg"><small>${title}</small><div class="tbs">`
  + list.map(w => `<button class="tb" data-x="tact" data-a="${w[0]}" aria-label="Ajouter : ${label} ${w[1]}"><small><span class="tbp">+</span> ${w[1]}</small><b>${cnt(w[0], S.q)}</b></button>`).join('')
  + '</div></div>';

function playerButton(p, r, stk, mode, nm) {
  let c = [];
  if (mode === 'all') c = SG.filter(k => r[k[0]] > 0);
  else if (mode === 'last') {
    const e = lastAction(p.n, S.q);
    if (e) c = SG.filter(k => k[0] === e.a);
  }
  const chips = c.length ? `<div class="sg">${c.map(k => `<span class="${k[2]}">${k[1]} ${r[k[0]]}</span>`).join('')}</div>` : '';
  return `<button class="pl${stk ? ' st' : ''}${c.length ? '' : ' ns'}${ui.sel === p.n ? ' on' : ''}" data-x="pl" data-p="${esc(p.n)}">`
    + `<b>${esc(p.n)}</b><span>${esc(nm) || '&nbsp;'}</span>${chips}</button>`;
}

export function play() {
  const T = tally(S.q);
  const stk = S.layout === 'stack', mode = statsMode(), shw = mode !== 'off';
  const last = S.ev[S.ev.length - 1], names = shortNames(allP());

  return `<div class="top">
    <div class="me" style="--a:${curTeamColor()}">
      <div class="nm">${esc(S.me)}</div>
      ${teamGroup('Rebonds', TEAM_REB, 'Rebond')}
      ${teamGroup('Ballons gagnés', WON, 'Ballon gagné')}
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
      ${teamGroup('Rebonds', OPP_REB, 'Rebond adverse')}
    </div>
  </div>
  ${shw ? `<div class="qnote">Stats du quart en cours : ${qLabel(S.q)}</div>` : ''}
  <div class="grid${stk ? ' stk' : ''}">
    ${allP().filter(p => p.in).map(p => playerButton(p, T[p.n], stk, mode, names[p.n])).join('')}
  </div>
  ${actionBar()}`;
}
