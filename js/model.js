// Calculs sur les données : effectif, stats, équipes.

import { S, ui } from './state.js';
import { LBL, PK, CATS } from './constants.js';
import { cmpN, esc } from './util.js';

const inQ = (e, q) => q == null || e.q === q;

export const periods = () => {
  const m = Math.max(4, S.q, ...S.ev.map(e => e.q));
  return Array.from({ length: m }, (_, i) => i + 1);
};

// Tous les joueurs du match qui ont un numéro (sans doublon), triés.
export function allP() {
  return S.roster
    .filter(p => String(p.n).trim())
    .map(p => ({ n: String(p.n).trim(), name: String(p.name || '').trim(), ...withFirst(p), in: p.in !== false }))
    .filter((p, i, a) => a.findIndex(q => q.n === p.n) === i)
    .sort(cmpN);
}

// Joueurs à faire apparaître dans les stats : présents ou ayant des actions.
export const roster = () => allP().filter(p => p.in || S.ev.some(e => e.p === p.n));

export const roster1 = n => roster().find(r => r.n === n) || { n, name: '' };

// Numéro déjà pris par un autre joueur que celui d'indice i ?
export const dupN = (n, i) => {
  const v = String(n).trim();
  return v !== '' && S.roster.some((q, j) => j !== i && String(q.n).trim() === v);
};

// Stats par joueur pour une période (null = tout le match).
export function tally(q) {
  const o = {};
  roster().forEach(p => { o[p.n] = { ...p }; PK.forEach(k => { o[p.n][k] = 0; }); });
  S.ev.forEach(e => { if (inQ(e, q) && o[e.p] && PK.includes(e.a)) o[e.p][e.a]++; });
  return o;
}

export const cnt = (a, q) => S.ev.filter(e => e.a === a && inQ(e, q)).length;

export const miss = r => r.m1 + r.m2 + r.m3;

const isOpp = e => e.a === 'orb' || e.a === 'odr';

export const who = e => isOpp(e) ? S.opp
  : e.p === '__team' ? 'Équipe'
  : '#' + e.p + (roster1(e.p).name ? ' ' + roster1(e.p).name : '');

// Stats affichées sur les boutons joueurs : 'all' (toutes), 'last' (la dernière) ou 'off'.
// Les anciennes versions enregistraient true/false.
export const statsMode = () => (S.pstats === false || S.pstats === 'off' ? 'off' : S.pstats === 'last' ? 'last' : 'all');

// Dernière action individuelle d'un joueur pendant la période q.
export const lastAction = (n, q) => {
  for (let i = S.ev.length - 1; i >= 0; i--) {
    const e = S.ev[i];
    if (e.p === n && e.q === q && PK.includes(e.a)) return e;
  }
  return null;
};

export const evText = e => isOpp(e) ? LBL[e.a] : (e.p === '__team' ? 'Équipe' : '#' + e.p) + ' : ' + LBL[e.a];

// Prénom seul pour l'écran de saisie : « Antoine Sarrabayrouse » ou « SARRABAYROUSE Antoine » → « Antoine ».
// Si deux joueurs ont le même prénom, on ajoute l'initiale du nom (« Julian B. »).
const isCaps = w => /\p{L}/u.test(w) && w === w.toUpperCase();
// Premier mot qui ne fait pas un prénom à lui seul (« El Mehdi », « Abd El Kader »)
const JOINED = /^(el|al|abd)$/i;
function splitName(s) {
  const w = String(s || '').replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (w.length < 2) return { first: w[0] || '', last: '' };
  // « NOM Prénom » : les mots en majuscules en tête sont le nom
  let k = 0;
  while (k < w.length - 1 && isCaps(w[k])) k++;
  if (k > 0 && !isCaps(w[k])) return { first: w.slice(k).join(' '), last: w.slice(0, k).join(' ') };
  // Prénoms composés en deux mots : « El Mehdi Laiouej » → « El Mehdi »
  if (w.length > 2 && JOINED.test(w[0])) return { first: w.slice(0, 2).join(' '), last: w.slice(2).join(' ') };
  return { first: w[0], last: w.slice(1).join(' ') };
}
// Prénom et nom d'un joueur { name, first? }. first : prénom repris d'une feuille e-Marque (d'après sa
// virgule), utilisé tant que le nom commence par lui ; sinon (nom tapé ou modifié à la main), on devine.
export function nameParts(p) {
  const name = String(p.name || '').trim(), f = String(p.first || '').trim();
  if (f && name.toLowerCase().startsWith(f.toLowerCase() + ' ')) return { first: name.slice(0, f.length), last: name.slice(f.length).trim() };
  return splitName(name);
}
export const firstName = p => nameParts(p).first;
// Change le nom d'un joueur, avec son prénom s'il est connu (sinon on l'oublie : il ne correspond plus).
export function rename(p, name, first) { p.name = name; if (first) p.first = first; else delete p.first; }
// Champ « first » à recopier, seulement s'il existe (Firestore refuse les valeurs undefined).
export const withFirst = p => (p && p.first ? { first: p.first } : {});

