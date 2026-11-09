// Lecture du « résumé » PDF de l'e-Marque V2 (FFBB).
//
// Ce PDF ne contient pas de texte : chaque caractère y est dessiné comme une forme.
// On récupère ces formes avec pdf.js, puis on reconnaît les caractères en les comparant
// à des modèles (GLYPHS, relevés sur de vrais PDF). Les chiffres sont fiables ; pour les lettres,
// une forme inconnue donne « ? » (les noms restent à vérifier). Les joueurs d'un match sont
// associés par numéro de maillot.

import { GLYPHS } from './emarque-glyphs.js';

let pdfReady = null;

// Charge pdf.js (fourni avec l'appli, pour fonctionner hors connexion) au premier import.
export function loadPdfJs() {
  if (!pdfReady) {
    pdfReady = new Promise((ok, ko) => {
      if (window.pdfjsLib) return ok(window.pdfjsLib);
      const s = document.createElement('script');
      s.src = new URL('./vendor/pdf.min.js', import.meta.url).href;
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.js', import.meta.url).href;
        ok(window.pdfjsLib);
      };
      s.onerror = () => { pdfReady = null; ko(new Error('Impossible de charger le lecteur de PDF.')); };
      document.head.appendChild(s);
    });
  }
  return pdfReady;
}

const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];

const bbox = P => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let k = 0; k < P.length; k += 2) {
    x0 = Math.min(x0, P[k]); x1 = Math.max(x1, P[k]);
    y0 = Math.min(y0, P[k + 1]); y1 = Math.max(y1, P[k + 1]);
  }
  return { x0, y0, x1, y1 };
};

// Un tracé de texte (un mot) contient plusieurs contours : on les regroupe en caractères
// (contours qui se chevauchent horizontalement : le trou du « 0 », les deux points du « : »).
function toGlyphs(contours) {
  contours.forEach(c => Object.assign(c, bbox(c.P)));
  contours.sort((a, b) => a.x0 - b.x0);
  const out = [];
  contours.forEach(c => {
    const g = out[out.length - 1];
    const ov = g ? Math.min(g.x1, c.x1) - Math.max(g.x0, c.x0) : -1;
    if (g && ov > 0.3 * Math.min(g.x1 - g.x0, c.x1 - c.x0)) { g.parts.push(c); g.x1 = Math.max(g.x1, c.x1); }
    else out.push({ parts: [c], x0: c.x0, x1: c.x1 });
  });
  return out.map(g => {
    g.parts.sort((a, b) => (a.x0 - b.x0) || (b.y1 - a.y1));
    const P = g.parts.flatMap(c => c.P);
    const b = bbox(P), h = b.y1 - b.y0 || 1;
    return { ...b, ops: g.parts.map(c => c.ops).join('|'), pts: P.map((v, k) => (k % 2 ? v - b.y0 : v - b.x0) / h) };
  });
}

// Tracés remplis d'une page : [{ x0, y0, x1, y1, glyphs }] (y vers le haut).
export async function pageRuns(pdfjs, page) {
  const O = pdfjs.OPS;
  const nPts = { [O.moveTo]: 1, [O.lineTo]: 1, [O.curveTo]: 3, [O.curveTo2]: 2, [O.curveTo3]: 2, [O.closePath]: 0, [O.rectangle]: 2 };
  const ol = await page.getOperatorList();
  const out = [];
  const stack = [];
  // col : couleur de remplissage, 'r' pour le rouge (1er et 3e quart-temps sur la marque courante), sinon 'k'
  let ctm = [1, 0, 0, 1, 0, 0], path = null, col = 'k';
  const isRed = a => {
    const v = typeof a[0] === 'string' ? [1, 3, 5].map(i => parseInt(a[0].slice(i, i + 2), 16)) : a.map(Number);
    return v[0] > 150 && v[1] < 100 && v[2] < 100;
  };
  ol.fnArray.forEach((f, i) => {
    const a = ol.argsArray[i];
    if (f === O.save) stack.push([ctm, col]);
    else if (f === O.restore) { const s = stack.pop(); if (s) [ctm, col] = s; }
    else if (f === O.setFillRGBColor) col = isRed(a) ? 'r' : 'k';
    else if (f === O.transform) ctm = mul(ctm, a);
    else if (f === O.constructPath) path = { ops: a[0], c: a[1], ctm };
    else if ((f === O.fill || f === O.eoFill) && path) {
      const m = path.ctm, contours = [];
      let cur = null, k = 0;
      Array.from(path.ops).forEach(o => {
        if (!(o in nPts)) return;
        if (o === O.moveTo || !cur) { cur = { ops: '', P: [] }; contours.push(cur); }
        cur.ops += nPts[o];
        for (let j = 0; j < nPts[o]; j++, k += 2) {
          const x = path.c[k], y = path.c[k + 1];
          cur.P.push(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]);
        }
      });
      const ok = contours.filter(c => c.P.length >= 6);
      if (ok.length) {
        const b = bbox(ok.flatMap(c => c.P));
        if (b.y1 - b.y0 < 14) out.push({ ...b, col, glyphs: toGlyphs(ok) });
      }
      path = null;
    } else if (f === O.endPath || f === O.stroke) path = null;
  });
  return out;
}

