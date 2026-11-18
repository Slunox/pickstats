// Écran de saisie à l'essai : « mode dynamique » (Réglages › Écran de saisie).
// play.js, le classique, ne bouge pas : c'est lui que pilote la démo.
//
// On touche le joueur, puis son action, comme dans le classique. Mais après un tir raté à 2 ou
// 3 points, l'écran passe en **mode dynamique** : la barre du bas demande qui a pris le rebond
// (nous, eux, personne), et tant qu'on n'a pas répondu, chaque joueur touché enregistre un
// rebond offensif pour l'équipe et un nouveau tir raté pour lui. Une mêlée sous le panier,
// c'est donc un appui par tir, avec son auteur. Un sélecteur 2 pts / 3 pts change le type de
// tir en cours de route. Répondre au rebond fait sortir du mode.
//
// Les lancers francs (« LF ») : combien, puis marqué ou raté pour chacun. Si le dernier est
// raté, on demande le rebond. Seuls les ratés sont enregistrés, comme pour les autres tirs :
// les paniers marqués viennent de la feuille e-Marque.
//
// Un mode dynamique oublié enregistrerait de faux tirs : il est donc très visible (contour des
// joueurs qui pulse) et reste allumé jusqu'à la réponse au rebond, sans minuterie.

import { S, ui } from '../state.js';
import { ACTS, WON, SG, TEAM_REB, OPP_REB } from '../constants.js';
import { esc, qLabel } from '../util.js';
import { allP, tally, cnt, roster1, evText, statsMode, lastAction, shortNames, myColor, oppColor, isLight, colorVars } from '../model.js';

const BY = Object.fromEntries(ACTS.map(a => [a[0], a]));
// Les actions du joueur sélectionné : les tirs sur une rangée de trois, le reste sur quatre.
const ROW1 = [BY.m2, BY.m3, ['lf', 'LF', 'b']]; // LF en bleu : marqués et ratés, pas que des ratés
const ROW2 = [BY.stl, BY.fd, BY.to, BY.trav];
// Points de césure pour les libellés longs, qui doivent tenir sur quatre colonnes de téléphone.
const SOFT = { stl: 'Inter&shy;ception', fd: 'Faute pro&shy;voquée' };

// Ballon de basket pour les lancers francs : vide (à dire), vert (marqué) ou rouge (raté).
const ball = (i, v) => `<svg class="ftball${v === true ? ' in' : v === false ? ' out' : ''}" viewBox="0 0 48 48" aria-hidden="true">
  <circle cx="24" cy="24" r="21"/><path d="M3 24h42M24 3v42M9 9c8 7 8 23 0 30M39 9c-8 7-8 23 0 30"/>
  <text x="24" y="25">${v === true ? '✓' : v === false ? '✗' : i + 1}</text></svg>`;

function playerName(n) {
  const p = roster1(n);
  return `#${esc(p.n)} ${esc(shortNames(allP())[p.n] || p.name)}`;
}

// Les trois réponses au rebond, en couleurs d'équipe.
const rebButtons = () => `<div class="acts t3">
    <button class="tc${isLight(myColor()) ? ' lt' : ''}" style="${colorVars(myColor())}" data-x="rbar" data-a="ro">${esc(S.me)}<small>Rebond offensif</small></button>
    <button class="tc${isLight(oppColor()) ? ' lt' : ''}" style="${colorVars(oppColor())}" data-x="rbar" data-a="odr">${esc(S.opp)}<small>Rebond défensif</small></button>
    <button class="no" data-x="rbar" data-a="">Personne<small>Dehors, faute…</small></button>
  </div>`;

// Le bloc du bas. États : mode dynamique, rebond après un LF, lancers francs, actions.
function actbar() {
  if (ui.dyn) {
    return `<div class="actbar fix dyn"><div class="in">
      <div class="dynrow"><span><em class="dyntag">Action dynamique</em> <b>${ui.dynP ? playerName(ui.dynP) : ''}</b>${ui.dynN > 1 ? ` <em class="dynn">${ui.dynN} d’affilée</em>` : ''}</span>
        <div class="shot" role="group" aria-label="Type de tir">${[['m2', '2 pts'], ['m3', '3 pts']].map(([a, l]) =>
          `<button class="${ui.dyn === a ? 'on' : ''}" data-x="dynsw" data-a="${a}" aria-pressed="${ui.dyn === a}">${l}</button>`).join('')}</div></div>
      <small class="dynhelp"><b>Touche le joueur</b> qui retente, ou le rebond :</small>
      ${rebButtons()}
    </div></div>`;
  }
  if (ui.rebBar) {
    return `<div class="actbar fix reb"><div class="in"><small>Qui a pris le rebond ?</small>${rebButtons()}</div></div>`;
  }
  if (ui.ft) {
    const F = ui.ft;
    if (!F.k) {
      return `<div class="actbar fix"><div class="in">
        <small><span>Lancers francs de <b>${playerName(F.n)}</b></span><button class="lk" data-x="ftx">Annuler</button></small>
        <div class="acts t3">${[1, 2, 3].map(k => `<button class="b ftk" data-x="ftn" data-v="${k}">${k}<small>lancer${k > 1 ? 's' : ''}</small></button>`).join('')}</div>
      </div></div>`;
    }
    return `<div class="actbar fix"><div class="in">
      <small><span>Lancers francs de <b>${playerName(F.n)}</b> : marqué ou raté ?</span><button class="lk" data-x="ftx">Annuler</button></small>
      <div class="fts">${F.r.map((v, i) => `<div class="ft">${ball(i, v)}
        <div class="ftb"><button class="n${v === true ? ' on' : ''}" data-x="ftr" data-i="${i}" data-v="1" aria-label="Lancer ${i + 1} marqué">✓</button>`
        + `<button class="r${v === false ? ' on' : ''}" data-x="ftr" data-i="${i}" data-v="0" aria-label="Lancer ${i + 1} raté">✗</button></div></div>`).join('')}</div>
    </div></div>`;
  }
  const btn = (a, w) => `<button class="${a[2]} ${w}" data-x="act" data-a="${a[0]}"${ui.sel ? '' : ' aria-disabled="true"'}>${SOFT[a[0]] || a[1]}</button>`;
  return `<div class="actbar fix"><div class="in">
    <small>${ui.sel ? `<span>Actions de <b>${playerName(ui.sel)}</b></span><button class="lk" data-x="desel">Fermer</button>` : 'Touche un joueur, puis son action'}</small>
    <div class="acts two${ui.sel ? '' : ' idle'}">
      ${ROW1.map(a => btn(a, 'c3')).join('')}${ROW2.map(a => btn(a, 'c4')).join('')}
    </div>
  </div></div>`;
}

