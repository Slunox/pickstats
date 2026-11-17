// Écran de saisie à l'essai : « action verrouillée » (Réglages › Écran de saisie).
// play.js, le classique, ne bouge pas : c'est lui que pilote la démo.
//
// Le pari : dans une mêlée, ce qui se répète n'est pas le joueur, c'est l'action.
// Trois tirs ratés d'affilée, ce sont trois joueurs différents et une seule action. On verrouille
// donc l'action une fois, et la grille des joueurs devient la surface de saisie : un tir = un appui,
// avec son auteur, donc les pourcentages individuels sont préservés.
//
// Deuxième changement, aussi important : la question du rebond est posée **dans la barre du bas**,
// là où le doigt vient de se poser. Dans le classique, les boutons rebond sont en haut de l'écran
// et la fenêtre au centre : le doigt traverse la tablette à chaque événement.
//
// Un mode verrouillé oublié enregistrerait de faux événements, ce qui est pire que d'en perdre.
// D'où le traitement visuel appuyé, le bouton « Terminer » pleine largeur, et le relâchement
// automatique après un long silence (voir holdLock dans actions.js).

import { S, ui } from '../state.js';
import { ACTS, WON, SG, TEAM_REB, OPP_REB, LBL } from '../constants.js';
import { esc, qLabel } from '../util.js';
import { allP, tally, cnt, roster1, evText, statsMode, lastAction, shortNames, myColor, oppColor, isLight, colorVars } from '../model.js';

// Les trois actions qui reviennent sans arrêt dans une mêlée, dans cet ordre.
const HOT = ['m2', 'm3', 'stl'];
const BY = Object.fromEntries(ACTS.map(a => [a[0], a]));

// Le bloc d'actions, en bas. Il reprend le langage des groupes d'équipe du haut — une légende
// puis une rangée de boutons, sur fond clair — au lieu du panneau sombre arrondi de la v1 :
// celui-ci se lit comme une feuille modale, ce qui va quand il est fugace mais devient pesant
// quand il reste ouvert en permanence. Trois états : rebond à répondre, action verrouillée, actions.
function actbar() {
  if (ui.rebBar) {
    return `<div class="actbar reb"><div class="in">
      <small>Qui a pris le rebond ?</small>
      <div class="acts t3">
        <button class="n" data-x="rbar" data-a="ro">${esc(S.me)}<small>Rebond offensif</small></button>
        <button class="f" data-x="rbar" data-a="odr">${esc(S.opp)}<small>Rebond défensif</small></button>
        <button data-x="rbar" data-a="">Personne<small>Dehors, faute…</small></button>
      </div>
    </div></div>`;
  }
  if (ui.lock) {
    return `<div class="actbar lock"><div class="in">
      <div class="lockrow"><b>${esc(LBL[ui.lock] || ui.lock)}</b><span>touche les joueurs</span>
      <button class="btn alt" data-x="lockoff">Terminer</button></div>
    </div></div>`;
  }
  const p = ui.sel ? roster1(ui.sel) : null;
  const nm = p ? (shortNames(allP())[p.n] || p.name) : '';
  // Les trois actions qui reviennent sans arrêt passent devant ; les quatre autres sont derrière
  // « + », qui les met à leur place au lieu d'ajouter une rangée. Le bloc garde donc la même
  // hauteur dans les deux cas — une seule rangée, même sur un écran étroit.
  const list = (ui.actAll ? ['fd', 'to', 'trav', 'm1'] : HOT).map(c => BY[c]);
  const swap = ui.actAll
    ? '<button class="more" data-x="actmore" data-v="" aria-label="Revenir aux actions courantes">‹</button>'
    : '<button class="more" data-x="actmore" data-v="1" aria-label="Les autres actions">+</button>';
  return `<div class="actbar"><div class="in">
    <small>${p ? `Actions de <b>#${esc(p.n)} ${esc(nm)}</b>` : 'Touche un joueur, ou une action pour la verrouiller'}`
    + `${p ? '<button class="lk" data-x="desel">Fermer</button>' : ''}</small>
    <div class="acts" style="grid-template-columns:repeat(${list.length + 1},1fr)">
      ${list.map(a => `<button class="${a[2]}" data-x="act" data-a="${a[0]}">${a[1]}</button>`).join('')}${swap}
    </div>
  </div></div>`;
}

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

export function playLock() {
  const T = tally(S.q);
  const stk = S.layout === 'stack', mode = statsMode(), shw = mode !== 'off';
  const last = S.ev[S.ev.length - 1], names = shortNames(allP());

  return `<div class="top">
    <div class="me${isLight(myColor()) ? ' lt' : ''}" style="${colorVars(myColor())}">
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
  <div class="grid${stk ? ' stk' : ''}${ui.lock ? ' lock' : ''}">
    ${allP().filter(p => p.in).map(p => playerButton(p, T[p.n], stk, mode, names[p.n])).join('')}
  </div>
  ${actbar()}`;
}