// Caractère reconnu pour une forme, sinon '?'.
export function classify(s, glyphs = GLYPHS) {
  let best = '?', bestD = 0.05;
  for (const g of glyphs) {
    if (g.ops !== s.ops || g.pts.length !== s.pts.length) continue;
    let d = 0;
    for (let k = 0; k < g.pts.length; k++) d += Math.abs(g.pts[k] - s.pts[k]);
    d /= g.pts.length;
    if (d < bestD) { bestD = d; best = g.c; }
  }
  return best;
}

// « I » majuscule et « l » minuscule ont la même forme : dans un mot qui contient des minuscules,
// ce n'est un « I » qu'en première lettre (« FIorent » → « Florent », mais « Ilan »).
const fixL = s => s.split(' ').map(w => (/[a-zà-ÿ]/.test(w) ? w[0] + w.slice(1).replace(/I/g, 'l') : w)).join(' ');

// Texte d'un tracé, avec les espaces (écart entre deux caractères supérieur au tiers de la hauteur).
function runText(r, cls) {
  const h = r.y1 - r.y0 || 1;
  return fixL(r.glyphs.map((g, i) => (i && (g.x0 - r.glyphs[i - 1].x1) / h > 0.33 ? ' ' : '') + cls(g)).join(''));
}

// Regroupe les formes en lignes puis en mots : [{ y, toks: [{ x, s, w }] }], de haut en bas.
// Chaque tracé de texte devient un mot (s : sans espace, w : avec les espaces) ;
// les mots sont rangés par ligne (centre vertical proche).
export function lines(runs, cls = classify) {
  const toks = runs.filter(r => r.y1 - r.y0 >= 3).map(r => {
    const w = runText(r, cls);
    return { x: r.x0, x1: r.x1, y: (r.y0 + r.y1) / 2, col: r.col, w, s: w.replace(/ /g, '') };
  });
  const rows = [];
  toks.sort((a, b) => b.y - a.y);
  toks.forEach(t => {
    const r = rows.find(r => Math.abs(r.y - t.y) < 3);
    if (r) r.toks.push(t); else rows.push({ y: t.y, toks: [t] });
  });
  rows.forEach(r => r.toks.sort((a, b) => a.x - b.x));
  return rows;
}

const isNum = s => /^\d+$/.test(s);
const isTime = s => /^\d{1,3}:\d\d$/.test(s);

