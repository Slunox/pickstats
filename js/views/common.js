// Morceaux d'interface partagés entre plusieurs écrans.

import { S, withMatch } from '../state.js';
import { WON } from '../constants.js';
import { esc, qLabel } from '../util.js';
import { periods, tally, cnt, miss, curTeamColor, oppInk, allP, shortNames, seasonGames } from '../model.js';
import { emStats, emTable, emMade } from './emstats.js';

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

// Chiffres d'équipe des tuiles (saisie Pick&Stats), pour une période (null = tout le match).
// up : true si « plus » est mieux, false si « moins » est mieux.
const TILES = [
  ['stl', 'Interceptions', 'n', true], ['fd', 'Fautes provoquées', 'n', true],
  ['lost', 'Pertes de balle', 'f', false], ['miss', 'Tirs ratés', 'r', false],
  ['reb', 'Rebonds', 'n', true], ['won', 'Ballons gagnés', 'n', true],
];
function teamVals(q) {
  const T = Object.values(tally(q)), s = k => T.reduce((a, r) => a + (r[k] || 0), 0);
  return {
    stl: s('stl'), fd: s('fd'), lost: s('to') + s('trav'), miss: T.reduce((a, r) => a + miss(r), 0),
    reb: cnt('ro', q) + cnt('rd', q), won: WON.reduce((a, w) => a + cnt(w[0], q), 0),
  };
}

// Moyenne de la saison pour l'équipe du match affiché (voir seasonGames).
function seasonAvg() {
  const G = seasonGames();
  if (!G) return null;
  const V = G.list.map(m => withMatch(m, () => teamVals(null)));
  return Object.fromEntries(TILES.map(([k]) => [k, V.reduce((a, v) => a + v[k], 0) / V.length]));
}

// Tuiles de la feuille e-Marque : adresse à 2 pts, 3 pts, LF (réussis de la feuille, ratés de la saisie)
// et fautes (match entier seulement : la feuille ne les donne pas par quart-temps). [clé, libellé, plus = mieux, pourcentage]
const EM_TILES = [['p2', 'Tirs à 2 pts', true, true], ['p3', 'Tirs à 3 pts', true, true], ['lf', 'Lancers francs', true, true], ['f', 'Fautes', false]];
function emVals(q = null) {
  const u = emMade(q);
  if (!u) return null;
  const T = Object.values(tally(q)), s = k => T.reduce((a, r) => a + (r[k] || 0), 0);
  const sh = (m, a) => ({ m, a, v: a ? 100 * m / a : null });
  const p2 = u.p2i + u.p2e;
  return { p2: sh(p2, p2 + s('m2')), p3: sh(u.p3, u.p3 + s('m3')), lf: sh(u.lf, u.lf + s('m1')), f: { v: q == null ? u.f : null } };
}
// Moyenne de la saison sur les autres matchs qui ont une feuille (au moins 2 par chiffre).
function emAvg() {
  const G = seasonGames();
  if (!G) return null;
  const V = G.list.filter(m => m.em && m.em.us).map(m => withMatch(m, () => emVals(null)));
  return Object.fromEntries(EM_TILES.map(([k]) => {
    const L = V.map(v => v[k].v).filter(x => x != null);
    return [k, L.length >= 2 ? L.reduce((a, x) => a + x, 0) / L.length : null];
  }));
}
function emTiles(q = null) {
  const V = emVals(q);
  if (!V) return '';
  const A = q == null ? emAvg() : null; // comparaison sur le match entier seulement
  const list = EM_TILES.filter(([k]) => V[k].v != null || k !== 'f');
  return `<div class="tiles emtiles${list.length < 4 ? ' three' : ''}">${list.map(([k, label, up, pct]) => {
    const x = V[k], big = x.v == null ? '–' : pct ? Math.round(x.v) + ' %' : x.v;
    return `<div class="tile ${pct ? 'n' : 'f'}"><b>${big}</b><span>${label}${pct && x.a ? ` · ${x.m}/${x.a}` : ''}</span>`
      + `${A && A[k] != null && x.v != null ? vsAvg(x.v, A[k], up, pct) : ''}</div>`;
  }).join('')}</div>`;
}