export function shortNames(list) {
  const N = list.map(nameParts);
  const count = {};
  N.forEach(n => { const f = n.first.toLowerCase(); count[f] = (count[f] || 0) + 1; });
  return Object.fromEntries(list.map((p, i) => {
    const n = N[i];
    return [p.n, count[n.first.toLowerCase()] > 1 && n.last ? `${n.first} ${n.last[0].toUpperCase()}.` : n.first];
  }));
}

// Autres matchs archivés de la même équipe sur la même saison (août à juillet) que le match affiché
// (à appeler dans withMatch). null si le match affiché n'est pas archivé (match en cours : chiffres
// encore incomplets) ou s'il y a moins de `min` autres matchs.
export function seasonGames(min = 2) {
  const all = S.arch || [], cur = all.find(m => m.ev === S.ev);
  if (!cur) return null;
  const d = new Date(cur.date), y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  const from = new Date(y, 7, 1), to = new Date(y + 1, 7, 1);
  const same = m => (S.teamId && m.teamId ? m.teamId === S.teamId : m.me === S.me);
  const list = all.filter(m => m !== cur && same(m) && new Date(m.date) >= from && new Date(m.date) < to && (m.ev || []).length);
  return list.length < min ? null : { list, season: `${y}-${String(y + 1).slice(2)}` };
}

// --- Équipes ---

export function teamLabel(t) {
  if (t.cat === 'Autre') return String(t.suf || '').trim() || 'Équipe';
  return [t.cat, t.sex, String(t.suf || '').trim()].filter(Boolean).join(' ');
}

export const sortedTeams = () => S.teams.slice().sort((a, b) =>
  (CATS.indexOf(a.cat) - CATS.indexOf(b.cat))
  || String(a.sex || '').localeCompare(String(b.sex || ''))
  || String(a.suf || '').localeCompare(String(b.suf || ''), 'fr', { numeric: true }));

// Équipe en cours de modification
export const tm = () => S.teams.find(z => z.id === ui.tid);

// Équipe du match en cours
export const matchTeam = () => S.teams.find(z => z.id === S.teamId);

const byNumThenName = (a, b) => cmpN({ n: a.num || '' }, { n: b.num || '' }) || String(a.name).localeCompare(String(b.name));

export function sortPlayers() {
  const t = tm();
  if (t) t.players.sort(byNumThenName);
}

// Prépare la composition d'un match pour l'équipe id.
export function selTeam(id) {
  const t = S.teams.find(z => z.id === id);
  if (!t) return;
  ui.P.teamId = id;
  ui.P.rows = t.players.map(p => ({ id: p.id, name: p.name, ...withFirst(p), num: String(p.num || ''), in: true })).sort(byNumThenName);
}

// --- Matchs archivés ---

export const curG = () => (S.arch || []).find(m => String(m.id) === String(ui.gid));

export const inTeam = (m, t) => (m.teamId ? m.teamId === t.id : m.me === t.name);