// Lit les tableaux « LOCAUX » et « VISITEURS » du résumé.
// Ligne joueur : N°, nom (lettres), temps de jeu, puis 7 nombres :
// points, tirs réussis, 3 pts, 2 pts intérieur, 2 pts extérieur, LF réussis, fautes.
export function parseResume(allLines) {
  const teams = [];
  let cur = null;
  allLines.forEach(l => {
    const t = l.toks;
    const ti = t.findIndex(k => isTime(k.s));
    // Nombres en fin de ligne (après le temps de jeu ou le libellé)
    let s = t.length;
    while (s > 0 && isNum(t[s - 1].s)) s--;
    const tail = t.slice(s);
    if (tail.length < 7 || (ti >= 0 && ti !== s - 1)) return;
    const v = tail.slice(-7).map(k => +k.s);
    const row = { min: ti >= 0 ? t[ti].s : '', pts: v[0], fg: v[1], p3: v[2], p2i: v[3], p2e: v[4], lf: v[5], f: v[6] };
    const first = t[0];
    // Joueur : commence par un numéro suivi d'un nom (lettres)
    if (ti > 1 && isNum(first.s) && t.slice(1, ti).some(k => /\D/.test(k.s))) {
      if (!cur || cur.done) { cur = { players: [], totals: [] }; teams.push(cur); }
      cur.players.push({ n: String(+first.s), name: t.slice(1, ti).map(k => k.w).join(' '), ...row });
      return;
    }
    if (!cur) return;
    if (!cur.done && ti >= 0) { cur.total = row; cur.done = true; return; }
    if (cur.done) cur.totals.push(row);
  });
  return teams.filter(t => t.players.length && t.total).slice(0, 2).map(t => ({
    players: t.players,
    total: t.total,
    // Après le total : banc, 5 de départ, 1re mi-temps, 2e mi-temps, prolongation
    halves: t.totals.length >= 4 ? [t.totals[2].pts, t.totals[3].pts] : null,
    ot: t.totals.length >= 5 ? t.totals[4].pts : 0,
  }));
}

// Contrôles de cohérence (une erreur de lecture se voit presque toujours ici).
export function checkRow(r) {
  return r.pts === 3 * r.p3 + 2 * (r.p2i + r.p2e) + r.lf && r.fg === r.p3 + r.p2i + r.p2e;
}

// Noms des équipes d'après le nom du fichier : resume_0033_DM2_C_8818_EQUIPE_A-1_EQUIPE_B-3.pdf
export function namesFromFile(name) {
  const base = String(name || '').replace(/\.pdf$/i, '');
  const m = /^[a-z]+_[^_]+_[^_]+_[^_]+_(\d+)_(.+)$/i.exec(base);
  if (!m) return { num: '', a: '', b: '' };
  const rest = m[2];
  const cut = /-\d+_/.exec(rest);
  const tidy = s => s.replace(/_/g, ' ').trim();
  if (!cut) return { num: m[1], a: tidy(rest), b: '' };
  return { num: m[1], a: tidy(rest.slice(0, cut.index + cut[0].length - 1)), b: tidy(rest.slice(cut.index + cut[0].length)) };
}

// Page 2 du résumé, « Données et ratios » : avantage maximum, série maximum, points du banc
// (une ligne par donnée : libellé, locaux, visiteurs), puis le nombre d'égalités.
export function parseRatios(pageLines) {
  const rows = pageLines.filter(l => l.toks.length >= 2 && l.toks.slice(1).every(k => isNum(k.s)) && /\D/.test(l.toks[0].s));
  const two = rows.filter(l => l.toks.length === 3).slice(0, 3).map(l => [+l.toks[1].s, +l.toks[2].s]);
  if (two.length < 3) return null;
  // Le n° de rencontre (« masculine seniors | 8818 ») a aussi deux mots : on cherche le libellé « Égalités »
  const one = rows.find(l => l.toks.length === 2 && /galit/i.test(l.toks[0].s));
  return { adv: two[0], run: two[1], bench: two[2], ties: one ? +one.toks[1].s : null };
}

// Marque courante de la feuille de marque : chaque panier est noté par le numéro du joueur,
// à côté du score atteint (colonne A à gauche du score, colonne B à droite),
// en rouge aux 1er et 3e quarts-temps, en noir aux 2e et 4e.
export function parseFeuille(pageLines) {
  const cand = [];
  pageLines.forEach(l => {
    const t = l.toks;
    for (let i = 0; i + 1 < t.length; i++) {
      const a = t[i], b = t[i + 1];
      if (isNum(a.s) && a.s === b.s && b.x - a.x > 12 && b.x - a.x < 24) cand.push({ t, i, x: a.x });
    }
  });
  // Colonnes de score : positions où l'on trouve une longue suite de paires (au moins 10)
  const xs = cand.map(c => c.x).sort((a, b) => a - b), cols = [];
  xs.forEach(x => { const c = cols[cols.length - 1]; if (c && x - c.last < 4) { c.n++; c.last = x; } else cols.push({ first: x, last: x, n: 1 }); });
  const keep = cols.filter(c => c.n >= 10);
  const inCol = x => keep.some(c => x >= c.first - 1 && x <= c.last + 1);
  const ev = [[], []];
  cand.filter(c => inCol(c.x)).forEach(({ t, i }) => {
    const a = t[i], b = t[i + 1], pa = t[i - 1], pb = t[i + 2];
    if (pa && a.x - pa.x > 8 && a.x - pa.x < 24 && isNum(pa.s)) ev[0].push({ s: +a.s, n: String(+pa.s), c: pa.col });
    if (pb && pb.x - b.x > 8 && pb.x - b.x < 24 && isNum(pb.s)) ev[1].push({ s: +b.s, n: String(+pb.s), c: pb.col });
  });
  return ev;
}