// Écart à la moyenne sous une tuile : « ▲ +3 (moy. 9,5) », en points pour un pourcentage : « ▼ −4 pts (moy. 52 %) »
const fmt1 = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
function vsAvg(v, a, up, pct = false) {
  const d = v - a, near = pct ? Math.abs(d) < 2 : Math.abs(d) < Math.max(0.5, a * 0.05);
  const avg = pct ? Math.round(a) + ' %' : fmt1(a);
  if (near) return `<small class="avg eq">≈ moyenne (${avg})</small>`;
  const good = (d > 0) === up, gap = pct ? Math.round(Math.abs(d)) + ' pts' : fmt1(Math.abs(d));
  return `<small class="avg ${good ? 'up' : 'down'}">${d > 0 ? '▲ +' : '▼ −'}${gap} <span>(moy. ${avg})</span></small>`;
}

// part : 'all' (tout, écran du match en cours), 'team' (tuiles, rebonds, ballons gagnés)
// ou 'players' (tableaux par joueur).
export function statsView(q, part = 'all') {
  const T = Object.values(tally(q)).map(r => ({ ...r, miss: miss(r) }));
  const nm = shortNames(allP()); // prénom, + initiale du nom si deux joueurs ont le même
  const s = k => T.reduce((a, r) => a + r[k], 0);
  const max = k => Math.max(0, ...T.map(r => r[k]));
  const won = WON.map(w => cnt(w[0], q)), wonT = won.reduce((a, b) => a + b, 0);
  const ro = cnt('ro', q), rd = cnt('rd', q), orb = cnt('orb', q), odr = cnt('odr', q);
  const col = curTeamColor();

  // Tuiles d'équipe, comparées à la moyenne de la saison sur le match entier
  const V = teamVals(q), A = q == null ? seasonAvg() : null;
  const tiles = `<div class="tiles">${TILES.map(([k, label, cls, up]) =>
    `<div class="tile ${cls}"><b>${V[k]}</b><span>${label}</span>${A ? vsAvg(V[k], A[k], up) : ''}</div>`).join('')}</div>`;

  const M = Object.fromEntries(COLS.map(([k]) => [k, max(k)]));
  const rows = T.map(r => `<tr><th scope="row"><span class="pn" style="background:${col}">${esc(r.n)}</span>${esc(nm[r.n] || r.name) || '<span class="z">—</span>'}</th>`
    + COLS.map(([k, , g]) => cell(r[k], r[k] === M[k], g)).join('') + '</tr>').join('');
  const table = `<div class="tscroll"><table class="st">
    <thead>
      <tr class="grp"><th></th><th colspan="2" class="g n">Positif</th><th colspan="2" class="g f">Pertes</th><th colspan="4" class="g r">Tirs ratés</th></tr>
      <tr><th>Joueur</th>${COLS.map(([, h, g]) => `<th class="${g}">${h}</th>`).join('')}</tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="9" class="z">Aucun joueur</td></tr>`}</tbody>
    <tfoot><tr><th scope="row">Équipe</th>${COLS.map(([k]) => `<td>${s(k)}</td>`).join('')}</tr></tfoot>
  </table></div>`;

  const reb = `<div class="sbox"><h3>Rebonds</h3>
    <div class="dhead"><span style="color:${col}">${esc(S.me)}</span><span class="them" style="color:${oppInk()}">${esc(S.opp)}</span></div>
    ${duel('Offensifs', ro, orb)}${duel('Défensifs', rd, odr)}${duel('Total', ro + rd, orb + odr)}</div>`;
  const wonBox = `<div class="sbox"><h3>Ballons gagnés</h3><div class="wgrid">
    ${WON.map((w, i) => `<div><b>${won[i]}</b><span>${w[1]}</span></div>`).join('')}
    <div class="wt"><b>${wonT}</b><span>Total</span></div></div></div>`;

  const boxes = `<div class="sboxes">${reb}${wonBox}</div>`;
  const body = part === 'team' ? emTiles(q) + tiles + boxes
    : part === 'players' ? emTable(q) + `<h3 class="sth">Actions saisies</h3>${table}`
    : (q == null ? emStats() : '') + tiles + table + boxes;
  return `<div class="statsv" style="--tc:${col};--b:${oppInk()}">${body}</div>`;
}
