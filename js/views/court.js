// Joueurs sur le terrain, sur l'écran de saisie.
// Sans terrain choisi : une seule grille, comme avant. Avec : les joueurs sur le terrain en grand,
// le banc en petit dessous (toujours touchable : un changement oublié ne doit pas bloquer la
// saisie). En mode changements : tous les joueurs, chaque appui entre ou sort.
// Rien n'est enregistré dans le match : le terrain ne sert qu'à l'affichage.

import { S, ui } from '../state.js';
import { esc, qLabel } from '../util.js';
import { allP } from '../model.js';

// Joueurs sur le terrain : ceux de S.court encore présents au match.
export const onCourt = present => (S.court || []).filter(n => present.some(p => p.n === n));

// button(p, r, stk, mode, nm) : le bouton joueur, fourni par play.js.
// lock : classe ajoutée aux grilles (contour du mode dynamique).
export function playersBlock({ T, stk, mode, shw, names, button, lock = '' }) {
  const present = allP().filter(p => p.in), court = onCourt(present);
  const bar = `<div class="qnote crow"><span>${shw ? `Stats du quart en cours : ${qLabel(S.q)}` : ''}</span>`
    + `<button class="subsbtn${ui.subs ? ' on' : ''}" data-x="subs">${ui.subs ? 'Terminé' : court.length ? `Terrain ${court.length}/5 · Changer` : 'Qui est sur le terrain ?'}</button></div>`;

  if (ui.subs) {
    return bar + `<div class="grid subs${stk ? ' stk' : ''}">`
      + present.map(p => `<button class="pl${stk ? ' st' : ''} ns${court.includes(p.n) ? ' oncourt' : ''}" data-x="sub" data-p="${esc(p.n)}" aria-pressed="${court.includes(p.n)}">`
        + `<b>${esc(p.n)}</b><span>${esc(names[p.n]) || '&nbsp;'}</span></button>`).join('')
      + '</div>';
  }
  if (!court.length) {
    return bar + `<div class="grid${stk ? ' stk' : ''}${lock}">`
      + present.map(p => button(p, T[p.n], stk, mode, names[p.n])).join('') + '</div>';
  }
  const bench = present.filter(p => !court.includes(p.n));
  return bar + `<div class="grid court${stk ? ' stk' : ''}${lock}">`
    + present.filter(p => court.includes(p.n)).map(p => button(p, T[p.n], stk, mode, names[p.n])).join('') + '</div>'
    + (bench.length ? `<div class="bench${lock}"><small>Banc</small><div class="bgrid">`
      + bench.map(p => button(p, T[p.n], false, 'off', names[p.n]).replace('class="pl', 'class="pl bn')).join('') + '</div></div>' : '');
}

// Barre du bas en mode changements. cls : classes de la barre de l'écran.
export function subsBar(cls) {
  const k = onCourt(allP().filter(p => p.in)).length;
  return `<div class="${cls} subsbar"><div class="in">
      <small><span>Changements · <b>${k}/5</b> sur le terrain</span><button class="lk" data-x="subclr"${k ? '' : ' disabled'}>Tout sortir</button></small>
      <p class="subshelp">Touche un joueur pour le faire <b>entrer</b> ou <b>sortir</b>. Les joueurs sur le terrain s’affichent en grand pendant la saisie, le banc en petit dessous.</p>
      <div class="acts"><button class="n subsok" data-x="subsx">Terminé</button></div>
    </div></div>`;
}