// Découpe les paniers d'une équipe en quarts-temps (changement de couleur = nouveau quart-temps).
// Renvoie [{ pts, pl: { n: { pts, lf, p2, p3 } } }] ou null si incohérent.
export function periods(events, total, ot = 0) {
  const E = events.slice().sort((x, y) => x.s - y.s);
  const P = [];
  let prev = 0, cur = null;
  for (const e of E) {
    const d = e.s - prev;
    if (d < 1 || d > 3) return null;
    prev = e.s;
    if (!cur || cur.c !== e.c) { cur = { c: e.c, pts: 0, pl: {} }; P.push(cur); }
    cur.pts += d;
    const p = cur.pl[e.n] = cur.pl[e.n] || { pts: 0, lf: 0, p2: 0, p3: 0 };
    p.pts += d;
    p[d === 1 ? 'lf' : d === 2 ? 'p2' : 'p3']++;
  }
  if (prev !== total) return null;
  // Prolongation notée de la même couleur que le 4e quart-temps : on la sépare d'après le résumé
  if (ot && P.length === 4) { P[3].pts -= ot; P.push({ c: P[3].c, pts: ot, pl: {}, merged: true }); }
  if (P.length < 4 || P.length > 4 + (ot ? 3 : 0)) return null;
  return P.map(({ pts, pl, merged }) => ({ pts, pl, ...(merged ? { merged } : {}) }));
}

// Catégorie et sexe d'après l'en-tête du résumé (« Départementale masculine seniors - Division 2 »).
export function levelOf(pageLines) {
  const txt = (pageLines || []).slice(0, 12).flatMap(l => l.toks.map(k => k.w)).join(' ').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  const u = /\bu ?(\d{1,2})\b/.exec(txt);
  const cat = /senior/.test(txt) ? 'Sénior' : /veteran/.test(txt) ? 'Vétéran' : /loisir/.test(txt) ? 'Loisir'
    : u ? 'U' + (+u[1]) : /\bbaby/.test(txt) ? 'Baby' : '';
  const sex = /feminin/.test(txt) ? 'F' : /masculin/.test(txt) ? 'M' : /mixte/.test(txt) ? 'Mixte' : '';
  return { cat, sex };
}

// Nom d'un joueur pour l'effectif : « SARRABAYROUSE, Antoine » → « Antoine Sarrabayrouse ».
export function playerName(s) {
  const [nom, ...pre] = String(s || '').split(',');
  const p = pre.join(',').trim();
  return [p, tidyName(nom.trim())].filter(Boolean).join(' ');
}

// Numéro d'équipe en fin de nom : « ENTENTE PESSAC BASKET CLUB-3 » → « 3 ».
export const teamSuffix = s => (/-\s*(\d{1,2})\s*$/.exec(String(s || '')) || [])[1] || '';

async function pdfLines(pdfjs, file, maxPages) {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) pages.push(lines(await pageRuns(pdfjs, await doc.getPage(i))));
  return pages;
}

const NOT_RESUME = 'Il manque le résumé de l’e-Marque (fichier « resume_… .pdf »).';

