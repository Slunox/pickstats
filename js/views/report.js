// Rapport du match : dossier de stats en plusieurs pages, à partir de la feuille e-Marque
// (points, tirs réussis, fautes, temps de jeu, score par quart-temps) et de la saisie
// (tirs ratés, interceptions, fautes provoquées, pertes de balle, rebonds, ballons gagnés).
// Le même rendu sert dans l'appli (une page à la fois) et pour le fichier HTML exporté (toutes les pages).

import { S, ui } from '../state.js';
import { esc, fdate } from '../util.js';
import { roster1, curTeamColor, oppColor, isLight, seasonGames } from '../model.js';
import { WON } from '../constants.js';

// --- Mise en forme ---

const fr1 = v => v.toFixed(1).replace('.', ',');
const pc = (m, a) => (a ? fr1(100 * m / a) + ' %' : '–');
const ma = (m, a) => (a ? `${m}/${a}` : '–');
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
const tone = (m, a) => (!a ? '' : m / a >= 0.5 ? 'good' : m / a < 0.35 ? 'low' : '');
const qName = i => (i < 4 ? 'Q' + (i + 1) : 'Prol.' + (i > 4 ? ' ' + (i - 3) : ''));
const first = s => String(s || '').split(/\s+/)[0];
const que = n => (/^[aeiouyéèêh]/i.test(n) ? 'qu’' : 'que ') + n;

// Nom court d'un club : « Entente Pessac Basket Club-3 » → « Pessac », « ES Blanquefort Basketball » → « Blanquefort »
const STOP = ['ENTENTE', 'SPORTIVE', 'SPORTIF', 'CLUB', 'BASKET', 'BASKETBALL', 'UNION', 'ASSOCIATION', 'ESPERANCE', 'STADE',
  'AVENIR', 'ETOILE', 'CERCLE', 'JEUNESSE', 'AMICALE', 'OLYMPIQUE', 'RACING', 'SAINT', 'SECTION'];
export function shortName(s) {
  const w = String(s || '').replace(/-\d+$/, '').split(/[\s-]+/)
    .find(x => x.length > 3 && !STOP.includes(x.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()));
  return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : String(s || '');
}

// --- Données ---

function build() {
  const em = S.em, us = em.us, th = em.them;
  const ev = S.ev || [];
  const c = (a, q, p) => ev.filter(e => e.a === a && (q == null || e.q === q) && (p == null || e.p === p)).length;
  const cs = (list, q, p) => list.reduce((s, a) => s + c(a, q, p), 0);
  const nq = us.q && th.q ? us.q.length : 0;

  // Tirs de l'équipe (q : indice du quart-temps, null = match)
  const made = q => {
    if (q == null) return { lf: us.total.lf, p2: us.total.p2i + us.total.p2e, p3: us.total.p3 };
    const o = { lf: 0, p2: 0, p3: 0 };
    Object.values(us.qp || {}).forEach(arr => { const x = arr[q]; if (x) { o.lf += x.lf; o.p2 += x.p2; o.p3 += x.p3; } });
    return o;
  };
  const shots = q => {
    const k = q == null ? null : q + 1, m = made(q);
    const m1 = c('m1', k), m2 = c('m2', k), m3 = c('m3', k);
    return { ...m, a1: m.lf + m1, a2: m.p2 + m2, a3: m.p3 + m3, fg: m.p2 + m.p3, afg: m.p2 + m.p3 + m2 + m3, miss1: m1 };
  };
  const ball = q => {
    const k = q == null ? null : q + 1;
    return {
      to: c('to', k), trav: c('trav', k), stl: c('stl', k), fd: c('fd', k), won: cs(WON.map(w => w[0]), k),
      ro: c('ro', k), rd: c('rd', k), orb: c('orb', k), odr: c('odr', k),
    };
  };

  // Joueurs : ceux de la feuille, plus ceux de la composition qui ont des actions
  const nums = [...new Set([...Object.keys(us.players || {}), ...ev.filter(e => e.p && e.p !== '__team').map(e => e.p)])];
  const players = nums.map(n => {
    const e = { min: '', pts: 0, p3: 0, p2i: 0, p2e: 0, lf: 0, f: 0, ...(us.players[n] || {}) };
    const m1 = c('m1', null, n), m2 = c('m2', null, n), m3 = c('m3', null, n);
    const p2 = e.p2i + e.p2e, a2 = p2 + m2, a3 = e.p3 + m3, afg = a2 + a3;
    const stl = c('stl', null, n), fd = c('fd', null, n), to = c('to', null, n), trav = c('trav', null, n);
    const byQ = (us.qp && us.qp[n] ? us.qp[n] : []).map((x, i) => {
      const mk = (x.p2 || 0) + (x.p3 || 0);
      return { m: mk, a: mk + c('m2', i + 1, n) + c('m3', i + 1, n) };
    });
    return {
      n, name: roster1(n).name, ...e, p2, a2, a3, fg: p2 + e.p3, afg, a1: e.lf + m1,
      ppt: afg ? (2 * p2 + 3 * e.p3) / afg : null, stl, fd, to, trav, bal: stl + fd - to - trav, byQ,
    };
  }).sort((a, b) => (b.pts - a.pts) || (+a.n - +b.n));

  const quarters = Array.from({ length: nq }, (_, i) => ({ i, us: us.q[i], th: th.q[i], s: shots(i), b: ball(i) }));
  let cum = [0, 0];
  quarters.forEach(q => { cum = [cum[0] + q.us, cum[1] + q.th]; q.cum = cum.slice(); });

  return { em, us, th, s: shots(null), b: ball(null), players, quarters };
}

// --- Graphiques (SVG simples, sans bibliothèque) ---