// Couleur de repère d'une équipe, tirée de son identifiant : elle sert à la distinguer des autres
// d'un coup d'œil (pastille de la liste, cartes de match, filtres des archives). Ce n'est pas la
// couleur du maillot : dans un club, toutes les équipes jouent dans la même tenue (voir myColor).
// t : l'équipe, ou une simple clé (nom d'une équipe supprimée).
export function teamColor(t) {
  const s = String(t && typeof t === 'object' ? t.id : t || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const auto = ['#2563EB', '#DC2626', '#059669', '#7C3AED', '#D97706', '#DB2777', '#0891B2', '#4D7C0F'];
  return s ? auto[h % auto.length] : '#667279';
}

// --- Couleurs de maillot ---

// Maillots par famille : [clé, nom, couleur du repère, [[couleur, nom], …]].
// En deux temps — la famille, puis la nuance — on couvre 41 couleurs sans jamais en afficher
// plus de huit à la fois, et sans qu'il reste une teinte impossible à approcher.
const FAMILIES = [
  ['n', 'Neutres', '#9CA3AF', [['#FFFFFF', 'Blanc'], ['#F5F0E1', 'Crème'], ['#D1D5DB', 'Gris clair'],
    ['#9CA3AF', 'Gris'], ['#374151', 'Anthracite'], ['#111827', 'Noir']]],
  ['r', 'Rouges', '#DC2626', [['#EF4444', 'Rouge vif'], ['#DC2626', 'Rouge'], ['#B91C1C', 'Brique'],
    ['#881337', 'Bordeaux'], ['#5B0E22', 'Grenat']]],
  ['p', 'Roses', '#EC4899', [['#F9A8D4', 'Rose pâle'], ['#EC4899', 'Rose'], ['#D1197E', 'Fuchsia'],
    ['#9D174D', 'Framboise']]],
  ['o', 'Oranges', '#F97316', [['#FDBA74', 'Pêche'], ['#F97316', 'Orange'], ['#C2410C', 'Orange foncé'],
    ['#9A3412', 'Cuivre'], ['#78350F', 'Brun']]],
  ['j', 'Jaunes', '#FACC15', [['#FDE68A', 'Jaune pâle'], ['#FACC15', 'Jaune'], ['#EAB308', 'Or'],
    ['#A16207', 'Moutarde']]],
  ['v', 'Verts', '#16A34A', [['#A3E635', 'Citron'], ['#4ADE80', 'Vert clair'], ['#16A34A', 'Vert'],
    ['#059669', 'Émeraude'], ['#4D7C0F', 'Olive'], ['#14532D', 'Vert foncé']]],
  ['b', 'Bleus', '#2563EB', [['#7DD3FC', 'Ciel'], ['#38BDF8', 'Bleu ciel'], ['#0891B2', 'Cyan'],
    ['#0D9488', 'Turquoise'], ['#2563EB', 'Bleu'], ['#1E3A8A', 'Bleu marine']]],
  ['u', 'Violets', '#7C3AED', [['#C4B5FD', 'Lavande'], ['#7C3AED', 'Violet'], ['#6B21A8', 'Pourpre'],
    ['#4338CA', 'Indigo'], ['#581C87', 'Prune']]],
];

export const OPP_DEFAULT = '#C2410C';

// Les codes sont comparés en majuscules.
const up = c => String(c || '').toUpperCase();
const SHADES = FAMILIES.flatMap(f => f[3]);
// Nom d'une couleur quand elle est dans la liste, sinon son code.
const colorName = c => (SHADES.find(([x]) => x === up(c)) || [])[1] || up(c);

// Couleur claire (texte foncé nécessaire) ?
export function isLight(c) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || ''));
  if (!m) return false;
  const v = parseInt(m[1], 16), ch = [v >> 16, (v >> 8) & 255, v & 255].map(x => {
    x /= 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2] > 0.4;
}

// Notre maillot pour ce match (en cours, ou archivé affiché) : celui choisi pour la rencontre
// quand l'adversaire joue dans la même couleur, sinon celui du club.
// Repli pour les matchs d'avant la couleur de club : la couleur choisie à l'époque sur l'équipe,
// pour qu'un ancien rapport garde exactement l'aspect qu'il avait.
export function myColor() {
  const t = matchTeam();
  return S.myColor || S.clubColor || (t && t.color) || teamColor(t || S.me);
}

// Maillot de l'adversaire pour ce match.
export const oppColor = () => S.oppColor || OPP_DEFAULT;

// Couleur lisible sur fond blanc (texte, barres, dégradés) : les maillots clairs passent en gris.
export const ink = c => (isLight(c) ? '#667279' : c);
export const myInk = () => ink(myColor());
export const oppInk = (c = oppColor()) => ink(c);

// Variables CSS d'un bloc coloré : --c (fond), --ct (texte), --cx (texte sur bouton blanc).
export function colorVars(c) {
  const lt = isLight(c);
  return `--c:${c};--ct:${lt ? '#16242C' : '#fff'};--cx:${lt ? '#16242C' : c}`;
}