// Lit les fichiers de l'e-Marque choisis : le résumé (obligatoire) et la feuille de marque (facultative,
// pour le score par quart-temps). Renvoie { num, a, b, teams, quarters, ratios, warn }.
export async function readEmarque(files) {
  const pdfjs = await loadPdfJs();
  const list = Array.from(files || []);
  const kind = f => (/^resume/i.test(f.name) ? 'r' : /^feuille/i.test(f.name) ? 'f' : /^position/i.test(f.name) ? 'p' : '?');
  let res = null, feuille = null, resFile = null;
  for (const f of list) {
    const k = kind(f);
    if (k === 'p') continue;
    const pages = await pdfLines(pdfjs, f, k === 'f' ? 1 : 3);
    const teams = k === 'f' ? [] : parseResume(pages.flat());
    if (teams.length === 2) { res = { teams, pages }; resFile = f; } else if (k !== 'r') feuille = pages[0];
  }
  if (!res) throw new Error(NOT_RESUME);
  const d = { ...namesFromFile(resFile.name), teams: res.teams, quarters: null, ratios: res.pages[1] ? parseRatios(res.pages[1]) : null, warn: [], level: levelOf(res.pages[0]) };
  if (feuille) {
    const ev = parseFeuille(feuille);
    const q = d.teams.map((t, i) => periods(ev[i], t.total.pts, t.ot));
    if (q[0] && q[1]) {
      d.quarters = q;
      // Contrôle : points de chaque joueur sur la marque courante = points du résumé
      const off = d.teams.flatMap((t, i) => t.players.filter(p => q[i].reduce((a, per) => a + ((per.pl[p.n] || {}).pts || 0), 0) !== p.pts));
      if (off.length) d.warn.push('Points par quart-temps à vérifier pour ' + off.map(p => '#' + p.n).join(', ') + ' (la marque courante ne correspond pas au résumé).');
    } else d.warn.push('Le score par quart-temps n’a pas pu être lu sur la feuille de marque.');
  }
  return d;
}

// --- Rattachement au match archivé ---

const words = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  .split(/[^A-Z0-9]+/).filter(w => w.length > 2 && !['CLUB', 'BASKET', 'BASKETBALL', 'ENTENTE', 'SPORTIVE', 'UNION', 'ASSOCIATION'].includes(w));
const common = (a, b) => { const B = new Set(words(b)); return words(a).filter(w => B.has(w)).length; };

// Quelle équipe du résumé est la nôtre (0 = locaux, 1 = visiteurs) ?
// D'après les noms (club, équipe, adversaire), sinon d'après les numéros de maillot.
export function guessSide(d, { ours = [], opp = '', nums = [] }) {
  const score = name => ours.reduce((a, o) => a + common(name, o), 0) - common(name, opp);
  const sa = score(d.a), sb = score(d.b);
  if (sa !== sb) return sa > sb ? 0 : 1;
  const N = new Set(nums.map(String));
  const hit = t => t.players.filter(p => N.has(p.n)).length / Math.max(1, t.players.length);
  return hit(d.teams[1]) > hit(d.teams[0]) ? 1 : 0;
}

// Nom lisible : « ENTENTE PESSAC BASKET CLUB-3 » → « Entente Pessac Basket Club-3 »
export const tidyName = s => String(s || '').toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase());

const ROW_KEYS = ['min', 'pts', 'fg', 'p3', 'p2i', 'p2e', 'lf', 'f'];
const pickRow = r => Object.fromEntries(ROW_KEYS.map(k => [k, r[k]]));

// Données enregistrées avec le match archivé (m.em).
export function toEm(d, side) {
  const team = i => {
    const t = d.teams[i], q = d.quarters && d.quarters[i], r = d.ratios;
    return {
      total: pickRow(t.total), halves: t.halves || null, ot: t.ot || 0,
      players: Object.fromEntries(t.players.map(p => [p.n, pickRow(p)])),
      // Points par quart-temps, et par joueur : { n: [{ pts, lf, p2, p3 } par quart-temps] }
      ...(q ? {
        q: q.map(p => p.pts),
        qp: Object.fromEntries(t.players.map(p => [p.n, q.map(per => per.pl[p.n] || { pts: 0, lf: 0, p2: 0, p3: 0 })])),
      } : {}),
      ...(r ? { adv: r.adv[i], run: r.run[i], bench: r.bench[i] } : {}),
    };
  };
  return {
    num: d.num || '', a: d.a || '', b: d.b || '', side,
    ...(d.ratios && d.ratios.ties != null ? { ties: d.ratios.ties } : {}),
    us: team(side),
    them: { name: (side ? d.a : d.b) || '', ...team(1 - side) },
  };
}
