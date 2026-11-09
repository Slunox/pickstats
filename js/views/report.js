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

function stacked(rows, max) {
  const W = 620, L = 150, R = 90, rh = 32;
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
// L'accroche et « Ce qu'il faut retenir » choisissent les plus forts dans le sens du résultat.

function factors(D, names) {
  const { us, th, s, b } = D, [, T] = names, F = [];
  const add = (k, v, why) => F.push({ k, v, why });
  const d3 = 3 * (us.total.p3 - th.total.p3);
  const d2 = 2 * ((us.total.p2i + us.total.p2e) - (th.total.p2i + th.total.p2e));
  const dlf = us.total.lf - th.total.lf;
  const dor = b.ro - b.orb;
  const poss = (b.stl + b.won) - (b.to + b.trav);
  add('p3', d3, d3 >= 0 ? `des tirs à 3 points (${us.total.p3} paniers primés contre ${th.total.p3})` : `des tirs à 3 points (${sgn(d3)} points)`);
  add('p2', d2, d2 >= 0 ? `du jeu intérieur (${sgn(d2)} points sur les paniers à 2 points)` : `des paniers à 2 points (${sgn(d2)} points)`);
  add('lf', dlf, dlf >= 0 ? `des lancers francs (${sgn(dlf)} points${s.a1 ? `, ${pc(s.lf, s.a1)}` : ''})` : `des lancers francs (${sgn(dlf)} points${s.a1 ? `, ${pc(s.lf, s.a1)}` : ''})`);
  if (b.ro + b.orb) add('or', dor, dor >= 0 ? `des rebonds offensifs (${b.ro} contre ${b.orb})` : `des rebonds offensifs (${b.orb} pour ${esc(T)} contre ${b.ro})`);
  if (b.to + b.trav + b.stl + b.won) add('ball', poss, poss >= 0 ? `des ballons gagnés (${b.stl + b.won} récupérés pour ${b.to + b.trav ? b.to + b.trav + ' perdu' + (b.to + b.trav > 1 ? 's' : '') : 'aucun perdu'})` : `des pertes de balle (${b.to + b.trav} perdus pour ${b.stl + b.won} récupérés)`);
  if (us.bench != null && th.bench != null) add('bench', (us.bench - th.bench) * 0.6, us.bench >= th.bench ? `de l’apport du banc (${us.bench} points contre ${th.bench})` : `des points du banc (${us.bench} contre ${th.bench})`);
  return F;
}

// Phrase d'accroche : résultat, scénario, puis ce qui a fait la différence.
function headline(D, names) {
  const { em, us, th } = D, [U, T] = names, d = us.total.pts - th.total.pts, ad = Math.abs(d);
  const pts = `${ad} point${ad > 1 ? 's' : ''}`;
  let t;
  if (d > 0) t = ad >= 20 ? `Large victoire de ${pts}` : ad <= 3 ? `Victoire arrachée de ${pts}` : `Victoire de ${pts}`;
  else if (d < 0) t = ad >= 20 ? `Lourde défaite de ${pts}` : ad <= 3 ? `Défaite d’un souffle (${pts})` : `Défaite de ${pts}`;
  else t = 'Match nul';
  // Scénario d'après l'avance maximale de chaque équipe (résumé e-Marque)
  if (us.adv != null && th.adv != null) {
    if (d < 0 && us.adv === 0) t += ` sans jamais mener (${esc(T)} jusqu’à +${th.adv})`;
    else if (d > 0 && th.adv === 0) t += ' en menant de bout en bout';
    else if (d > 0 && th.adv >= 8) t += ` après avoir été mené de ${th.adv} points`;
    else if (d < 0 && us.adv >= 8) t += ` malgré jusqu’à ${us.adv} points d’avance`;
    else if (em.ties >= 3 && ad <= 8) t += ` au terme d’un match accroché (${em.ties} égalités)`;
  }
  t += '.';
  const F = factors(D, names);
  if (d !== 0) {
    const dir = Math.sign(d);
    const top = F.filter(f => f.v * dir >= 4).sort((a, b) => b.v * dir - a.v * dir).slice(0, 2);
    if (top.length) t += d > 0 ? ` Ce qui a fait la différence : ${top.map(f => f.why).join(' et ')}.` : ` L’écart vient surtout ${top.map(f => f.why).join(' et ')}.`;
    // Victoire malgré un gros handicap, ou défaite malgré un point fort
    const against = F.filter(f => f.v * dir <= -6).sort((a, b) => a.v * dir - b.v * dir)[0];
    if (against) t += d > 0 ? ` Et ce, malgré le déficit ${against.why}.` : ` Pourtant, l’avantage ${against.why} n’a pas suffi.`;
  } else {
    const plus = F.filter(f => f.v >= 4).sort((a, b) => b.v - a.v)[0], minus = F.filter(f => f.v <= -4).sort((a, b) => a.v - b.v)[0];
    if (plus || minus) t += ` ${plus ? `Avantage ${plus.why}` : ''}${plus && minus ? ', mais handicap ' : minus ? 'Handicap ' : ''}${minus ? minus.why : ''}.`;
  }
  return t;
}

// --- Ce qu'il faut retenir ---
// Candidats : { p (importance), tone (+1 positif, −1 négatif, 0 neutre), t (titre), x (texte) }.

function findings(D, names) {
  const { em, us, th, s, b, players, quarters } = D, [U, T] = names, C = [];
  const d = us.total.pts - th.total.pts, res = Math.sign(d), ad = Math.abs(d);
  const add = (p, tone, t, x) => C.push({ p, tone, t, x });
  const hasEv = b.to + b.trav + b.stl + b.fd + b.ro + b.rd + b.orb + b.odr + s.a2 - s.p2 > 0;

  // Match serré : tout s'est joué à la fin
  if (ad <= 5 && quarters.length >= 4) {
    const last = quarters[quarters.length - 1], before = quarters[quarters.length - 2].cum;
    add(20, 0, d > 0 ? 'Un final maîtrisé.' : d < 0 ? 'Tout s’est joué à la fin.' : 'Rien n’a départagé les équipes.',
      `${before[0]}-${before[1]} avant le ${qName(last.i)}, que ${esc(U)} ${last.us >= last.th ? 'remporte' : 'perd'} ${last.us}-${last.th}${em.ties ? ` · <b>${em.ties}</b> égalités dans le match` : ''}.`);
  }
  // Remontée ou avance perdue, quart-temps par quart-temps
  if (quarters.length >= 4) {
    const lead = quarters.map(q => q.cum[0] - q.cum[1]);
    const low = Math.min(0, ...lead), high = Math.max(0, ...lead);
    if (d > 0 && low <= -6) {
      const q = quarters.find((x, i) => i > 0 && lead[i] > lead[i - 1] && lead[i] - lead[i - 1] >= 6) || quarters[quarters.length - 1];
      add(15, 1, 'Une belle remontée.', `Mené de <b>${-low}</b> points à la fin d’un quart-temps, ${esc(U)} a renversé le match, notamment au ${qName(q.i)} (<b>${q.us}-${q.th}</b>).`);
    }
    if (d < 0 && high >= 6) add(15, -1, 'Une avance qui a fondu.', `${esc(U)} menait de <b>${high}</b> points à la fin d’un quart-temps avant de céder.`);
    const best = quarters.reduce((a, q) => (q.us - q.th > a.us - a.th ? q : a));
    const worst = quarters.reduce((a, q) => (q.us - q.th < a.us - a.th ? q : a));
    const won = quarters.filter(q => q.us > q.th).length;
    if (best.us - best.th >= 4) {
      const rec = best.b.won + best.b.stl;
      // L'adresse n'est citée que si elle est bonne
      const shot = best.s.afg && best.s.fg / best.s.afg >= 0.4 ? `<b>${ma(best.s.fg, best.s.afg)}</b> aux tirs (<b>${pc(best.s.fg, best.s.afg)}</b>)` : '';
      const extra = [shot, rec >= 4 ? `<b>${rec}</b> ballons récupérés` : ''].filter(Boolean).join(' et ');
      add(best.us - best.th, 1, d > 0 ? `Le ${qName(best.i)} a fait la différence.` : `Le ${qName(best.i)} comme modèle.`,
        `Gagné <b>${best.us}-${best.th}</b>${extra ? ', avec ' + extra : ''}${d < 0 && won === 1 ? ' : le seul quart-temps gagné' : ''}.`);
    }
    if (worst.th - worst.us >= 6 && worst !== best) {
      add(worst.th - worst.us, -1, d > 0 ? `Un trou d’air au ${qName(worst.i)}.` : `Le ${qName(worst.i)} a coûté cher.`,
        `Perdu <b>${worst.us}-${worst.th}</b>${worst.s.afg ? `, à <b>${pc(worst.s.fg, worst.s.afg)}</b> aux tirs` : ''}${worst.b.to + worst.b.trav >= 5 ? ` et <b>${worst.b.to + worst.b.trav}</b> pertes de balle` : ''}.`);
    }
  }

  // Rebonds
  if (b.ro + b.orb + b.rd + b.odr) {
    const orbRate = b.orb + b.rd ? b.orb / (b.orb + b.rd) : 0, defRate = b.rd + b.orb ? b.rd / (b.rd + b.orb) : 0;
    if (b.orb - b.ro >= 5) {
      const worst = quarters.length ? quarters.reduce((a, q) => (q.b.orb > a.b.orb ? q : a)) : null;
      add(b.orb - b.ro, -1, d > 0 ? 'Le rebond offensif adverse, à corriger.' : 'Le rebond a pesé.',
        `${esc(T)} a pris <b>${b.orb}</b> rebonds offensifs, soit <b>${fr1(100 * orbRate)} %</b> de ses tirs ratés récupérés. ${esc(U)} n’a sécurisé que <b>${fr1(100 * defRate)} %</b> des rebonds défensifs disponibles. Au total : <b>${b.ro + b.rd}</b> rebonds contre <b>${b.orb + b.odr}</b>${worst && worst.b.orb >= 4 ? `, dont <b>${worst.b.orb}</b> rebonds offensifs adverses au ${qName(worst.i)}` : ''}.`);
    } else if (b.ro - b.orb >= 5) {
      add(b.ro - b.orb, 1, 'Domination au rebond offensif.', `<b>${b.ro}</b> rebonds offensifs contre <b>${b.orb}</b> pour ${esc(T)} : autant de secondes chances. Au total : <b>${b.ro + b.rd}</b> rebonds contre <b>${b.orb + b.odr}</b>.`);
    } else if (defRate >= 0.75 && b.rd >= 15) {
      add(6, 1, 'Un rebond défensif solide.', `<b>${fr1(100 * defRate)} %</b> des rebonds défensifs disponibles sécurisés : ${esc(T)} n’a eu que <b>${b.orb}</b> secondes chances.`);
    }
  }
  // 3 points
  const d3 = 3 * (us.total.p3 - th.total.p3);
  if (d3 <= -6) {
    add(-d3, -1, 'Peu de menace extérieure.', `<b>${ma(s.p3, s.a3)}</b> à 3 points${s.a3 ? ` (<b>${pc(s.p3, s.a3)}</b>)` : ''} contre <b>${th.total.p3}</b> paniers primés pour ${esc(T)} : <b>${sgn(d3)}</b> points sur ce seul secteur${d < 0 && -d3 >= ad ? ', plus que l’écart final' : ''}.`);
  } else if (d3 >= 6) {
    add(d3, 1, 'L’adresse à 3 points a compté.', `<b>${ma(s.p3, s.a3)}</b> à 3 points${s.a3 ? ` (<b>${pc(s.p3, s.a3)}</b>)` : ''} contre <b>${th.total.p3}</b> paniers primés pour ${esc(T)} : <b>${sgn(d3)}</b> points sur ce secteur${d > 0 && d3 >= ad ? ', plus que l’écart final' : ''}.`);
  } else if (s.a3 >= 8 && s.p3 / s.a3 >= 0.38) {
    add(5, 1, 'Bonne adresse de loin.', `<b>${ma(s.p3, s.a3)}</b> à 3 points (<b>${pc(s.p3, s.a3)}</b>).`);
  }
  // Adresse générale
  if (s.afg >= 25) {
    const r = s.fg / s.afg;
    if (r >= 0.45) add(4 + Math.round(100 * (r - 0.45)), 1, 'Une bonne adresse.', `<b>${ma(s.fg, s.afg)}</b> aux tirs (<b>${pc(s.fg, s.afg)}</b>), dont <b>${ma(s.p2, s.a2)}</b> à 2 points.`);
    else if (r < 0.33) add(4 + Math.round(100 * (0.33 - r)), -1, 'Une adresse en berne.', `<b>${ma(s.fg, s.afg)}</b> aux tirs (<b>${pc(s.fg, s.afg)}</b>) : trop de paniers faciles manqués.`);
  }
  // Lancers francs
  const dlf = us.total.lf - th.total.lf;
  if (s.a1 && (s.a1 - s.lf >= 6 || s.lf / s.a1 < 0.65)) {
    const missed = s.a1 - s.lf;
    add(0.75 * missed, -1, dlf > 0 ? 'Lancers francs : un avantage mal converti.' : 'Lancers francs à améliorer.', dlf > 0
      ? `${b.fd ? `L’équipe a provoqué <b>${b.fd}</b> fautes et ` : 'L’équipe a '}marqué <b>${dlf}</b> points de plus ${esc(que(T))} aux lancers, mais en a raté <b>${missed}</b> (${ma(s.lf, s.a1)}, ${pc(s.lf, s.a1)}).`
      : `<b>${missed}</b> lancers ratés (${ma(s.lf, s.a1)}, ${pc(s.lf, s.a1)})${dlf < 0 ? `, et <b>${-dlf}</b> points de moins ${esc(que(T))} sur la ligne` : ''}${b.fd ? `, malgré <b>${b.fd}</b> fautes provoquées` : ''}.`);
  } else if (s.a1 >= 8 && s.lf / s.a1 >= 0.75) {
    add(Math.max(4, dlf), 1, 'Des lancers francs bien convertis.', `<b>${ma(s.lf, s.a1)}</b> (<b>${pc(s.lf, s.a1)}</b>)${dlf > 0 ? `, soit <b>${dlf}</b> points de plus ${esc(que(T))} sur la ligne` : ''}${b.fd ? ` · <b>${b.fd}</b> fautes provoquées` : ''}.`);
  }
  // Pertes et gains de balle
  if (hasEv) {
    const lost = b.to + b.trav, gain = b.stl + b.won;
    if (lost >= 12) {
      const heavy = quarters.filter(q => q.b.to + q.b.trav >= Math.max(5, 1.4 * lost / Math.max(1, quarters.length)));
      add(0.8 * (lost - 10), -1, 'Trop de pertes de balle.', `<b>${b.to}</b> balles perdues${b.trav ? ` et <b>${b.trav}</b> marchers` : ''}${heavy.length ? `, dont ${heavy.map(q => `<b>${q.b.to + q.b.trav}</b> au ${qName(q.i)}`).join(' et ')}` : ''}.`);
    } else if (lost <= 8) {
      add(10 - lost, 1, 'Un ballon bien protégé.', lost ? `Seulement <b>${lost}</b> perte${lost > 1 ? 's' : ''} de balle${b.trav ? ` (dont ${b.trav} marcher${b.trav > 1 ? 's' : ''})` : ''} sur le match.` : 'Aucune perte de balle sur le match.');
    }
    if (gain >= 12 && gain > lost) add(0.8 * (gain - lost) + 3, 1, 'Une défense qui récupère des ballons.', `<b>${b.stl}</b> interceptions${b.won ? ` et <b>${b.won}</b> ballons gagnés` : ''}${lost ? `, pour <b>${lost}</b> ballons perdus` : ''}.`);
  }
  // Banc
  if (us.bench != null && th.bench != null && Math.abs(us.bench - th.bench) >= 10) {
    const db = us.bench - th.bench;
    add(Math.abs(db) / 2, Math.sign(db), db > 0 ? 'Un banc décisif.' : 'Peu d’apport du banc.', `<b>${us.bench}</b> points du banc contre <b>${th.bench}</b> pour ${esc(T)}.`);
  }
  // Joueurs
  const five = players.filter(p => p.f >= 5);
  if (five.length) {
    add(5 + 2 * five.length, 0, five.length > 1 ? `${five.length} joueurs sortis pour 5 fautes.` : 'Un joueur sorti pour 5 fautes.',
      five.map(p => `#${esc(p.n)} ${esc(first(p.name))} (<b>${p.pts}</b> pts en ${esc(p.min)})`).join(', ') + '.');
  }
  const top = players[0];
  if (top && top.pts >= 10) {
    add(6, 0, 'Meilleur marqueur.', `#${esc(top.n)} ${esc(top.name || '')} : <b>${top.pts}</b> points, ${ma(top.fg, top.afg)} aux tirs${top.a1 ? `, ${ma(top.lf, top.a1)} aux lancers` : ''}${top.stl ? `, ${top.stl} interceptions` : ''}${top.fd ? `, ${top.fd} fautes provoquées` : ''}.`);
  }
  const eff = players.filter(p => p !== top && p.afg >= 6 && p.ppt >= 1.2).sort((a, b) => b.ppt - a.ppt)[0];
  if (eff) add(4, 1, 'Le plus efficace.', `#${esc(eff.n)} ${esc(eff.name || '')} : <b>${ma(eff.fg, eff.afg)}</b> aux tirs pour <b>${eff.pts}</b> points (${eff.ppt.toFixed(2).replace('.', ',')} pt par tir).`);

  // Sélection : d'abord ce qui explique le résultat, puis l'autre face (points positifs d'une défaite,
  // points à corriger d'une victoire), puis le neutre. 6 constats au maximum.
  const by = list => list.sort((a, b) => b.p - a.p);
  const main = by(C.filter(c => (res === 0 ? c.tone !== 0 : c.tone === res)));
  const other = res === 0 ? [] : by(C.filter(c => c.tone === -res));
  const neutral = by(C.filter(c => c.tone === 0));
  const pick = [...main.slice(0, 3), ...other.slice(0, 2), ...neutral.slice(0, 1), ...main.slice(3), ...other.slice(2), ...neutral.slice(1)].slice(0, 6);
  // Ordre d'affichage : le résultat d'abord, l'autre face ensuite, le neutre à la fin
  const rank = c => (c.tone === res || res === 0 && c.tone ? 0 : c.tone === -res ? 1 : 2);
  return pick.sort((a, b) => rank(a) - rank(b) || b.p - a.p);
}


// --- Pages ---

export const PAGES = [['resume', 'Résumé'], ['quarts', 'Quart-temps'], ['equipe', 'Adresse par équipe'],
  ['joueurs', 'Adresse par joueur'], ['ballons', 'Ballons et rebonds'], ['adv', 'Adversaire'], ['methode', 'Méthode']];

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

// Tableau « Par rapport à la saison » : ce match, moyenne des autres matchs de l'équipe cette saison, écart.
// Une ligne n'apparaît que si au moins 2 autres matchs ont la donnée (feuille e-Marque pour points et adresse).
function seasonTable(table) {
  const G = seasonGames();
  if (!G) return null;
  const cur = seasonVals({ ev: S.ev, em: S.em }), V = G.list.map(seasonVals);
  const n1 = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
  const show = (x, pct) => (pct ? Math.round(x) + ' %' : n1(x));
  const rows = SEASON_ROWS.map(([k, label, up, pct]) => {
    const L = V.map(v => v[k]).filter(x => x != null);
    if (cur[k] == null || L.length < 2) return '';
    const avg = L.reduce((a, x) => a + x, 0) / L.length, d = cur[k] - avg;
    const near = pct ? Math.abs(d) < 2 : Math.abs(d) < Math.max(0.5, Math.abs(avg) * 0.05);
    const gap = near ? '≈' : (d > 0 ? '+' : '−') + (pct ? Math.round(Math.abs(d)) + ' pts' : n1(Math.abs(d)));
    return `<tr><td>${label}</td><td class="n b">${show(cur[k], pct)}</td><td class="n">${show(avg, pct)}</td>`
      + `<td class="n ${near ? '' : (d > 0) === up ? 'good' : 'low'}">${gap}</td></tr>`;
  }).join('');
  if (!rows) return null;
  return { n: G.list.length, season: G.season, html: table('<th>Indicateur</th><th class="n">Ce match</th><th class="n">Moyenne</th><th class="n">Écart</th>', rows) };
}

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
  const SEA = seasonTable(table);
  P.resume = `<div class="rp-score"><div class="rp-team"><span>${esc(U)}</span><span class="big">${us.total.pts}</span></div><span class="sep">–</span>`
    + `<div class="rp-team"><span>${esc(T)}</span><span class="big">${th.total.pts}</span></div><span class="rp-pill ${d > 0 ? 'good' : d < 0 ? 'low' : ''}">${d > 0 ? 'Victoire' : d < 0 ? 'Défaite' : 'Nul'}</span></div>`
    + qline
    + `<p class="rp-take">${headline(D, names)}</p>`
    + `<div class="rp-kpis">${kpi('Adresse aux tirs', pc(s.fg, s.afg), `${ma(s.fg, s.afg)} tirs réussis`)}${kpi('Tirs à 3 points', ma(s.p3, s.a3), `${esc(first(T))} : ${th.total.p3} paniers primés`)}`
    + `${kpi('Lancers francs', pc(s.lf, s.a1), `${ma(s.lf, s.a1)} réussis`)}${kpi('Rebonds offensifs', b.ro, `${esc(first(T))} : ${b.orb}`)}`
    + `${kpi('Balles perdues', b.to, b.trav ? `+ ${b.trav} marcher${b.trav > 1 ? 's' : ''}` : '&nbsp;')}${kpi('Interceptions', b.stl, b.won ? `+ ${b.won} ballon${b.won > 1 ? 's' : ''} gagné${b.won > 1 ? 's' : ''}` : '&nbsp;')}</div>`
    + (F.length ? `<h3 class="rp-h3">Ce qu’il faut retenir</h3><ul class="rp-finds">${F.map(f => `<li class="${f.tone > 0 ? 'up' : f.tone < 0 ? 'down' : 'eq'}"><strong>${f.t}</strong> ${f.x}</li>`).join('')}</ul>` : '')
    + (SEA ? `<h3 class="rp-h3">Par rapport à la saison</h3><p class="rp-muted">Comparé aux ${SEA.n} autres matchs de ${esc(S.me)} en ${SEA.season}. En vert : mieux que d’habitude ; en rouge : moins bien.</p>${SEA.html}` : '');

  // 2. Quart-temps
  if (quarters.length) {
    const cats = quarters.map(q => qName(q.i));
    const rows = quarters.map(q => {
      const dd = q.us - q.th;
      return `<tr><td>${qName(q.i)}</td><td class="n b">${q.us}</td><td class="n">${q.th}</td><td class="n ${dd > 0 ? 'good' : dd < 0 ? 'low' : ''}">${sgn(dd)}</td><td class="n">${q.cum[0]}-${q.cum[1]}</td>`
        + `<td class="n">${ma(q.s.fg, q.s.afg)}</td><td class="n ${tone(q.s.fg, q.s.afg)}">${pc(q.s.fg, q.s.afg)}</td><td class="n">${ma(q.s.p2, q.s.a2)}</td><td class="n">${ma(q.s.p3, q.s.a3)}</td>`
        + `<td class="n">${ma(q.s.lf, q.s.a1)}</td><td class="n">${pc(q.s.lf, q.s.a1)}</td><td class="n">${q.b.to}</td><td class="n">${q.b.trav}</td><td class="n">${q.b.stl}</td>`
        + `<td class="n">${q.b.ro + q.b.rd}</td><td class="n">${q.b.orb + q.b.odr}</td><td class="n">${q.b.orb}</td></tr>`;
    }).join('');
    const foot = `<tr><td>Total</td><td class="n">${us.total.pts}</td><td class="n">${th.total.pts}</td><td class="n">${sgn(d)}</td><td class="n">${us.total.pts}-${th.total.pts}</td>`
      + `<td class="n">${ma(s.fg, s.afg)}</td><td class="n">${pc(s.fg, s.afg)}</td><td class="n">${ma(s.p2, s.a2)}</td><td class="n">${ma(s.p3, s.a3)}</td><td class="n">${ma(s.lf, s.a1)}</td><td class="n">${pc(s.lf, s.a1)}</td>`
      + `<td class="n">${b.to}</td><td class="n">${b.trav}</td><td class="n">${b.stl}</td><td class="n">${b.ro + b.rd}</td><td class="n">${b.orb + b.odr}</td><td class="n">${b.orb}</td></tr>`;
    P.quarts = `<div class="rp-grid">`
      + card('Points marqués par quart-temps', 'Source : feuille de marque e-Marque.', legend([[cU, U], [cT, T]]) + bars(cats, [{ name: U, color: cU, vals: quarters.map(q => q.us) }, { name: T, color: cT, vals: quarters.map(q => q.th) }]))
      + card(`Adresse de ${esc(U)} par quart-temps`, 'Tirs du champ et lancers francs, en % de réussite.', legend([[cU, 'Tirs du champ'], [cLF, 'Lancers francs']])
        + bars(cats, [{ name: 'Tirs du champ', color: cU, vals: quarters.map(q => (q.s.afg ? Math.round(100 * q.s.fg / q.s.afg) : null)) }, { name: 'Lancers francs', color: cLF, vals: quarters.map(q => (q.s.a1 ? Math.round(100 * q.s.lf / q.s.a1) : null)) }], v => v + ' %', 100))
      + `</div>`
      + card('Tableau par quart-temps', 'Réussis/tentés : réussis d’après la marque courante, ratés d’après la saisie.',
        table(`<th>Quart</th><th class="n">${esc(first(U))}</th><th class="n">${esc(first(T))}</th><th class="n">Écart</th><th class="n">Cumul</th><th class="n">Tirs</th><th class="n">%</th><th class="n">2 pts</th><th class="n">3 pts</th><th class="n">LF</th><th class="n">% LF</th><th class="n">Balles perdues</th><th class="n">Marchers</th><th class="n">Interc.</th><th class="n">Reb. ${esc(first(U))}</th><th class="n">Reb. ${esc(first(T))}</th><th class="n">dont off. ${esc(first(T))}</th>`, rows, foot));
  } else {
    P.quarts = `<p class="rp-muted">Le score par quart-temps vient de la feuille de marque. Importe-la avec le résumé (fichier « feuillematch_… .pdf ») pour remplir cette page.</p>`;
  }

  // 3. Adresse par équipe
  const tp = t => [t.total.lf, 2 * (t.total.p2i + t.total.p2e), 3 * t.total.p3];
  const [uL, u2, u3] = tp(us), [tL, t2, t3] = tp(th);
  P.equipe = `<div class="rp-grid">`
    + card(`Tirs : ${esc(U)} face à ${esc(T)}`, `Tirs ratés relevés pour ${esc(U)} uniquement : pas de pourcentage pour ${esc(T)}.`,
      table(`<th>Type de tir</th><th class="n">${esc(first(U))}</th><th class="n">%</th><th class="n">${esc(first(T))} (réussis)</th>`,
        [['Tirs du champ', s.fg, s.afg, th.total.fg], ['2 points', s.p2, s.a2, th.total.p2i + th.total.p2e], ['3 points', s.p3, s.a3, th.total.p3], ['Lancers francs', s.lf, s.a1, th.total.lf]]
          .map(([l, m, a, o]) => `<tr><td>${l}</td><td class="n">${ma(m, a)}</td><td class="n ${tone(m, a)}">${pc(m, a)}</td><td class="n">${o}</td></tr>`).join('')))
    + card('Origine des points', 'Points marqués par type de panier (e-Marque).', legend([[cLF, 'Lancers francs'], [c2, 'Paniers à 2 pts'], [c3, 'Paniers à 3 pts']])
      + stacked([{ label: first(U), parts: [{ v: uL, color: cLF, name: 'Lancers francs' }, { v: u2, color: c2, name: 'Paniers à 2 pts' }, { v: u3, color: c3, name: 'Paniers à 3 pts' }], tail: us.total.pts + ' pts' },
        { label: first(T), parts: [{ v: tL, color: cLF, name: 'Lancers francs' }, { v: t2, color: c2, name: 'Paniers à 2 pts' }, { v: t3, color: c3, name: 'Paniers à 3 pts' }], tail: th.total.pts + ' pts' }]))
    + `</div>`;

  // 4. Adresse par joueur
  const prow = p => `<tr><td>${esc(p.n)}</td><td>${esc(p.name) || '–'}</td><td class="n">${esc(p.min) || '–'}</td><td class="n b">${p.pts}</td>`
    + `<td class="n">${ma(p.p2, p.a2)}</td><td class="n ${tone(p.p2, p.a2)}">${pc(p.p2, p.a2)}</td><td class="n">${ma(p.p3, p.a3)}</td><td class="n ${tone(p.p3, p.a3)}">${pc(p.p3, p.a3)}</td>`
    + `<td class="n">${ma(p.fg, p.afg)}</td><td class="n ${tone(p.fg, p.afg)}">${pc(p.fg, p.afg)}</td><td class="n">${ma(p.lf, p.a1)}</td><td class="n ${tone(p.lf, p.a1)}">${pc(p.lf, p.a1)}</td>`
    + `<td class="n">${p.ppt == null ? '–' : p.ppt.toFixed(2).replace('.', ',')}</td><td class="n ${p.f >= 5 ? 'low' : ''}">${p.f}</td></tr>`;
  const ppt = s.afg ? ((2 * s.p2 + 3 * s.p3) / s.afg).toFixed(2).replace('.', ',') : '–';
  const pfoot = `<tr><td></td><td>Équipe</td><td class="n">${esc(us.total.min)}</td><td class="n">${us.total.pts}</td><td class="n">${ma(s.p2, s.a2)}</td><td class="n">${pc(s.p2, s.a2)}</td><td class="n">${ma(s.p3, s.a3)}</td><td class="n">${pc(s.p3, s.a3)}</td>`
    + `<td class="n">${ma(s.fg, s.afg)}</td><td class="n">${pc(s.fg, s.afg)}</td><td class="n">${ma(s.lf, s.a1)}</td><td class="n">${pc(s.lf, s.a1)}</td><td class="n">${ppt}</td><td class="n">${us.total.f}</td></tr>`;
  const qTable = quarters.length && players.some(p => p.byQ.length)
    ? card('Tirs du champ par joueur et par quart-temps', 'Réussis/tentés, lancers francs exclus.',
      table(`<th>N°</th><th>Joueur</th>${quarters.map(q => `<th class="n">${qName(q.i)}</th>`).join('')}<th class="n">Total</th><th class="n">%</th>`,
        players.slice().sort((a, b) => +a.n - +b.n).map(p => `<tr><td>${esc(p.n)}</td><td>${esc(p.name) || '–'}</td>${quarters.map(q => { const x = p.byQ[q.i]; return `<td class="n">${x && x.a ? ma(x.m, x.a) : '–'}</td>`; }).join('')}<td class="n b">${ma(p.fg, p.afg)}</td><td class="n ${tone(p.fg, p.afg)}">${pc(p.fg, p.afg)}</td></tr>`).join(''),
        `<tr><td></td><td>Équipe</td>${quarters.map(q => `<td class="n">${ma(q.s.fg, q.s.afg)}</td>`).join('')}<td class="n">${ma(s.fg, s.afg)}</td><td class="n">${pc(s.fg, s.afg)}</td></tr>`))
    : '';
  P.joueurs = card('Feuille de tir individuelle', 'Tentés = réussis (e-Marque) + ratés (saisie). Pts/tir : points marqués sur tirs du champ ÷ tirs tentés (hors lancers). En vert : 50 % et plus ; en rouge : moins de 35 %.',
    table('<th>N°</th><th>Joueur</th><th class="n">Temps</th><th class="n">Pts</th><th class="n">2 pts</th><th class="n">%</th><th class="n">3 pts</th><th class="n">%</th><th class="n">Tirs</th><th class="n">%</th><th class="n">LF</th><th class="n">%</th><th class="n">Pts/tir</th><th class="n">Fautes</th>',
      players.map(prow).join(''), pfoot))
    + card('Points par joueur et type de panier', 'En bout de barre : points et adresse aux tirs du champ.', legend([[cLF, 'Lancers francs'], [c2, 'Paniers à 2 pts'], [c3, 'Paniers à 3 pts']])
      + stacked(players.map(p => ({ label: `#${p.n} ${first(p.name)}`.trim(), parts: [{ v: p.lf, color: cLF, name: 'Lancers francs' }, { v: 2 * p.p2, color: c2, name: 'Paniers à 2 pts' }, { v: 3 * p.p3, color: c3, name: 'Paniers à 3 pts' }], tail: `${p.pts} pts${p.afg ? ' · ' + Math.round(100 * p.fg / p.afg) + ' %' : ''}` }))))
    + qTable;

  // 5. Ballons et rebonds
  const brows = players.slice().sort((a, b) => b.bal - a.bal).map(p => `<tr><td>${esc(p.n)}</td><td>${esc(p.name) || '–'}</td><td class="n">${p.stl}</td><td class="n">${p.fd}</td><td class="n">${p.to}</td><td class="n">${p.trav}</td><td class="n ${p.bal > 0 ? 'good' : p.bal < 0 ? 'low' : ''}">${sgn(p.bal)}</td></tr>`).join('');
  const bal = b.stl + b.fd - b.to - b.trav;
  const offU = b.ro + b.odr ? pc(b.ro, b.ro + b.odr) : '–', offT = b.orb + b.rd ? pc(b.orb, b.orb + b.rd) : '–';
  const defU = b.rd + b.orb ? pc(b.rd, b.rd + b.orb) : '–', defT = b.odr + b.ro ? pc(b.odr, b.odr + b.ro) : '–';
  const nr = '<span class="rp-muted">non relevé</span>';
  P.ballons = card('Gains et pertes de balle par joueur', 'Bilan = interceptions + fautes provoquées − balles perdues − marchers. Indicateur interne, pas une évaluation officielle.',
    table('<th>N°</th><th>Joueur</th><th class="n">Interc.</th><th class="n">Fautes prov.</th><th class="n">Balles perdues</th><th class="n">Marchers</th><th class="n">Bilan</th>', brows,
      `<tr><td></td><td>Équipe</td><td class="n">${b.stl}</td><td class="n">${b.fd}</td><td class="n">${b.to}</td><td class="n">${b.trav}</td><td class="n">${sgn(bal)}</td></tr>`))
    + `<div class="rp-grid">`
    + card('Rebonds, fautes et ballons', 'Rebonds et ballons : saisie. Fautes : e-Marque.',
      table(`<th>Indicateur</th><th class="n">${esc(first(U))}</th><th class="n">${esc(first(T))}</th>`,
        [['Rebonds offensifs', b.ro, b.orb], ['Rebonds défensifs', b.rd, b.odr]].map(([l, x, y]) => `<tr><td>${l}</td><td class="n">${x}</td><td class="n">${y}</td></tr>`).join('')
        + `<tr class="tot"><td>Rebonds total</td><td class="n">${b.ro + b.rd}</td><td class="n">${b.orb + b.odr}</td></tr>`
        + `<tr><td>Part des rebonds offensifs pris</td><td class="n">${offU}</td><td class="n">${offT}</td></tr><tr><td>Part des rebonds défensifs pris</td><td class="n">${defU}</td><td class="n">${defT}</td></tr>`
        + `<tr><td>Fautes commises</td><td class="n">${us.total.f}</td><td class="n">${th.total.f}</td></tr>`
        + [['Fautes provoquées', b.fd], ['Interceptions', b.stl], ['Ballons gagnés', b.won], ['Balles perdues', b.to], ['Marchers', b.trav]].map(([l, v]) => `<tr><td>${l}</td><td class="n">${v}</td><td class="n">${nr}</td></tr>`).join('')))
    + (quarters.length ? card('Rebonds offensifs par quart-temps', 'Secondes chances prises par chaque équipe.', legend([[cU, U], [cT, T]])
      + bars(quarters.map(q => qName(q.i)), [{ name: U, color: cU, vals: quarters.map(q => q.b.ro) }, { name: T, color: cT, vals: quarters.map(q => q.b.orb) }])) : '')
    + `</div>`;

  // 6. Adversaire
  const opp = Object.entries(th.players || {}).map(([n, p]) => ({ n, ...p })).sort((a, b) => (b.pts - a.pts) || (+a.n - +b.n));
  const ratio = us.adv != null
    ? card('Données e-Marque du match', 'Résumé officiel de la rencontre.',
      table(`<th>Donnée</th><th class="n">${esc(first(U))}</th><th class="n">${esc(first(T))}</th>`,
        `<tr><td>Avantage maximum</td><td class="n">${us.adv}</td><td class="n">${th.adv}</td></tr><tr><td>Série maximum</td><td class="n">${us.run}</td><td class="n">${th.run}</td></tr>`
        + `<tr><td>Points du banc</td><td class="n">${us.bench}</td><td class="n">${th.bench}</td></tr>`
        + (em.ties != null ? `<tr><td>Égalités dans le match</td><td class="n" colspan="2" style="text-align:center">${em.ties}</td></tr>` : '')))
    : '';
  P.adv = `<div class="rp-grid">`
    + card(`Joueurs de ${esc(T)}`, 'Paniers réussis uniquement (e-Marque).',
      table('<th>N°</th><th class="n">Temps</th><th class="n">Pts</th><th class="n">Tirs</th><th class="n">3 pts</th><th class="n">2 pts int.</th><th class="n">2 pts ext.</th><th class="n">LF</th><th class="n">Fautes</th>',
        opp.map(p => `<tr><td>${esc(p.n)}</td><td class="n">${esc(p.min)}</td><td class="n b">${p.pts}</td><td class="n">${p.fg}</td><td class="n">${p.p3}</td><td class="n">${p.p2i}</td><td class="n">${p.p2e}</td><td class="n">${p.lf}</td><td class="n ${p.f >= 5 ? 'low' : ''}">${p.f}</td></tr>`).join('')))
    + ratio + `</div>`;

  // 7. Méthode
  P.methode = `<div class="rp-notes">`
    + card('Sources', '', `<ul><li>Résumé e-Marque (officiel) : points, paniers et lancers réussis, fautes, temps de jeu${quarters.length ? ' ; feuille de marque : score par quart-temps' : ''}.</li><li>Saisie Pick&amp;Stats (non officielle) : tirs ratés, interceptions, fautes provoquées, balles perdues, marchers, rebonds par équipe, ballons gagnés.</li></ul>`)
    + card('Méthode', '', `<ul><li>Tirs tentés = tirs réussis (e-Marque) + tirs ratés (saisie), joueur par joueur${quarters.length ? ' et quart-temps par quart-temps' : ''}.</li>${quarters.length ? '<li>Paniers et lancers réussis par quart-temps : lus sur la marque courante (numéro du joueur à chaque panier, en rouge aux 1er et 3e quarts-temps, en noir aux 2e et 4e).</li>' : ''}<li>Part des rebonds offensifs pris = rebonds offensifs ÷ (rebonds offensifs + rebonds défensifs adverses).</li></ul>`)
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
.rp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr));gap:12px}
.rp-kpi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:2px}
.rp-kpi .l,.rp-kpi .s{font-size:12px;color:var(--mut);font-variant-numeric:tabular-nums}
.rp-kpi .v{font-family:Georgia,serif;font-size:30px;line-height:1.15;font-variant-numeric:tabular-nums}
.rp-finds{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px;max-width:84ch}
.rp-finds li{position:relative;padding-left:22px}.rp-finds li::before{position:absolute;left:0;top:.15em;font-size:.8em}
.rp-finds li.up::before{content:"▲";color:var(--rp-good)}.rp-finds li.down::before{content:"▼";color:var(--rp-low)}.rp-finds li.eq::before{content:"●";color:var(--mut)}.rp-finds b{font-variant-numeric:tabular-nums}
.rp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:14px}
.rp-notes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:14px}
.rp-card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px;display:flex;flex-direction:column;gap:8px;min-width:0;break-inside:avoid}
.rp-card h3{margin:0;font-size:15px}.rp-card ul{margin:0;padding-left:1.2em;display:flex;flex-direction:column;gap:6px;font-size:13px}
.rp-scroll{overflow-x:auto}
.rp-t{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}
.rp-t th{text-align:left;font-weight:600;color:var(--mut);padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
.rp-t td{padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
.rp-t .n{text-align:right}.rp-t td.b{font-weight:700}
.rp-t tfoot td,.rp-t tr.tot td{font-weight:700;border-top:2px solid var(--line)}
.rp-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--mut)}
.rp-legend span{display:inline-flex;align-items:center;gap:6px}.rp-legend i{width:10px;height:10px;border-radius:2px;display:inline-block}
.rp svg{display:block;overflow:visible}
.rp svg .lbl{fill:var(--ink);font-size:12px;font-variant-numeric:tabular-nums}
.rp svg .ax{fill:var(--mut);font-size:12px;font-variant-numeric:tabular-nums}
.rp-pager{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:14px;margin-top:18px}.rp-pager .btn{margin:0}
.rp-foot{margin-top:32px;font-size:12px;color:var(--mut);border-top:1px solid var(--line);padding-top:12px}
`;
