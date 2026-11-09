// Morceaux d'interface partagés entre plusieurs écrans.

import { S } from '../state.js';
import { WON } from '../constants.js';
import { esc, qLabel } from '../util.js';
import { periods, tally, cnt, miss, curTeamColor, oppInk } from '../model.js';

export const back = (label, x, v) =>
  `<button class="btn alt" data-x="${x}"${v ? ` data-v="${v}"` : ''}>‹ ${label}</button>`;

// Pastilles de choix de période : « Tout », Q1, Q2…
export function periodChips(cur, x, allLabel) {
  return `<div class="chips"><button class="chip${cur === 'all' ? ' on' : ''}" data-x="${x}" data-q="all">${allLabel}</button>`
    + periods().map(p => `<button class="chip${cur == p ? ' on' : ''}" data-x="${x}" data-q="${p}">${qLabel(p)}</button>`).join('')
    + '</div>';
}

// Boutons d'export (sans espace entre eux, comme avant).
export const exportButtons = () => [
  '<button class="btn" data-x="share">Partager une image des stats</button>',
  '<button class="btn" data-x="pdf">Exporter en PDF</button>',
].join('');

// Envoi du match à un autre utilisateur de l'appli.
export const sendCard = () => `<div class="card">
  <h2>Envoyer le match</h2>
  <p class="help" style="margin:0 0 10px">Pour un autre coach qui utilise Pick&amp;Stats : il pourra l’ajouter à ses matchs archivés et retrouver toutes les stats.</p>
  <button class="btn" data-x="sendlink">Envoyer un lien</button><button class="btn" data-x="sendfile">Envoyer un fichier</button>
</div>`;

// Tableaux de stats pour une période (null = tout le match).
export function tables(q) {
  const T = Object.values(tally(q));
  const s = k => T.reduce((a, r) => a + r[k], 0);
  const td = v => `<td>${v}</td>`;
  const row = r => `<tr><td>#${esc(r.n)} ${esc(r.name)}</td>${[r.stl, r.fd, r.to, r.trav].map(td).join('')}`
    + `<td><b>${miss(r)}</b></td>${[r.m2, r.m3, r.m1].map(td).join('')}</tr>`;
  const won = WON.map(w => cnt(w[0], q));
  const head = ['Joueur', 'Interc.', 'Fautes prov.', 'Balles perdues', 'Marchers', 'Ratés', 'dont 2 pts', 'dont 3 pts', 'dont LF'];

  return `<table>
    <tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>
    ${T.map(row).join('')}
    <tr class="tot"><td>Équipe</td>${[s('stl'), s('fd'), s('to'), s('trav'), s('m1') + s('m2') + s('m3'), s('m2'), s('m3'), s('m1')].map(td).join('')}</tr>
  </table>
  <table class="mt">
    <tr><th>Rebonds</th><th>Offensifs</th><th>Défensifs</th><th>Total</th></tr>
    <tr><td>${esc(S.me)}</td><td>${cnt('ro', q)}</td><td>${cnt('rd', q)}</td><td><b>${cnt('ro', q) + cnt('rd', q)}</b></td></tr>
    <tr><td>${esc(S.opp)}</td><td>${cnt('orb', q)}</td><td>${cnt('odr', q)}</td><td><b>${cnt('orb', q) + cnt('odr', q)}</b></td></tr>
  </table>
  <table class="mt">
    <tr><th>Ballons gagnés</th><th>5 s</th><th>8 s</th><th>24 s</th><th>Récupérés</th><th>Total</th></tr>
    <tr><td>${esc(S.me)}</td>${won.map(td).join('')}<td><b>${won.reduce((a, b) => a + b, 0)}</b></td></tr>
  </table>`;
}

// --- Stats à l'écran (le PDF garde les tableaux simples ci-dessus) ---

// Valeur d'une cellule : 0 en discret, le meilleur de la colonne mis en avant.
const cell = (v, top, cls) => (top && v
  ? `<td><span class="best ${cls}">${v}</span></td>`
  : `<td class="${v ? '' : 'z'}">${v}</td>`);