// Maillot dessiné à la couleur voulue. Le contour gris le détache aussi bien sur fond clair
// que sur fond sombre, maillot blanc ou noir compris.
const tee = c => `<svg class="jtee" viewBox="0 0 24 24" width="38" height="38" aria-hidden="true">`
  + `<path d="M9 2.5 4.5 5v4.8l3-1V21.5h9V8.8l3 1V5L15 2.5a3 3 0 0 1-6 0z"`
  + ` fill="${c || '#667279'}" stroke="#9CA3AF" stroke-width="1.1" stroke-linejoin="round"/></svg>`;

// Pastilles de maillot, en deux temps. D'abord les huit familles : celle qui contient la couleur
// en cours la montre, cochée. Puis les nuances de la famille ouverte, précédées d'un retour.
// Jamais plus de huit pastilles à l'écran ; sur un écran étroit, la ligne défile (voir le fondu).
// which : 'my' | 'opp' | 'club' ; cur : valeur posée ; def : valeur suivie à défaut.
const ACT = { my: 'mcol', opp: 'ocol', club: 'ccol' };
const tint = c => `background:${c};color:${isLight(c) ? '#16242C' : '#fff'}`;
const chip = (c, label, x, v, on) => `<button class="sw${on ? ' on' : ''}" style="${tint(c)}" data-x="${x}" data-v="${v}" aria-label="${esc(label)}" title="${esc(label)}"></button>`;

function swatches(cur, def, which) {
  const sel = up(cur || def);
  const fam = FAMILIES.find(f => f[0] === ui.jerseyFam);
  if (!fam) {
    return '<div class="swatches scroll">'
      + FAMILIES.map(([k, n, rep, list]) => {
        const here = list.some(([c]) => c === sel);
        return chip(here ? sel : rep, n, 'jfam', k, here);
      }).join('')
      + '</div><p class="help jhint">Touche une famille pour voir ses nuances.</p>';
  }
  return '<div class="swatches scroll">'
    + '<button class="sw back" data-x="jfam" data-v="" aria-label="Retour aux familles">‹</button>'
    + fam[3].map(([c, n]) => chip(c, n, ACT[which], c, sel === c)).join('')
    + `</div><p class="help jhint">${esc(fam[1])} · ${esc(colorName(sel) || 'aucune choisie')}</p>`;
}

// Maillot du club, dans son bloc d'en-tête (responsable).
export const clubSwatches = () => `<label>Couleur du maillot</label><div class="jpick">${tee(up(S.clubColor))}`
  + `<b>${esc(S.clubColor ? colorName(S.clubColor) : 'À choisir')}</b></div>`
  + swatches(S.clubColor, '', 'club')
  + '<p class="help">Celle de toutes les équipes du club. On peut en changer pour une rencontre, '
  + 'si l’adversaire joue dans la même couleur.</p>';

// Les maillots d'un match : une carte par équipe, et la palette de celle qui est sélectionnée.
// Une seule palette à l'écran, jamais deux. myCur / oppCur : valeurs en cours (null = le maillot
// du club / l'orange par défaut) ; meName / oppName : noms affichés sur les cartes.
export function jerseys(myCur, oppCur, meName, oppName) {
  const club = up(S.clubColor), mine = up(myCur || club), opp = up(oppCur || OPP_DEFAULT);
  const side = ui.jerseySide === 'my' ? 'my' : 'opp';
  const clash = !!mine && mine === opp;
  const card = (k, name, c, sub) => `<button class="jside${side === k ? ' on' : ''}" data-x="jside" data-v="${k}">`
    + `${tee(c)}<span class="jtx"><b>${esc(name)}</b><span>${esc(colorName(c) || 'À choisir')}${sub}</span></span></button>`;
  return `<label>Maillots</label><div class="jsides">`
    + card('my', meName || 'Mon équipe', mine, myCur ? ' · pour ce match' : '')
    + card('opp', oppName || 'Adversaire', opp, '')
    + '</div>'
    + (clash ? '<p class="emwarn">Les deux équipes ont la même couleur : c’est à l’équipe qui reçoit de changer de maillot.</p>' : '')
    + `<div class="jpal"><label>Couleur du maillot · ${esc(side === 'my' ? (meName || 'Mon équipe') : (oppName || 'Adversaire'))}</label>`
    + swatches(side === 'my' ? myCur : oppCur, side === 'my' ? club : OPP_DEFAULT, side)
    + (side === 'my' && myCur ? '<button class="link jback" data-x="mclub">Reprendre la couleur du club</button>' : '')
    + '</div>';
}