// Ballons gagnés : un bouton de notre bloc, à côté des rebonds (c'est une stat d'équipe, le joueur
// sélectionné n'y est pour rien). Il ouvre ses quatre choix juste dessous, sous le doigt, au lieu
// de les envoyer dans la barre du bas.
function wonButton() {
  const total = WON.reduce((s, w) => s + cnt(w[0], S.q), 0);
  const pop = ui.won ? `<div class="wonpop" role="menu" aria-label="Ballon gagné">
      <div class="wph"><b>Ballon gagné</b><button class="wpx" data-x="wonx" aria-label="Fermer">✕</button></div>
      <div class="wpb">${WON.map(w => `<button role="menuitem" data-x="tact" data-a="${w[0]}">${w[1]}<b>${cnt(w[0], S.q)}</b></button>`).join('')}</div>
    </div>` : '';
  return `<div class="wonw${ui.won ? ' open' : ''}"><button class="tb won" data-x="wonopen" aria-expanded="${!!ui.won}" aria-label="Ballon gagné : choisir le type">`
    + `<small><span class="lg">Ballon gagné</span><span class="sh">Gagné</span></small><b>${total}</b></button>${pop}</div>`;
}

// Bloc d'équipe compact : « Rebonds » à gauche et le nom centré sur la même ligne, puis les boutons.
const teamBlock = (cls, name, color, list, label, extra = '') => `<div class="${cls}${isLight(color) ? ' lt' : ''}" style="${colorVars(color)}">
    <div class="tbg"><div class="tbh"><small>Rebonds</small><div class="nm">${esc(name)}</div></div><div class="tbs">`
  + list.map(w => `<button class="tb" data-x="tact" data-a="${w[0]}" aria-label="Ajouter : ${label} ${w[1]}"><small><span class="tbp">+</span> <span class="lg">${w[1]}</span><span class="sh">${w[1].slice(0, 3)}.</span></small><b>${cnt(w[0], S.q)}</b></button>`).join('')
  + extra + '</div></div></div>';

function playerButton(p, r, stk, mode, nm) {
  let c = [];
  if (mode === 'all') c = SG.filter(k => r[k[0]] > 0);
  else if (mode === 'last') {
    const e = lastAction(p.n, S.q);
    if (e) c = SG.filter(k => k[0] === e.a);
  }
  const chips = c.length ? `<div class="sg">${c.map(k => `<span class="${k[2]}">${k[1]} ${r[k[0]]}</span>`).join('')}</div>` : '';
  return `<button class="pl${stk ? ' st' : ''}${c.length ? '' : ' ns'}${ui.sel === p.n && !ui.dyn ? ' on' : ''}" data-x="pl" data-p="${esc(p.n)}">`
    + `<b>${esc(p.n)}</b><span>${esc(nm) || '&nbsp;'}</span>${chips}</button>`;
}

export function playLock() {
  const T = tally(S.q);
  const stk = S.layout === 'stack', mode = statsMode(), shw = mode !== 'off';
  const last = S.ev[S.ev.length - 1], names = shortNames(allP());

  return `<div class="top slim">
    ${teamBlock('me', S.me, myColor(), TEAM_REB, 'Rebond', wonButton())}
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
    ${teamBlock('opp', S.opp, oppColor(), OPP_REB, 'Rebond adverse')}
  </div>
  ${shw ? `<div class="qnote">Stats du quart en cours : ${qLabel(S.q)}</div>` : ''}
  <div class="grid${stk ? ' stk' : ''}${ui.dyn ? ' lock' : ''}">
    ${allP().filter(p => p.in).map(p => playerButton(p, T[p.n], stk, mode, names[p.n])).join('')}
  </div>
  ${actbar()}`;
}