function bars(cats, series, fmt = v => v, max) {
  const W = 520, H = 230, top = 22, base = 204, n = cats.length, gw = (W - 12) / n;
  const M = max || Math.max(1, ...series.flatMap(s => s.vals.filter(v => v != null)));
  const bw = Math.min(34, (gw - 24) / series.length);
  let g = [0.25, 0.5, 0.75, 1].map(f => `<line x1="6" x2="${W - 6}" y1="${base - (base - top) * f}" y2="${base - (base - top) * f}" stroke="var(--rp-grid)"/>`).join('')
    + `<line x1="6" x2="${W - 6}" y1="${base}" y2="${base}" stroke="var(--rp-axis)"/>`;
  cats.forEach((cat, i) => {
    const cx = 6 + gw * i + gw / 2, x0 = cx - (bw * series.length + 4 * (series.length - 1)) / 2;
    series.forEach((s, j) => {
      const v = s.vals[i];
      if (v == null) return;
      const h = (base - top) * v / M, x = x0 + j * (bw + 4);
      g += `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${s.color}"><title>${esc(cat)} – ${esc(s.name)} : ${fmt(v)}</title></rect>`
        + `<text x="${(x + bw / 2).toFixed(1)}" y="${(base - h - 5).toFixed(1)}" text-anchor="middle" class="lbl">${fmt(v)}</text>`;
    });
    g += `<text x="${cx.toFixed(1)}" y="222" text-anchor="middle" class="ax">${esc(cat)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${g}</svg>`;
}

// W : largeur de dessin (plus petite = texte plus grand quand le graphique est dans une demi-colonne)
function stacked(rows, max, W = 620) {
  const L = W < 500 ? 70 : 150, R = 90, rh = 32;
  const M = max || Math.max(1, ...rows.map(r => r.parts.reduce((a, p) => a + p.v, 0)));
  let g = '';
  rows.forEach((r, i) => {
    const y = 2 + i * rh;
    let x = L;
    g += `<text x="${L - 8}" y="${y + 15}" text-anchor="end" class="lbl">${esc(r.label)}</text>`;
    r.parts.forEach(p => {
      if (!p.v) return;
      const w = (W - L - R) * p.v / M;
      g += `<rect x="${x.toFixed(1)}" y="${y}" width="${Math.max(w - 1, 1).toFixed(1)}" height="22" rx="2" fill="${p.color}"><title>${esc(r.label)} – ${esc(p.name)} : ${p.v} pts</title></rect>`;
      x += w;
    });
    g += `<text x="${(x + 6).toFixed(1)}" y="${y + 15}" class="ax">${esc(r.tail)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${rows.length * rh + 4}" width="100%" role="img">${g}</svg>`;
}

const legend = items => `<div class="rp-legend">${items.map(([c, l]) => `<span><i style="background:${c}"></i>${esc(l)}</span>`).join('')}</div>`;

// --- Analyse : facteurs du match ---
// Chaque facteur a un poids en points estimé, positif s'il est en notre faveur.
// La phrase sous le score cite les plus forts dans le sens du résultat ; « Ce qu'il faut retenir » donne le détail.

function factors(D) {
  const { us, th, b } = D, F = [];
  const add = (k, v) => F.push({ k, v });
  add('p3', 3 * (us.total.p3 - th.total.p3));
  add('p2', 2 * ((us.total.p2i + us.total.p2e) - (th.total.p2i + th.total.p2e)));
  add('lf', us.total.lf - th.total.lf);
  if (b.ro + b.orb) add('or', b.ro - b.orb);
  if (b.to + b.trav + b.stl + b.won) add('ball', (b.stl + b.won) - (b.to + b.trav));
  if (us.bench != null && th.bench != null) add('bench', (us.bench - th.bench) * 0.6);
  return F;
}
// Comment nommer un facteur dans la phrase : [en notre faveur, en notre défaveur, « malgré » (avantage), « malgré » (handicap)]
const FACT = {
  p3: ['l’adresse à 3 points', 'le tir à 3 points', 'une bonne adresse à 3 points', 'un tir à 3 points en difficulté'],
  p2: ['le jeu intérieur', 'les paniers à 2 points', 'un bon jeu intérieur', 'des paniers à 2 points difficiles'],
  lf: ['les lancers francs', 'les lancers francs', 'de bons lancers francs', 'des lancers francs moins réussis'],
  or: ['le rebond offensif', 'le rebond offensif adverse', 'un bon rebond offensif', 'trop de rebonds offensifs adverses'],
  ball: ['les ballons récupérés', 'les pertes de balle', 'beaucoup de ballons récupérés', 'trop de pertes de balle'],
  bench: ['le banc', 'le banc', 'un banc productif', 'un banc moins productif'],
};
const andList = l => (l.length > 1 ? l.slice(0, -1).join(', ') + ' et ' + l[l.length - 1] : l[0] || '');

// Bloc sous le score : un titre (résultat et scénario), puis quelques lignes étiquetées
// (le tournant, ce qui a fait la différence ou manqué, ce qui a tenu). Les chiffres détaillés sont dans les tuiles.
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function headline(D, names) {
  const { em, us, th, quarters } = D, [, T] = names, d = us.total.pts - th.total.pts, ad = Math.abs(d);
  let t = d > 0 ? (ad >= 20 ? 'Large victoire' : ad <= 3 ? 'Victoire arrachée' : 'Victoire')
    : d < 0 ? (ad >= 20 ? 'Lourde défaite' : ad <= 3 ? 'Défaite d’un souffle' : 'Défaite')
    : 'Match nul';
  // Scénario d'après l'avance maximale de chaque équipe (résumé e-Marque)
  if (us.adv != null && th.adv != null) {
    if (d < 0 && us.adv === 0) t += ` sans jamais mener${th.adv >= 8 ? `, jusqu’à ${th.adv} points de retard` : ''}`;
    else if (d > 0 && th.adv === 0) t += ' en menant de bout en bout';
    else if (d > 0 && th.adv >= 8) t += ` après avoir été mené de ${th.adv} points`;
    else if (d < 0 && us.adv >= 8) t += ` malgré jusqu’à ${us.adv} points d’avance`;
    else if (em.ties >= 3 && ad <= 8) t += ` dans un match accroché (${em.ties} égalités)`;
  }
  const rows = [];
  const F = factors(D);
  if (d !== 0) {
    const dir = Math.sign(d);
    // Le quart-temps qui a le plus pesé dans le sens du résultat
    const q = quarters.length ? quarters.reduce((a, x) => ((x.us - x.th) * dir > (a.us - a.th) * dir ? x : a)) : null;
    if (q && (q.us - q.th) * dir >= 6) rows.push(['', 'Le tournant', `${qName(q.i)} ${d > 0 ? 'gagné' : 'perdu'} ${q.us}-${q.th}`]);
    const top = F.filter(f => f.v * dir >= 4).sort((a, b) => b.v * dir - a.v * dir).slice(0, 2).map(f => FACT[f.k][d > 0 ? 0 : 1]);
    const against = F.filter(f => f.v * dir <= -6).sort((a, b) => a.v * dir - b.v * dir).slice(0, 2).map(f => FACT[f.k][d > 0 ? 1 : 0]);
    if (d > 0) {
      if (top.length) rows.push(['up', 'La différence', cap(andList(top))]);
      if (against.length) rows.push(['down', 'Malgré', cap(andList(against))]);
    } else {
      if (top.length) rows.push(['down', 'Ce qui a manqué', cap(andList(top))]);
      if (against.length) rows.push(['up', 'Ce qui a tenu', cap(andList(against))]);
    }
  } else {
    const plus = F.filter(f => f.v >= 4).sort((a, b) => b.v - a.v)[0], minus = F.filter(f => f.v <= -4).sort((a, b) => a.v - b.v)[0];
    if (plus) rows.push(['up', 'Avantage', cap(FACT[plus.k][0])]);
    if (minus) rows.push(['down', 'Handicap', cap(FACT[minus.k][1])]);
  }
  return `<div class="rp-story ${d > 0 ? 'win' : d < 0 ? 'loss' : ''}"><p class="rp-story-t">${t}.</p>`
    + (rows.length ? `<dl>${rows.map(([c, l, x]) => `<div class="${c}"><dt>${l}</dt><dd>${x}</dd></div>`).join('')}</dl>` : '')
    + '</div>';
}

// --- Ce qu'il faut retenir ---
// Constats { k (sujet), p (importance), tone (+1 point fort, −1 à travailler, 0 à noter), t (titre), x (texte) },
// rangés en deux colonnes « Points forts » / « À travailler » (5 au plus chacune) et une note.
// Phrases courtes, chiffres arrondis, et la moyenne de la saison quand l'écart compte.

const pct0 = (m, a) => (a ? Math.round(100 * m / a) + ' %' : '–');
const mins = s => (/^(\d+):/.exec(String(s || '')) || [])[1];

// Moyennes de la saison (voir seasonGames) pour les chiffres de SEASON_ROWS, null si pas assez de matchs.
function seasonAvgs() {
  const G = seasonGames();
  if (!G) return null;
  const V = G.list.map(seasonVals), A = {};
  SEASON_ROWS.forEach(([k]) => {
    const L = V.map(v => v[k]).filter(x => x != null);
    if (L.length >= 2) A[k] = L.reduce((a, x) => a + x, 0) / L.length;
  });
  return { avg: A, n: G.list.length, season: G.season };
}

function findings(D, names) {
  const { us, th, s, b, players, quarters } = D, [U, T] = names, C = [];
  const d = us.total.pts - th.total.pts, ad = Math.abs(d);
  const add = (k, p, tone, t, x) => C.push({ k, p, tone, t, x });
  const has = k => C.some(c => c.k === k);
  const hasEv = b.to + b.trav + b.stl + b.fd + b.ro + b.rd + b.orb + b.odr + s.a2 - s.p2 > 0;

  // Écart à la saison, ajouté en fin de phrase quand il compte : « , 10 de plus que la moyenne de la saison »
  const SA = seasonAvgs(), A = SA ? SA.avg : {};
  const n1 = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
  const gapOf = (k, v, pct) => {
    if (A[k] == null || v == null) return null;
    const g = v - A[k];
    return Math.abs(g) >= (pct ? 3 : Math.max(1, 0.1 * A[k])) ? g : null;
  };
  // tone : +1 pour un point fort, −1 pour un point à travailler ; l'écart n'est cité que s'il va dans le même sens
  const upOf = k => (SEASON_ROWS.find(r => r[0] === k) || [])[2];
  const vsSeason = (k, v, pct, tone) => {
    const g = gapOf(k, v, pct);
    if (g == null || (tone && ((g > 0) === upOf(k) ? 1 : -1) !== tone)) return '';
    const n = pct ? `${Math.round(Math.abs(g))} pts` : n1(Math.abs(g));
    return pct ? `, ${n} ${g > 0 ? 'au-dessus' : 'en dessous'} de la moyenne de la saison` : `, ${n} de ${g > 0 ? 'plus' : 'moins'} que la moyenne de la saison`;
  };

  // Quarts-temps : la fin d'un match serré, la remontée ou l'avance perdue, puis chaque quart-temps net
  if (quarters.length >= 4) {
    if (ad <= 5) {
      const last = quarters[quarters.length - 1], before = quarters[quarters.length - 2].cum;
      const wonLast = last.us > last.th, tone = last.us === last.th ? 0 : wonLast ? 1 : -1;
      add('end', 20, tone, d > 0 && wonLast ? 'Un final maîtrisé.' : 'Le dernier quart-temps.',
        `<b>${before[0]}-${before[1]}</b> avant le ${qName(last.i)}, ${wonLast ? 'gagné' : last.us < last.th ? 'perdu' : 'à égalité'} <b>${last.us}-${last.th}</b>`
        + `${d < 0 && wonLast ? ', mais pas assez pour revenir' : d > 0 && !wonLast ? ' : la victoire a tenu de peu' : ''}.`);
    }
    const lead = quarters.map(q => q.cum[0] - q.cum[1]);
    const low = Math.min(0, ...lead), high = Math.max(0, ...lead);
    if (d > 0 && low <= -6) {
      const q = quarters.find((x, i) => i > 0 && lead[i] - lead[i - 1] >= 6) || quarters[quarters.length - 1];
      add('back', 15, 1, 'La remontée.', `Mené de <b>${-low}</b> points, ${esc(U)} a renversé le match, surtout au ${qName(q.i)} (<b>${q.us}-${q.th}</b>).`);
    }
    if (d < 0 && high >= 6) add('lead', 15, -1, 'L’avance perdue.', `Jusqu’à <b>+${high}</b> à la fin d’un quart-temps, puis ${esc(T)} est revenu.`);
    const won = quarters.filter(q => q.us > q.th).length;
    const worstQ = quarters.reduce((a, q) => (q.us - q.th < a.us - a.th ? q : a));
    const bestQ = quarters.reduce((a, q) => (q.us - q.th > a.us - a.th ? q : a));
    // Le meilleur et le pire quart-temps s'ils sont nets ; les autres seulement s'ils sont très nets (8 points)
    quarters.forEach((q, i) => {
      const dq = q.us - q.th;
      if (i === quarters.length - 1 && has('end')) return;
      if (dq >= (q === bestQ ? 5 : 8)) {
        const shot = q.s.afg && q.s.fg / q.s.afg >= 0.45 ? `, à <b>${pct0(q.s.fg, q.s.afg)}</b> au tir` : '';
        add('q' + i, dq, 1, `Le ${qName(q.i)}.`, `Gagné <b>${q.us}-${q.th}</b>${shot}${d < 0 && won === 1 ? ', le seul quart-temps gagné' : ''}.`);
      } else if (dq <= (q === worstQ ? -6 : -8)) {
        const why = [q.s.afg && q.s.fg / q.s.afg < 0.4 ? `<b>${pct0(q.s.fg, q.s.afg)}</b> au tir` : '',
          q.b.to + q.b.trav >= 5 ? `<b>${q.b.to + q.b.trav}</b> pertes de balle` : ''].filter(Boolean).join(' et ');
        add('q' + i, -dq, -1, `Le ${qName(q.i)}.`, `Perdu <b>${q.us}-${q.th}</b>${why ? ', avec ' + why : ''}${d < 0 && q === worstQ ? ' : c’est là que l’écart s’est creusé' : ''}.`);
      }
    });
  }

  // Rebonds : offensifs d'abord, sinon défensifs, sinon le total
  if (b.ro + b.orb + b.rd + b.odr) {
    const defRate = b.rd + b.orb ? b.rd / (b.rd + b.orb) : 0, reb = b.ro + b.rd, rebT = b.orb + b.odr;
    if (b.orb - b.ro >= 5) add('reb', b.orb - b.ro, -1, 'Le rebond défensif.', `${esc(T)} a pris <b>${b.orb}</b> rebonds offensifs (contre <b>${b.ro}</b>) : autant de secondes chances.`);
    else if (b.ro - b.orb >= 5) add('reb', b.ro - b.orb, 1, 'Le rebond offensif.', `<b>${b.ro}</b> pris contre <b>${b.orb}</b> pour ${esc(T)} : autant de secondes chances${vsSeason('reb', reb, false, 1)}.`);
    else if (defRate >= 0.75 && b.rd >= 15) add('reb', 6, 1, 'Le rebond défensif.', `<b>${pct0(b.rd, b.rd + b.orb)}</b> des rebonds défensifs pris : seulement <b>${b.orb}</b> secondes chances pour ${esc(T)}.`);
    else if (Math.abs(reb - rebT) >= 6) add('reb', Math.abs(reb - rebT) / 1.5, Math.sign(reb - rebT), 'Les rebonds.', `<b>${reb}</b> pris contre <b>${rebT}</b> pour ${esc(T)}${vsSeason('reb', reb, false, Math.sign(reb - rebT))}.`);
  }
  // 3 points
  const d3 = 3 * (us.total.p3 - th.total.p3);
  if (d3 <= -6) add('p3', -d3, -1, 'Le tir à 3 points.', `<b>${ma(s.p3, s.a3)}</b>${s.a3 ? ` (<b>${pct0(s.p3, s.a3)}</b>)` : ''} contre <b>${th.total.p3}</b> paniers primés pour ${esc(T)} : <b>${-d3}</b> points d’écart rien que là.`);
  else if (d3 >= 6) add('p3', d3, 1, 'Le tir à 3 points.', `<b>${ma(s.p3, s.a3)}</b>${s.a3 ? ` (<b>${pct0(s.p3, s.a3)}</b>)` : ''}, soit <b>${d3}</b> points de plus que ${esc(T)}.`);
  else if (s.a3 >= 8 && s.p3 / s.a3 >= 0.38) add('p3', 5, 1, 'Le tir à 3 points.', `<b>${ma(s.p3, s.a3)}</b> (<b>${pct0(s.p3, s.a3)}</b>).`);
  else if (s.a3 >= 10 && s.p3 / s.a3 < 0.25) add('p3', 4, -1, 'Le tir à 3 points.', `<b>${ma(s.p3, s.a3)}</b> (<b>${pct0(s.p3, s.a3)}</b>) : peu de réussite de loin.`);
  // Adresse : à 2 points si elle est bonne, sinon 2 pts / 3 pts
  if (s.afg >= 25) {
    const r = s.fg / s.afg, fgp = 100 * r;
    if (s.a2 >= 15 && s.p2 / s.a2 >= 0.5) add('fgp', 4 + Math.round(100 * (s.p2 / s.a2 - 0.5)), 1, 'L’adresse à 2 points.', `<b>${ma(s.p2, s.a2)}</b> (<b>${pct0(s.p2, s.a2)}</b>).`);
    else if (r >= 0.45) add('fgp', 4 + Math.round(100 * (r - 0.45)), 1, 'L’adresse.', `<b>${ma(s.fg, s.afg)}</b> à 2 pts / 3 pts (<b>${pct0(s.fg, s.afg)}</b>)${vsSeason('fgp', fgp, true, 1)}.`);
    else if (r < 0.33) add('fgp', 4 + Math.round(100 * (0.33 - r)), -1, 'L’adresse.', `<b>${ma(s.fg, s.afg)}</b> à 2 pts / 3 pts (<b>${pct0(s.fg, s.afg)}</b>)${vsSeason('fgp', fgp, true, -1) || ' : trop de tirs faciles manqués'}.`);
  }
  // Lancers francs
  const dlf = us.total.lf - th.total.lf, lfp = s.a1 ? 100 * s.lf / s.a1 : null;
  if (s.a1 && (s.a1 - s.lf >= 6 || s.lf / s.a1 < 0.65)) {
    add('lfp', 0.75 * (s.a1 - s.lf), -1, 'Les lancers francs.', `<b>${ma(s.lf, s.a1)}</b> (<b>${pct0(s.lf, s.a1)}</b>) : <b>${s.a1 - s.lf}</b> ratés${b.fd ? `, malgré <b>${b.fd}</b> fautes provoquées` : ''}${vsSeason('lfp', lfp, true, -1)}.`);
  } else if (s.a1 >= 8 && s.lf / s.a1 >= 0.75) {
    add('lfp', Math.max(4, dlf), 1, 'Les lancers francs.', `<b>${ma(s.lf, s.a1)}</b> (<b>${pct0(s.lf, s.a1)}</b>)${dlf > 0 ? `, <b>${dlf}</b> points de plus que ${esc(T)}` : ''}${vsSeason('lfp', lfp, true, 1)}.`);
  }
  // Fautes : commises (e-Marque) et provoquées (saisie)
  const df = us.total.f - th.total.f;
  if (df >= 5) add('fouls', df * 0.8, -1, 'Les fautes.', `<b>${us.total.f}</b> fautes commises contre <b>${th.total.f}</b> pour ${esc(T)}${dlf < 0 ? `, qui a marqué <b>${-dlf}</b> points de plus aux lancers` : ''}.`);
  else if (df <= -5) add('fouls', -df * 0.8, 1, 'La discipline.', `Seulement <b>${us.total.f}</b> fautes commises, contre <b>${th.total.f}</b> pour ${esc(T)}.`);
  if (b.fd >= 12) add('fd', b.fd / 3, 1, 'Les fautes provoquées.', `<b>${b.fd}</b> fautes provoquées${s.a1 ? `, pour <b>${s.a1}</b> lancers francs tentés` : ''}.`);
  // Pertes et gains de balle
  if (hasEv) {
    const lost = b.to + b.trav, gain = b.stl + b.won;
    if (lost >= 12) {
      const heavy = quarters.filter(q => q.b.to + q.b.trav >= Math.max(5, 1.4 * lost / Math.max(1, quarters.length)));
      add('lost', 0.8 * (lost - 10), -1, 'Les pertes de balle.', `<b>${lost}</b> ballons perdus${b.trav ? ` (dont ${b.trav} marcher${b.trav > 1 ? 's' : ''})` : ''}${heavy.length ? `, dont ${heavy.map(q => `<b>${q.b.to + q.b.trav}</b> au ${qName(q.i)}`).join(' et ')}` : ''}${vsSeason('lost', lost, false, -1)}.`);
    } else if (lost <= 8) {
      add('lost', 10 - lost, 1, 'Le ballon protégé.', `${lost ? `Seulement <b>${lost}</b> perte${lost > 1 ? 's' : ''} de balle` : 'Aucune perte de balle'} sur le match${vsSeason('lost', lost, false, 1)}.`);
    }
    if (gain >= 12 && gain > lost) add('gain', 0.8 * (gain - lost) + 3, 1, 'Les ballons récupérés.', `<b>${b.stl}</b> interceptions et <b>${b.won}</b> ballons gagnés, pour <b>${lost}</b> perdus.`);
  }
  // Banc
  if (us.bench != null && th.bench != null && Math.abs(us.bench - th.bench) >= 10) {
    const db = us.bench - th.bench;
    add('bench', Math.abs(db) / 2, Math.sign(db), 'Le banc.', `<b>${us.bench}</b> points contre <b>${th.bench}</b> pour ${esc(T)}.`);
  }
  // Écarts nets à la saison qui ne sont pas déjà cités (rebonds, interceptions, pertes, ballons gagnés)
  const SEA = [['reb', b.ro + b.rd, true, 'Les rebonds.', 'pris'], ['stl', b.stl, true, 'Les interceptions.', ''],
    ['lost', b.to + b.trav, false, 'Les pertes de balle.', 'ballons perdus'], ['won', b.won, true, 'Les ballons gagnés.', '']];
  if (hasEv) SEA.forEach(([k, v, up, t, unit]) => {
    const g = gapOf(k, v);
    if (g == null || has(k) || (k === 'stl' || k === 'won') && has('gain') || Math.abs(g) < Math.max(3, 0.25 * A[k])) return;
    add(k, Math.abs(g), (g > 0) === up ? 1 : -1, t, `<b>${v}</b>${unit ? ' ' + unit : ''}${vsSeason(k, v)} (<b>${n1(A[k])}</b>).`);
  });
  // Joueurs : meilleur marqueur adroit, points partagés, le plus efficace ; les 5 fautes en note
  const five = players.filter(p => p.f >= 5), top = players[0];
  const topGood = top && top.pts >= 15 && top.afg && top.fg / top.afg >= 0.5;
  if (topGood) add('top', 5, 1, 'Le meilleur marqueur.', `#${esc(top.n)} ${esc(first(top.name))} : <b>${top.pts}</b> points à <b>${ma(top.fg, top.afg)}</b> au tir.`);
  const ten = players.filter(p => p.pts >= 10);
  if (ten.length >= 3) add('share', 3 + ten.length, 1, 'Des points partagés.', `<b>${ten.length}</b> joueurs à 10 points ou plus : ${ten.map(p => `${esc(first(p.name))} (${p.pts})`).join(', ')}.`);
  const eff = players.filter(p => p !== (topGood ? top : null) && p.afg >= 6 && p.ppt >= 1.2).sort((a, b) => b.ppt - a.ppt)[0];
  if (eff) add('eff', 4, 1, 'Le plus efficace.', `#${esc(eff.n)} ${esc(first(eff.name))} : <b>${eff.pts}</b> points à <b>${ma(eff.fg, eff.afg)}</b> au tir.`);
  // 5 fautes : à travailler quand ce sont des marqueurs (10 points ou plus), sinon simple note
  const who = p => `#${esc(p.n)} ${esc(first(p.name))} (<b>${p.pts}</b> pts${mins(p.min) ? ` en ${mins(p.min)} min` : ''})`;
  const fiveScorers = five.filter(p => p.pts >= 10), fiveOthers = five.filter(p => p.pts < 10);
  if (fiveScorers.length) add('five', 8 + fiveScorers.reduce((a, p) => a + p.pts, 0) / 4, -1, 'Les 5 fautes.',
    `${andList(fiveScorers.map(who))} ${fiveScorers.length > 1 ? 'sont sortis' : 'est sorti'} pour 5 fautes${d < 0 ? ' : autant de points en moins sur la fin' : ''}.`);
  if (fiveOthers.length) add('fiveN', 5, 0, '', `${andList(fiveOthers.map(who))} ${fiveOthers.length > 1 ? 'sont sortis' : 'est sorti'} pour 5 fautes.`);
  if (top && top.pts >= 10 && !topGood && !five.includes(top)) add('topn', 6, 0, '', `#${esc(top.n)} ${esc(first(top.name))}, meilleur marqueur avec <b>${top.pts}</b> points.`);

  const by = list => list.sort((a, b) => b.p - a.p);
  return { good: by(C.filter(c => c.tone > 0)).slice(0, 5), bad: by(C.filter(c => c.tone < 0)).slice(0, 5), notes: by(C.filter(c => !c.tone)).slice(0, 2) };
}

// Chiffres clés du Résumé : une tuile par chiffre, avec l'écart à la moyenne de la saison quand il y en a une
// (les tuiles remplacent l'ancien tableau « Par rapport à la saison » : chaque chiffre n'apparaît qu'une fois).
function keyTiles(D, names) {
  const { us, th, s, b } = D, [, T] = names, SA = seasonAvgs(), A = SA ? SA.avg : {};
  const n1 = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
  const ev = S.ev || [];
  const wonDetail = WON.map(w => [w[1].toLowerCase(), ev.filter(e => e.a === w[0]).length]).filter(x => x[1]).map(([l, n]) => `${l} : ${n}`).join(' · ');
  // [libellé, valeur affichée, valeur comparée, détail, clé de saison, plus = mieux, pourcentage]
  const T9 = [
    ['Points marqués', us.total.pts, us.total.pts, '', 'pts', true],
    ['Points encaissés', th.total.pts, th.total.pts, '', 'opp', false],
    ['Adresse 2 pts / 3 pts', pct0(s.fg, s.afg), s.afg ? 100 * s.fg / s.afg : null, s.afg ? `${ma(s.fg, s.afg)} réussis` : '', 'fgp', true, true],
    ['Tirs à 3 points', ma(s.p3, s.a3), null, `${esc(first(T))} : ${th.total.p3} paniers primés`],
    ['Lancers francs', pct0(s.lf, s.a1), s.a1 ? 100 * s.lf / s.a1 : null, s.a1 ? `${ma(s.lf, s.a1)} réussis` : '', 'lfp', true, true],
    ['Rebonds', b.ro + b.rd, b.ro + b.rd, `dont ${b.ro} offensifs · ${esc(first(T))} : ${b.orb + b.odr}`, 'reb', true],
    ['Balles perdues', b.to + b.trav, b.to + b.trav, b.trav ? `dont ${b.trav} marcher${b.trav > 1 ? 's' : ''}` : '', 'lost', false],
    ['Interceptions', b.stl, b.stl, '', 'stl', true],
    ['Ballons gagnés', b.won, b.won, wonDetail, 'won', true],
  ];
  const tiles = T9.map(([label, shown, v, sub, k, up, pct]) => {
    let line = '';
    if (k && A[k] != null && v != null) {
      const g = v - A[k], near = pct ? Math.abs(g) < 2 : Math.abs(g) < Math.max(0.5, Math.abs(A[k]) * 0.05);
      const gap = near ? '≈ moyenne' : (g > 0 ? '▲ +' : '▼ −') + (pct ? Math.round(Math.abs(g)) + ' pts' : n1(Math.abs(g)));
      line = `<span class="s"><b class="${near ? '' : (g > 0) === up ? 'good' : 'low'}">${gap}</b> · moy. ${pct ? Math.round(A[k]) + ' %' : n1(A[k])}</span>`;
    }
    return `<div class="rp-kpi"><span class="l">${label}</span><span class="v">${shown}</span>${line}${sub ? `<span class="s">${sub}</span>` : ''}</div>`;
  }).join('');
  const note = SA ? `<p class="rp-muted rp-knote">▲ ▼ : écart à la moyenne des ${SA.n} autres matchs de ${esc(S.me)} en ${SA.season}. En vert : mieux que d’habitude ; en rouge : moins bien.</p>` : '';
  return `<div class="rp-kpis">${tiles}</div>${note}`;
}

// --- Pages ---

export const PAGES = [['resume', 'Résumé'], ['equipe', 'Équipe'], ['quarts', 'Quart-temps'],
  ['joueurs', 'Joueurs'], ['adv', 'Adversaire'], ['methode', 'Méthode']];

// --- Comparaison avec la saison ---

// Chiffres d'un match pour la comparaison : feuille e-Marque (points, adresse) et saisie (le reste).
// Pourcentages : réussis de la feuille, ratés de la saisie (comme dans le reste du rapport).
function seasonVals(m) {
  const ev = m.ev || [], c = a => ev.filter(e => e.a === a).length;
  const v = {
    stl: c('stl'), lost: c('to') + c('trav'), miss: c('m1') + c('m2') + c('m3'),
    reb: c('ro') + c('rd'), won: WON.reduce((a, w) => a + c(w[0]), 0),
  };
  const u = m.em && m.em.us && m.em.us.total;
  if (u) {
    const fg = u.p2i + u.p2e + u.p3, afg = fg + c('m2') + c('m3'), a1 = u.lf + c('m1');
    Object.assign(v, { pts: u.pts, opp: m.em.them.total.pts, fgp: afg ? 100 * fg / afg : null, lfp: a1 ? 100 * u.lf / a1 : null });
  }
  return v;
}

// [clé, libellé, plus = mieux, pourcentage]
const SEASON_ROWS = [
  ['pts', 'Points marqués', true], ['opp', 'Points encaissés', false],
  ['fgp', 'Adresse aux tirs', true, true], ['lfp', 'Lancers francs', true, true],
  ['stl', 'Interceptions', true], ['lost', 'Balles perdues et marchers', false], ['miss', 'Tirs ratés (LF compris)', false],
  ['reb', 'Rebonds', true], ['won', 'Ballons gagnés', true],
];

function pages(D) {
  const { em, us, th, s, b, players, quarters } = D;
  // Noms courts dans les phrases et les tableaux : le club plutôt que l'équipe
  const U = S.clubName ? shortName(S.clubName) : S.me, T = shortName(S.opp), names = [U, T];
  const cU = curTeamColor(), cT = isLight(oppColor()) ? '#b5b9b6' : oppColor();
  const cLF = '#d9a441', c2 = '#7fb89a', c3 = '#3b6ea8';
  const d = us.total.pts - th.total.pts;
  const kpi = (l, v, sub) => `<div class="rp-kpi"><span class="l">${l}</span><span class="v">${v}</span><span class="s">${sub}</span></div>`;
  const card = (title, sub, body) => `<div class="rp-card"><h3>${title}</h3>${sub ? `<p class="rp-muted">${sub}</p>` : ''}${body}</div>`;
  const table = (head, rows, foot) => `<div class="rp-scroll"><table class="rp-t"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ''}</table></div>`;
  const P = {};

  // 1. Résumé
  const qline = quarters.length
    ? `<div class="rp-qline">${quarters.map(q => `<span>${qName(q.i)} ${q.us}-${q.th}</span>${q.i === 1 ? `<span>Mi-temps ${q.cum[0]}-${q.cum[1]}</span>` : ''}`).join('')}</div>`
    : (us.halves && th.halves ? `<div class="rp-qline"><span>Mi-temps ${us.halves[0]}-${th.halves[0]}</span><span>2e mi-temps ${us.halves[1]}-${th.halves[1]}</span></div>` : '');
  const F = findings(D, names);
  const col = (cls, title, list) => `<div class="${cls}"><h4>${title}</h4>${list.length
    ? `<ul class="rp-finds">${list.map(f => `<li class="${cls}"><strong>${f.t}</strong> ${f.x}</li>`).join('')}</ul>`
    : '<p class="rp-muted" style="margin:0">Rien de marquant.</p>'}</div>`;
  P.resume = `<div class="rp-score"><div class="rp-team"><span>${esc(U)}</span><span class="big">${us.total.pts}</span></div><span class="sep">–</span>`
    + `<div class="rp-team"><span>${esc(T)}</span><span class="big">${th.total.pts}</span></div><span class="rp-pill ${d > 0 ? 'good' : d < 0 ? 'low' : ''}">${d > 0 ? 'Victoire' : d < 0 ? 'Défaite' : 'Nul'}</span></div>`
    + qline
    + headline(D, names)
    + keyTiles(D, names)
    + (F.good.length || F.bad.length || F.notes.length
      ? `<h3 class="rp-h3">Ce qu’il faut retenir</h3><div class="rp-take2">${col('up', 'Points forts', F.good)}${col('down', 'À travailler', F.bad)}</div>`
        + F.notes.map(n => `<p class="rp-note">À noter : ${n.x}</p>`).join('')
      : '');

  // Petits outils communs aux pages suivantes
  const grp = (l, n = 3) => `<tr class="grp"><td colspan="${n}">${l}</td></tr>`;
  const row3 = (l, u, t) => `<tr><td>${l}</td><td class="n">${u}</td><td class="n">${t}</td></tr>`;
  const shotU = (m, a) => (a ? `${ma(m, a)} <span class="rp-muted">·</span> <span class="${tone(m, a)}">${pc(m, a)}</span>` : (m ? `${m} réussis` : '–'));
  const offU = b.ro + b.odr ? pc(b.ro, b.ro + b.odr) : '–', offT = b.orb + b.rd ? pc(b.orb, b.orb + b.rd) : '–';
  const defU = b.rd + b.orb ? pc(b.rd, b.rd + b.orb) : '–', defT = b.odr + b.ro ? pc(b.odr, b.odr + b.ro) : '–';

  // 2. Équipe : nous face à eux, sur tout le match (tirs, rebonds, fautes), puis l'origine des points
  const tp = t => [t.total.lf, 2 * (t.total.p2i + t.total.p2e), 3 * t.total.p3];
  const [uL, u2, u3] = tp(us), [tL, t2, t3] = tp(th);
  const ratio = us.adv != null
    ? card('Déroulé du match', 'Données officielles du résumé e-Marque.',
      table(`<th>Donnée</th><th class="n">${esc(first(U))}</th><th class="n">${esc(first(T))}</th>`,
        row3('Avantage maximum', us.adv, th.adv) + row3('Série maximum', us.run, th.run) + row3('Points du banc', us.bench, th.bench)
        + (em.ties != null ? `<tr><td>Égalités dans le match</td><td class="n" colspan="2" style="text-align:center">${em.ties}</td></tr>` : '')))
    : '';
  P.equipe = `<div class="rp-grid rp-eq">` + card(`${esc(U)} face à ${esc(T)}`, `Réussis et fautes : e-Marque. Ratés et rebonds : saisie, relevée pour ${esc(U)} seulement (pas de pourcentage pour ${esc(T)}).`,
    table(`<th></th><th class="n">${esc(first(U))}</th><th class="n">${esc(first(T))}</th>`,
      grp('Tirs')
      + row3('Points', `<b>${us.total.pts}</b>`, `<b>${th.total.pts}</b>`)
      + row3('2 pts / 3 pts', shotU(s.fg, s.afg), `${th.total.fg} réussis`)
      + row3('2 points', shotU(s.p2, s.a2), `${th.total.p2i + th.total.p2e} réussis`)
      + row3('3 points', shotU(s.p3, s.a3), `${th.total.p3} réussis`)
      + row3('Lancers francs', shotU(s.lf, s.a1), `${th.total.lf} réussis`)
      + grp('Rebonds')
      + row3('Offensifs', b.ro, b.orb) + row3('Défensifs', b.rd, b.odr) + row3('<b>Total</b>', `<b>${b.ro + b.rd}</b>`, `<b>${b.orb + b.odr}</b>`)
      + row3('Part des rebonds offensifs pris', offU, offT) + row3('Part des rebonds défensifs pris', defU, defT)
      + grp('Fautes')
      + row3('Fautes commises', us.total.f, th.total.f)))
    + `<div class="rp-col">`
    + card('Origine des points', 'Points marqués par type de panier (e-Marque).', legend([[cLF, 'Lancers francs'], [c2, 'Paniers à 2 pts'], [c3, 'Paniers à 3 pts']])
      + stacked([{ label: first(U), parts: [{ v: uL, color: cLF, name: 'Lancers francs' }, { v: u2, color: c2, name: 'Paniers à 2 pts' }, { v: u3, color: c3, name: 'Paniers à 3 pts' }], tail: us.total.pts + ' pts' },
        { label: first(T), parts: [{ v: tL, color: cLF, name: 'Lancers francs' }, { v: t2, color: c2, name: 'Paniers à 2 pts' }, { v: t3, color: c3, name: 'Paniers à 3 pts' }], tail: th.total.pts + ' pts' }], null, 400))
    + ratio
    + `</div></div>`
    // Ballons : relevés pour nous seulement (saisie), donc en tuiles sous le face-à-face, en pleine largeur
    + card('Ballons', `Saisie, relevée pour ${esc(U)} seulement.`, `<div class="rp-kpis rp-k4">`
      + kpi('Interceptions', b.stl, '&nbsp;')
      + kpi('Ballons gagnés', b.won, WON.map(w => [w[1].toLowerCase(), (S.ev || []).filter(e => e.a === w[0]).length]).filter(x => x[1]).map(([l, n]) => `${l} : ${n}`).join(' · ') || '&nbsp;')
      + kpi('Balles perdues', b.to, b.trav ? `+ ${b.trav} marcher${b.trav > 1 ? 's' : ''}` : '&nbsp;')
      + kpi('Fautes provoquées', b.fd, '&nbsp;')
      + `</div>`);

  // 3. Quart-temps : tout le découpage par quart-temps, et seulement ici
  if (quarters.length) {
    const cats = quarters.map(q => qName(q.i));
    const qrow = (q, cells) => `<tr><td>${qName(q.i)}</td>${cells.map(c => `<td class="n${c[1] ? ' ' + c[1] : ''}">${c[0]}</td>`).join('')}</tr>`;
    const scoreRows = quarters.map(q => {
      const dd = q.us - q.th;
      return qrow(q, [[q.us, 'b'], [q.th], [sgn(dd), dd > 0 ? 'good' : dd < 0 ? 'low' : ''], [`${q.cum[0]}-${q.cum[1]}`],
        [ma(q.s.fg, q.s.afg)], [pc(q.s.fg, q.s.afg), tone(q.s.fg, q.s.afg)], [ma(q.s.p3, q.s.a3)], [pc(q.s.lf, q.s.a1)]]);
    }).join('');
    const scoreFoot = `<tr><td>Match</td><td class="n">${us.total.pts}</td><td class="n">${th.total.pts}</td><td class="n">${sgn(d)}</td><td class="n"></td>`
      + `<td class="n">${ma(s.fg, s.afg)}</td><td class="n">${pc(s.fg, s.afg)}</td><td class="n">${ma(s.p3, s.a3)}</td><td class="n">${pc(s.lf, s.a1)}</td></tr>`;
    const ballRows = quarters.map(q => qrow(q, [[q.b.to + q.b.trav], [q.b.stl], [q.b.won], [q.b.ro], [q.b.orb], [q.b.ro + q.b.rd], [q.b.orb + q.b.odr]])).join('');
    const ballFoot = `<tr><td>Match</td><td class="n">${b.to + b.trav}</td><td class="n">${b.stl}</td><td class="n">${b.won}</td><td class="n">${b.ro}</td><td class="n">${b.orb}</td><td class="n">${b.ro + b.rd}</td><td class="n">${b.orb + b.odr}</td></tr>`;
    const qp = us.qp || {}, ptsQ = (n, i) => ((qp[n] || [])[i] || {}).pts || 0;
    const scorers = players.filter(p => p.pts || quarters.some(q => ptsQ(p.n, q.i)));
    const pq = scorers.length
      ? card('Points par joueur et par quart-temps', 'D’après la marque courante (feuille de marque).',
        table(`<th>N°</th><th>Joueur</th>${quarters.map(q => `<th class="n">${qName(q.i)}</th>`).join('')}<th class="n">Total</th>`,
          scorers.map(p => `<tr><td>${esc(p.n)}</td><td>${esc(p.name) || '–'}</td>${quarters.map(q => { const v = ptsQ(p.n, q.i); return `<td class="n${v ? '' : ' rp-muted'}">${v || '–'}</td>`; }).join('')}<td class="n b">${p.pts}</td></tr>`).join(''),
          `<tr><td></td><td>Équipe</td>${quarters.map(q => `<td class="n">${q.us}</td>`).join('')}<td class="n">${us.total.pts}</td></tr>`))
      : '';
    P.quarts = `<div class="rp-grid">`
      + card('Points marqués', 'Source : feuille de marque e-Marque.', legend([[cU, U], [cT, T]]) + bars(cats, [{ name: U, color: cU, vals: quarters.map(q => q.us) }, { name: T, color: cT, vals: quarters.map(q => q.th) }]))
      + card(`Adresse de ${esc(U)}`, '2 pts / 3 pts et lancers francs, en % de réussite.', legend([[cU, '2 pts / 3 pts'], [cLF, 'Lancers francs']])
        + bars(cats, [{ name: '2 pts / 3 pts', color: cU, vals: quarters.map(q => (q.s.afg ? Math.round(100 * q.s.fg / q.s.afg) : null)) }, { name: 'Lancers francs', color: cLF, vals: quarters.map(q => (q.s.a1 ? Math.round(100 * q.s.lf / q.s.a1) : null)) }], v => v + ' %', 100))
      + `</div>`
      + card('Score et adresse', 'Réussis d’après la marque courante, ratés d’après la saisie.',
        table(`<th>Quart</th><th class="n">${esc(first(U))}</th><th class="n">${esc(first(T))}</th><th class="n">Écart</th><th class="n">Cumul</th><th class="n">Tirs</th><th class="n">%</th><th class="n">3 pts</th><th class="n">% LF</th>`, scoreRows, scoreFoot))
      + card('Ballons et rebonds', 'Saisie. « Off. » : rebonds offensifs, les secondes chances.',
        table(`<th>Quart</th><th class="n">Pertes</th><th class="n">Interc.</th><th class="n">Ballons gagnés</th><th class="n">Off. ${esc(first(U))}</th><th class="n">Off. ${esc(first(T))}</th><th class="n">Reb. ${esc(first(U))}</th><th class="n">Reb. ${esc(first(T))}</th>`, ballRows, ballFoot))
      + pq;
  } else {
    P.quarts = `<p class="rp-muted">Le score par quart-temps vient de la feuille de marque. Importe-la avec le résumé (fichier « feuillematch_… .pdf ») pour remplir cette page.</p>`;
  }

  // 4. Joueurs : qui a fait quoi, sur tout le match (au tir, puis avec le ballon)
  const ppt = s.afg ? ((2 * s.p2 + 3 * s.p3) / s.afg).toFixed(2).replace('.', ',') : '–';
  const shotTd = (m, a) => `<td class="n">${a ? `${ma(m, a)} <span class="${tone(m, a)}">${Math.round(100 * m / a)} %</span>` : '–'}</td>`;
  const prow = p => `<tr><td>${esc(p.n)}</td><td>${esc(p.name) || '–'}</td><td class="n">${esc(p.min) || '–'}</td><td class="n b">${p.pts}</td>`
    + shotTd(p.fg, p.afg) + shotTd(p.p2, p.a2) + shotTd(p.p3, p.a3) + shotTd(p.lf, p.a1)
    + `<td class="n">${p.ppt == null ? '–' : p.ppt.toFixed(2).replace('.', ',')}</td><td class="n ${p.f >= 5 ? 'low' : ''}">${p.f}</td></tr>`;
  const pfoot = `<tr><td></td><td>Équipe</td><td class="n">${esc(us.total.min)}</td><td class="n">${us.total.pts}</td>`
    + shotTd(s.fg, s.afg) + shotTd(s.p2, s.a2) + shotTd(s.p3, s.a3) + shotTd(s.lf, s.a1) + `<td class="n">${ppt}</td><td class="n">${us.total.f}</td></tr>`;
  const brows = players.slice().sort((a, b) => b.bal - a.bal).map(p => `<tr><td>${esc(p.n)}</td><td>${esc(p.name) || '–'}</td><td class="n">${p.stl}</td><td class="n">${p.fd}</td><td class="n">${p.to}</td><td class="n">${p.trav}</td><td class="n ${p.bal > 0 ? 'good' : p.bal < 0 ? 'low' : ''}">${sgn(p.bal)}</td></tr>`).join('');
  const bal = b.stl + b.fd - b.to - b.trav;
  P.joueurs = card('Au tir', 'Tentés = réussis (e-Marque) + ratés (saisie). Pts/tir : points marqués à 2 pts / 3 pts ÷ tirs tentés (hors lancers). En vert : 50 % et plus ; en rouge : moins de 35 %.',
    table('<th>N°</th><th>Joueur</th><th class="n">Temps</th><th class="n">Pts</th><th class="n">Tirs</th><th class="n">2 pts</th><th class="n">3 pts</th><th class="n">LF</th><th class="n">Pts/tir</th><th class="n">Fautes</th>',
      players.map(prow).join(''), pfoot))
    + card('Points par joueur', 'Par type de panier. En bout de barre : points et adresse à 2 pts / 3 pts.', legend([[cLF, 'Lancers francs'], [c2, 'Paniers à 2 pts'], [c3, 'Paniers à 3 pts']])
      + stacked(players.map(p => ({ label: `#${p.n} ${first(p.name)}`.trim(), parts: [{ v: p.lf, color: cLF, name: 'Lancers francs' }, { v: 2 * p.p2, color: c2, name: 'Paniers à 2 pts' }, { v: 3 * p.p3, color: c3, name: 'Paniers à 3 pts' }], tail: `${p.pts} pts${p.afg ? ' · ' + Math.round(100 * p.fg / p.afg) + ' %' : ''}` }))))
    + card('Avec le ballon', 'Bilan = interceptions + fautes provoquées − balles perdues − marchers. Indicateur interne, pas une évaluation officielle.',
      table('<th>N°</th><th>Joueur</th><th class="n">Interc.</th><th class="n">Fautes prov.</th><th class="n">Pertes</th><th class="n">Marchers</th><th class="n">Bilan</th>', brows,
        `<tr><td></td><td>Équipe</td><td class="n">${b.stl}</td><td class="n">${b.fd}</td><td class="n">${b.to}</td><td class="n">${b.trav}</td><td class="n">${sgn(bal)}</td></tr>`));

  // 5. Adversaire
  const opp = Object.entries(th.players || {}).map(([n, p]) => ({ n, ...p })).sort((a, b) => (b.pts - a.pts) || (+a.n - +b.n));
  P.adv = card(`Joueurs de ${esc(T)}`, 'Paniers réussis uniquement (e-Marque).',
    table('<th>N°</th><th class="n">Temps</th><th class="n">Pts</th><th class="n">Tirs</th><th class="n">3 pts</th><th class="n">2 pts int.</th><th class="n">2 pts ext.</th><th class="n">LF</th><th class="n">Fautes</th>',
      opp.map(p => `<tr><td>${esc(p.n)}</td><td class="n">${esc(p.min)}</td><td class="n b">${p.pts}</td><td class="n">${p.fg}</td><td class="n">${p.p3}</td><td class="n">${p.p2i}</td><td class="n">${p.p2e}</td><td class="n">${p.lf}</td><td class="n ${p.f >= 5 ? 'low' : ''}">${p.f}</td></tr>`).join('')));

  // 6. Méthode
  P.methode = `<div class="rp-notes">`
    + card('Sources', '', `<ul><li>Résumé e-Marque (officiel) : points, paniers et lancers réussis, fautes, temps de jeu${quarters.length ? ' ; feuille de marque : score par quart-temps' : ''}.</li><li>Saisie Pick&amp;Stats (non officielle) : tirs ratés, interceptions, fautes provoquées, balles perdues, marchers, rebonds par équipe, ballons gagnés.</li></ul>`)
    + card('Méthode', '', `<ul><li>Tirs tentés = tirs réussis (e-Marque) + tirs ratés (saisie), joueur par joueur${quarters.length ? ' et quart-temps par quart-temps' : ''}.</li>${quarters.length ? '<li>Paniers et lancers réussis par quart-temps : lus sur la marque courante (numéro du joueur à chaque panier, en rouge aux 1er et 3e quarts-temps, en noir aux 2e et 4e).</li>' : ''}<li>Part des rebonds offensifs pris = rebonds offensifs ÷ (rebonds offensifs + rebonds défensifs adverses).</li><li>Par rapport à la saison : moyenne des autres matchs archivés de la même équipe, d’août à juillet. Une ligne n’apparaît que si au moins 2 de ces matchs ont la donnée (feuille e-Marque pour les points et l’adresse).</li></ul>`)
    + card('Limites', '', `<ul><li>Non relevé : rebonds et passes décisives par joueur, tirs ratés de l’adversaire.</li><li>Les pourcentages dépendent de la saisie des tirs ratés : un raté oublié rend le pourcentage flatteur.</li>${b.fd && th.total.f ? `<li>Fautes provoquées saisies : ${b.fd} ; fautes commises par ${esc(T)} (e-Marque) : ${th.total.f}.</li>` : ''}</ul>`)
    + `</div>`;
  return P;
}

// En-tête du dossier
function head(m) {
  const logo = S.clubLogo ? `<div class="rp-logo"><img src="${S.clubLogo}" alt=""></div>` : '';
  const club = S.clubName ? esc(S.clubName) + ' · ' : '';
  const date = new Date(m.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `<header class="rp-top">${logo}<div><p class="rp-eyebrow">${club}Dossier de statistiques</p><h1>${esc(S.me)} – ${esc(S.opp)}</h1>`
    + `<p class="rp-muted">${S.em.num ? 'Rencontre n° ' + esc(S.em.num) + ' · ' : ''}${date}</p></div></header>`;
}

// Écran du rapport dans l'appli (à appeler dans withMatch).
export function reportView(m) {
  const D = build(), P = pages(D);
  const cur = PAGES.find(p => p[0] === ui.rp) ? ui.rp : 'resume';
  const i = PAGES.findIndex(p => p[0] === cur);
  return `<style>${RP_CSS}</style><div class="rp" style="--rp-accent:${curTeamColor()}">${head(m)}`
    + `<div class="chips scroll rp-tabs">${PAGES.map(([id, l]) => `<button class="chip${id === cur ? ' on' : ''}" data-x="rp" data-v="${id}">${l}</button>`).join('')}</div>`
    + `<section class="rp-page"><div class="rp-ptitle"><span>Page ${i + 1} sur ${PAGES.length}</span><h2>${PAGES[i][1]}</h2></div>${P[cur]}</section>`
    + `<div class="rp-pager">${i > 0 ? `<button class="btn alt" data-x="rp" data-go="-1" data-v="${PAGES[i - 1][0]}">‹ ${PAGES[i - 1][1]}</button>` : '<span></span>'}`
    + `${i < PAGES.length - 1 ? `<button class="btn alt" data-x="rp" data-go="1" data-v="${PAGES[i + 1][0]}">${PAGES[i + 1][1]} ›</button>` : ''}</div></div>`;
}

// Fichier HTML autonome (toutes les pages à la suite), à partager avec le staff.
export function reportFile(m) {
  const D = build(), P = pages(D);
  const title = `Stats ${S.me} – ${S.opp} ${fdate(m)}`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>`
    // Thème clair ou sombre : celui de l'appareil, sauf choix avec le bouton soleil/lune (mémorisé)
    + `<script>try{var t=localStorage.getItem('rp-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>`
    + `<style>:root{--card:#fff;--ink:#1b2420;--mut:#5d6862;--line:#dfe3df;--bg:#f6f7f5;color-scheme:light}`
    + `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${DARK}}}:root[data-theme="dark"]{${DARK}}`
    + `body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:15px;line-height:1.5}`
    + `.rp-theme{margin-left:auto;align-self:flex-start;flex:none;width:44px;height:44px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--ink);display:grid;place-items:center;cursor:pointer}`
    + `.rp-theme:hover{border-color:var(--rp-accent)}.rp-theme:focus-visible{outline:2px solid var(--rp-accent);outline-offset:2px}.rp-theme svg{width:20px;height:20px}`
    + `.rp-theme .sun{display:none}.dark .rp-theme .sun{display:block}.dark .rp-theme .moon{display:none}`
    + `.dark .rp-eyebrow,.dark .rp-ptitle span{color:color-mix(in srgb,var(--rp-accent) 55%,#fff)}`
    + `@media print{:root,:root[data-theme="dark"]{--card:#fff;--ink:#000;--mut:#555;--line:#ccc;--bg:#fff;color-scheme:light}.rp-theme{display:none}}`
    + `.rp{max-width:1100px;margin:0 auto;padding:24px 16px 48px}.rp-page{margin-top:22px}.rp-page[hidden]{display:none}`
    // Onglets collés en haut, une page à la fois ; à l'impression, toutes les pages à la suite
    + `nav.rp-nav{position:sticky;top:0;z-index:5;background:var(--bg);display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--line);padding-top:6px;scrollbar-width:thin}`
    + `nav.rp-nav button{flex:none;font:inherit;font-size:14px;background:none;border:0;border-bottom:3px solid transparent;color:var(--mut);padding:10px 14px;cursor:pointer;white-space:nowrap}`
    + `nav.rp-nav button:hover{color:var(--ink)}nav.rp-nav button[aria-selected="true"]{color:var(--ink);font-weight:600;border-bottom-color:var(--rp-accent)}`
    + `nav.rp-nav button:focus-visible,.rp-pg button:focus-visible{outline:2px solid var(--rp-accent);outline-offset:2px}`
    + `.rp-pg{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:14px;margin-top:8px}`
    + `.rp-pg button{font:inherit;font-size:14px;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 14px;color:var(--ink);cursor:pointer}.rp-pg button:hover{border-color:var(--rp-accent)}`
    + `@media print{body{background:#fff}.rp{padding:0}nav.rp-nav,.rp-pg{display:none!important}.rp-page,.rp-page[hidden]{display:flex!important;break-before:page}.rp-page:first-of-type{break-before:auto}}`
    + `${RP_CSS}.dark .rp{--rp-good:#5cc28f;--rp-low:#f08a7e}</style></head><body>`
    + `<div class="rp" style="--rp-accent:${curTeamColor()}">${head(m).replace('</header>', THEME_BTN + '</header>')}`
    + `<nav class="rp-nav" role="tablist" aria-label="Pages du dossier">${PAGES.map(([id, l], i) => `<button type="button" role="tab" id="tab-${id}" aria-controls="${id}" aria-selected="${i === 0}" data-page="${id}">${l}</button>`).join('')}</nav>`
    + PAGES.map(([id, l], i) => `<section class="rp-page" id="${id}" role="tabpanel" aria-labelledby="tab-${id}"${i ? ' hidden' : ''}><div class="rp-ptitle"><span>Page ${i + 1} sur ${PAGES.length}</span><h2>${l}</h2></div>${P[id]}`
      + `<div class="rp-pg">${i ? `<button type="button" data-go="-1">← ${PAGES[i - 1][1]}</button>` : '<span></span>'}${i < PAGES.length - 1 ? `<button type="button" data-go="1">${PAGES[i + 1][1]} →</button>` : '<span></span>'}</div></section>`).join('')
    + `<footer class="rp-foot">Document interne${S.clubName ? ' ' + esc(S.clubName) : ''} – ${esc(S.me)}. Statistiques individuelles à usage du staff et de l’équipe, à ne pas diffuser publiquement. Généré par Pick&amp;Stats.</footer></div>`
    + `<script>${TABS_JS}${THEME_JS}(${swipeNav})(document);</script></body></html>`;
}

// Couleurs du thème sombre du fichier exporté
const DARK = '--card:#1a211e;--ink:#e7ece9;--mut:#9aa6a0;--line:#2c3531;--bg:#121715;color-scheme:dark';

// Bouton soleil/lune : la lune passe en sombre, le soleil revient en clair.
const THEME_BTN = '<button type="button" class="rp-theme" aria-label="Passer en thème sombre" title="Thème clair ou sombre">'
  + '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
  + '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
  + '</button>';

const THEME_JS = `(function(){
  var root=document.documentElement, btn=document.querySelector('.rp-theme'), mq=window.matchMedia?matchMedia('(prefers-color-scheme: dark)'):null;
  function isDark(){var t=root.getAttribute('data-theme');return t?t==='dark':!!(mq&&mq.matches);}
  function sync(){var d=isDark();root.classList.toggle('dark',d);btn.setAttribute('aria-label',d?'Passer en thème clair':'Passer en thème sombre');}
  btn.addEventListener('click',function(){var t=isDark()?'light':'dark';root.setAttribute('data-theme',t);try{localStorage.setItem('rp-theme',t);}catch(e){}sync();});
  if(mq&&mq.addEventListener)mq.addEventListener('change',sync);
  sync();
})();`;

// Glisser le doigt vers la gauche ou la droite sur le rapport : page suivante ou précédente
// (dans l'appli et dans le fichier exporté, où cette fonction est recopiée telle quelle : ES5 uniquement).
// Rien ne se passe si le geste part d'un tableau ou d'une barre qu'on peut déjà faire défiler de côté.
export function swipeNav(root) {
  var x0 = null, y0 = 0, t0 = 0;
  function sideScroll(el) {
    for (; el && el.nodeType === 1; el = el.parentNode) {
      var o = getComputedStyle(el).overflowX;
      if ((o === 'auto' || o === 'scroll') && el.scrollWidth > el.clientWidth + 1) return true;
    }
    return false;
  }
  root.addEventListener('touchstart', function (e) {
    x0 = null;
    if (e.touches.length !== 1 || !e.target.closest || !e.target.closest('.rp') || sideScroll(e.target)) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
  }, { passive: true });
  root.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < 2 * Math.abs(dy) || Date.now() - t0 > 800) return;
    var go = dx < 0 ? '1' : '-1';
    var b = root.querySelector('.rp-page:not([hidden]) .rp-pg [data-go="' + go + '"], .rp-pager [data-go="' + go + '"]');
    if (b) b.click();
  }, { passive: true });
}

// Navigation par onglets du fichier exporté : clic, flèches du clavier, boutons précédent/suivant, #page dans l'adresse.
const TABS_JS = `(function(){
  var pages=[].slice.call(document.querySelectorAll('.rp-page')), ids=pages.map(function(p){return p.id;});
  var tabs=[].slice.call(document.querySelectorAll('nav.rp-nav button'));
  function show(id,focus){
    if(ids.indexOf(id)<0) id=ids[0];
    pages.forEach(function(p){p.hidden=p.id!==id;});
    tabs.forEach(function(b){var on=b.getAttribute('data-page')===id;b.setAttribute('aria-selected',on?'true':'false');b.tabIndex=on?0:-1;
      if(on&&focus)b.focus();if(on){var n=b.parentNode;n.scrollLeft=Math.max(0,b.offsetLeft-n.offsetLeft-16);}});
    try{history.replaceState(null,'','#'+id);}catch(e){}
  }
  tabs.forEach(function(b){b.addEventListener('click',function(){show(b.getAttribute('data-page'));window.scrollTo(0,0);});});
  document.querySelector('nav.rp-nav').addEventListener('keydown',function(e){
    var cur=ids.indexOf(document.querySelector('nav.rp-nav [aria-selected="true"]').getAttribute('data-page'));
    if(e.key==='ArrowRight'){show(ids[(cur+1)%ids.length],true);e.preventDefault();}
    if(e.key==='ArrowLeft'){show(ids[(cur-1+ids.length)%ids.length],true);e.preventDefault();}
  });
  document.querySelectorAll('.rp-pg button').forEach(function(b){b.addEventListener('click',function(){var cur=ids.indexOf(b.closest('.rp-page').id);show(ids[cur+Number(b.getAttribute('data-go'))]);window.scrollTo(0,0);});});
  show(location.hash.slice(1));
})();`;

// Styles du rapport (préfixe rp-), communs à l'appli et au fichier exporté.
const RP_CSS = `
.rp{--rp-grid:color-mix(in srgb,var(--line) 55%,transparent);--rp-axis:var(--mut);--rp-good:#15803D;--rp-low:#B91C1C}
html[data-theme="dark"] .rp{--rp-good:#5cc28f;--rp-low:#f08a7e}
.rp h1{margin:0;font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:clamp(24px,4vw,34px);line-height:1.15}
.rp-top{display:flex;align-items:center;gap:16px;margin:4px 0 14px}
.rp-logo{width:64px;height:64px;flex:none}.rp-logo img{width:100%;height:100%;object-fit:contain}
.rp-eyebrow{margin:0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--rp-accent);font-weight:700}
.rp-muted{margin:0;color:var(--mut);font-size:13px}
.rp-tabs{margin-bottom:8px}
.rp-page{display:flex;flex-direction:column;gap:18px}
.rp-ptitle span{display:block;font-size:12px;color:var(--rp-accent);font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.rp-ptitle h2{display:inline-block;margin:2px 0 0;font-size:20px;padding-bottom:6px;border-bottom:2px solid var(--rp-accent)}
.rp-h3{margin:4px 0 0;font-size:18px}
.rp-score{display:flex;flex-wrap:wrap;align-items:flex-end;gap:18px}
.rp-team{display:flex;flex-direction:column}.rp-team span:first-child{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut)}
.rp .big{font-family:Georgia,serif;font-size:64px;line-height:1;font-variant-numeric:tabular-nums}
.rp .sep{font-family:Georgia,serif;font-size:44px;color:var(--mut);line-height:1.2}
.rp-pill{align-self:center;font-size:13px;font-weight:700;border:1px solid var(--line);border-radius:999px;padding:2px 12px}
.rp .good{color:var(--rp-good)}.rp .low{color:var(--rp-low)}
.rp-qline{display:flex;flex-wrap:wrap;gap:8px;font-size:13px;color:var(--mut);font-variant-numeric:tabular-nums}
.rp-qline span{border:1px solid var(--line);border-radius:6px;padding:2px 8px;background:var(--card)}
.rp-take{margin:0;max-width:72ch;font-size:16px}
/* Bloc sous le score : titre du match et lignes étiquetées (tournant, différence, malgré…) */
.rp-story{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--mut);border-radius:10px;padding:14px 18px;margin:4px 0 14px}
.rp-story.win{border-left-color:var(--rp-good)}.rp-story.loss{border-left-color:var(--rp-low)}
.rp-story-t{margin:0;font-family:Georgia,serif;font-size:21px;line-height:1.3}
.rp-story dl{margin:10px 0 0;display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;align-items:baseline}
.rp-story dl>div{display:contents}.rp-story dt{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
.rp-story dd{margin:0;font-size:15px}.rp-story .up dt{color:var(--rp-good)}.rp-story .down dt{color:var(--rp-low)}
@media(max-width:560px){.rp-story dl{grid-template-columns:1fr;gap:2px}.rp-story dd{margin-bottom:6px}}
.rp-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.rp-kpis.rp-k4{grid-template-columns:repeat(4,1fr)}
@media(max-width:560px){.rp-kpis,.rp-kpis.rp-k4{grid-template-columns:repeat(2,1fr)}}
.rp-kpi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:2px}
.rp-kpi .l,.rp-kpi .s{font-size:12px;color:var(--mut);font-variant-numeric:tabular-nums}
.rp-kpi .v{font-family:Georgia,serif;font-size:30px;line-height:1.15;font-variant-numeric:tabular-nums}

.rp-finds{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px;max-width:84ch}
.rp-finds li{position:relative;padding-left:22px}.rp-finds li::before{position:absolute;left:0;top:.15em;font-size:.8em}
.rp-kpi .s b{font-weight:700}.rp-knote{margin:8px 0 0;font-size:12px}
.rp-take2{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:560px){.rp-take2{grid-template-columns:1fr}}
.rp-take2>div{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.rp-take2 h4{margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:.06em}.rp-take2 .up h4{color:var(--rp-good)}.rp-take2 .down h4{color:var(--rp-low)}
.rp-note{margin:10px 0 0;font-size:13px;color:var(--mut)}
.rp-finds li.up::before{content:"▲";color:var(--rp-good)}.rp-finds li.down::before{content:"▼";color:var(--rp-low)}.rp-finds li.eq::before{content:"●";color:var(--mut)}.rp-finds b{font-variant-numeric:tabular-nums}
.rp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:14px}
/* Page Équipe : le tableau face-à-face à côté des graphiques quand il y a la place */
.rp-eq{grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));align-items:start}.rp-col{display:flex;flex-direction:column;gap:14px;min-width:0}
.rp-notes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:14px}
.rp-card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px;display:flex;flex-direction:column;gap:8px;min-width:0;break-inside:avoid}
.rp-card h3{margin:0;font-size:15px}.rp-card ul{margin:0;padding-left:1.2em;display:flex;flex-direction:column;gap:6px;font-size:13px}
.rp-scroll{overflow-x:auto}
.rp-t{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}
.rp-t th{text-align:left;font-weight:600;color:var(--mut);padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
.rp-t td{padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap;text-align:left}
.rp-t .n{text-align:right}.rp-t td.b{font-weight:700}
.rp-t tfoot td,.rp-t tr.tot td{font-weight:700;border-top:2px solid var(--line)}
.rp-t tr.grp td{padding:14px 8px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--rp-accent);border-bottom:1px solid var(--line)}
.rp-t tbody tr.grp:first-child td{padding-top:6px}
.rp-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--mut)}
.rp-legend span{display:inline-flex;align-items:center;gap:6px}.rp-legend i{width:10px;height:10px;border-radius:2px;display:inline-block}
.rp svg{display:block;overflow:visible}
.rp svg .lbl{fill:var(--ink);font-size:12px;font-variant-numeric:tabular-nums}
.rp svg .ax{fill:var(--mut);font-size:12px;font-variant-numeric:tabular-nums}
.rp-pager{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:14px;margin-top:18px}.rp-pager .btn{margin:0}
.rp-foot{margin-top:32px;font-size:12px;color:var(--mut);border-top:1px solid var(--line);padding-top:12px}
`;