// Colonnes du tableau des joueurs : [clé, en-tête, groupe]
const COLS = [
  ['stl', 'Interc.', 'n'], ['fd', 'Fautes prov.', 'n'],
  ['to', 'Balles perdues', 'f'], ['trav', 'Marchers', 'f'],
  ['miss', 'Total', 'r'], ['m2', '2 pts', 'r'], ['m3', '3 pts', 'r'], ['m1', 'LF', 'r'],
];

// Barre « nous / eux » pour comparer deux valeurs.
function duel(label, us, them) {
  const t = us + them, p = t ? Math.round(us / t * 100) : 50;
  return `<div class="duel"><div class="dl"><b>${us}</b><span>${label}</span><b>${them}</b></div>
    <div class="dbar"><i style="width:${p}%"></i></div></div>`;
}

export function statsView(q) {
  const T = Object.values(tally(q)).map(r => ({ ...r, miss: miss(r) }));
  const s = k => T.reduce((a, r) => a + r[k], 0);
  const max = k => Math.max(0, ...T.map(r => r[k]));
  const won = WON.map(w => cnt(w[0], q)), wonT = won.reduce((a, b) => a + b, 0);
  const ro = cnt('ro', q), rd = cnt('rd', q), orb = cnt('orb', q), odr = cnt('odr', q);
  const col = curTeamColor();

  const tile = (v, label, cls) => `<div class="tile ${cls}"><b>${v}</b><span>${label}</span></div>`;
  const tiles = `<div class="tiles">
    ${tile(s('stl'), 'Interceptions', 'n')}${tile(s('fd'), 'Fautes provoquées', 'n')}
    ${tile(s('to') + s('trav'), 'Pertes de balle', 'f')}${tile(s('miss'), 'Tirs ratés', 'r')}
    ${tile(ro + rd, 'Rebonds', 'n')}${tile(wonT, 'Ballons gagnés', 'n')}
  </div>`;

  const M = Object.fromEntries(COLS.map(([k]) => [k, max(k)]));
  const rows = T.map(r => `<tr><th scope="row"><span class="pn" style="background:${col}">${esc(r.n)}</span>${esc(r.name) || '<span class="z">—</span>'}</th>`
    + COLS.map(([k, , g]) => cell(r[k], r[k] === M[k], g)).join('') + '</tr>').join('');
  const table = `<div class="tscroll"><table class="st">
    <thead>
      <tr class="grp"><th></th><th colspan="2" class="g n">Positif</th><th colspan="2" class="g f">Pertes</th><th colspan="4" class="g r">Tirs ratés</th></tr>
      <tr><th>Joueur</th>${COLS.map(([, h, g]) => `<th class="${g}">${h}</th>`).join('')}</tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="9" class="z">Aucun joueur</td></tr>`}</tbody>
    <tfoot><tr><th scope="row">Équipe</th>${COLS.map(([k]) => `<td>${s(k)}</td>`).join('')}</tr></tfoot>
  </table></div>
  <p class="help tnote">Le plus haut total de chaque colonne est surligné.</p>`;

  const reb = `<div class="sbox"><h3>Rebonds</h3>
    <div class="dhead"><span style="color:${col}">${esc(S.me)}</span><span class="them" style="color:${oppInk()}">${esc(S.opp)}</span></div>
    ${duel('Offensifs', ro, orb)}${duel('Défensifs', rd, odr)}${duel('Total', ro + rd, orb + odr)}</div>`;
  const wonBox = `<div class="sbox"><h3>Ballons gagnés</h3><div class="wgrid">
    ${WON.map((w, i) => `<div><b>${won[i]}</b><span>${w[1]}</span></div>`).join('')}
    <div class="wt"><b>${wonT}</b><span>Total</span></div></div></div>`;

  return `<div class="statsv" style="--tc:${col};--b:${oppInk()}">${tiles}${table}<div class="sboxes">${reb}${wonBox}</div></div>`;
}
