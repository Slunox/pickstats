// Image des stats à partager (WhatsApp…) : dessinée sur un canvas, sans bibliothèque,
// pour fonctionner hors ligne et sur iPad. Même contenu que l'écran Statistiques.

import { S, ui, withMatch } from './state.js';
import { WON } from './constants.js';
import { qLabel } from './util.js';
import { tally, cnt, miss, curG, curTeamColor } from './model.js';
import { toast, ask } from './dom.js';

const W = 1080, PAD = 40;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const C = {
  bg: '#EEF2F4', card: '#FFFFFF', ink: '#16242C', mut: '#667279', line: '#DCE3E6', zero: '#C3CDD2',
  n: '#BDE7C9', f: '#F6D98B', r: '#F5C6C0', opp: '#C2410C',
};
const COLS = [
  ['stl', 'Interc.', 'n'], ['fd', 'Fautes\nprov.', 'n'],
  ['to', 'Balles\nperdues', 'f'], ['trav', 'Marchers', 'f'],
  ['miss', 'Total', 'r'], ['m2', '2 pts', 'r'], ['m3', '3 pts', 'r'], ['m1', 'LF', 'r'],
];

const font = (w, s) => `${w} ${s}px ${FONT}`;

function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

// Texte raccourci avec « … » s'il dépasse la largeur.
function fit(g, t, max) {
  t = String(t);
  if (g.measureText(t).width <= max) return t;
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

function loadImg(src) {
  return new Promise(ok => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = src;
  });
}

// Dessine l'image des stats de la période q (null = tout le match) et renvoie le canvas.
// Synchrone : sur un match archivé, elle est appelée dans withMatch (qui ne dure pas au-delà d'un await).
export function drawStats(q, date, logo) {
  const T = Object.values(tally(q)).map(r => ({ ...r, miss: miss(r) }));
  const s = k => T.reduce((a, r) => a + r[k], 0);
  const max = k => Math.max(0, ...T.map(r => r[k]));
  const won = WON.map(w => cnt(w[0], q)), wonT = won.reduce((a, b) => a + b, 0);
  const ro = cnt('ro', q), rd = cnt('rd', q), orb = cnt('orb', q), odr = cnt('odr', q);
  const tc = curTeamColor();

  const ROW = 58, HEAD = 190, TILE = 110, TILES = TILE * 2 + 14, TH = 96;
  const tableH = TH + Math.max(1, T.length) * ROW + ROW + 20;
  const H = HEAD + 30 + TILES + 30 + tableH + 30 + 300 + 70;

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.textBaseline = 'middle';
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);

  // --- En-tête aux couleurs de l'équipe ---
  const hg = g.createLinearGradient(0, 0, W, HEAD);
  hg.addColorStop(0, tc); hg.addColorStop(1, '#0F2A36');
  g.fillStyle = hg; g.fillRect(0, 0, W, HEAD);
  let tx = PAD;
  if (logo) {
    g.save(); g.beginPath(); g.arc(PAD + 60, HEAD / 2, 60, 0, 7); g.fillStyle = '#fff'; g.fill(); g.clip();
    g.drawImage(logo, PAD, HEAD / 2 - 60, 120, 120);
    g.restore();
    tx = PAD + 150;
  }
  g.fillStyle = '#fff';
  g.font = font(800, 48);
  g.fillText(fit(g, `${S.me} contre ${S.opp}`, W - tx - PAD), tx, HEAD / 2 - 26);
  g.font = font(600, 28);
  g.fillStyle = 'rgba(255,255,255,.85)';
  const when = new Date(date || Date.now()).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  g.fillText(fit(g, [q == null ? 'Total du match' : qLabel(q), when, S.clubName].filter(Boolean).join(' · '), W - tx - PAD), tx, HEAD / 2 + 28);

  // --- Tuiles des chiffres clés ---
  let y = HEAD + 30;
  const tiles = [
    [s('stl'), 'Interceptions', 'n'], [s('fd'), 'Fautes prov.', 'n'], [s('to') + s('trav'), 'Pertes de balle', 'f'],
    [s('miss'), 'Tirs ratés', 'r'], [ro + rd, 'Rebonds', 'n'], [wonT, 'Ballons gagnés', 'n'],
  ];
  // 2 lignes de 3 tuiles : chiffre à gauche, intitulé à droite
  const tw = (W - 2 * PAD - 2 * 14) / 3;
  tiles.forEach(([v, l, k], i) => {
    const x = PAD + (i % 3) * (tw + 14), ty = y + Math.floor(i / 3) * (TILE + 14);
    g.fillStyle = C.card; rrect(g, x, ty, tw, TILE, 18); g.fill();
    g.fillStyle = C[k]; rrect(g, x, ty, 8, TILE, [18, 0, 0, 18]); g.fill();
    g.textAlign = 'left'; g.fillStyle = C.ink; g.font = font(800, 56);
    g.fillText(String(v), x + 30, ty + TILE / 2 + 2);
    const vw = Math.max(70, g.measureText(String(v)).width + 22);
    g.fillStyle = C.mut; g.font = font(600, 24); g.fillText(fit(g, l, tw - vw - 46), x + 30 + vw, ty + TILE / 2 + 2);
  });

  // --- Tableau des joueurs ---
  y += TILES + 30;
  g.fillStyle = C.card; rrect(g, PAD, y, W - 2 * PAD, tableH, 22); g.fill();
  const x0 = PAD + 20, nameW = 290, cw = (W - 2 * PAD - 40 - nameW) / COLS.length;
  const colX = i => x0 + nameW + i * cw + cw / 2;
  // Bandeaux de groupes
  [['POSITIF', 0, 2, 'n'], ['PERTES', 2, 2, 'f'], ['TIRS RATÉS', 4, 4, 'r']].forEach(([l, i, n, k]) => {
    const gx = x0 + nameW + i * cw + 4;
    g.fillStyle = C[k]; rrect(g, gx, y + 16, n * cw - 8, 30, 10); g.fill();
    g.fillStyle = C.ink; g.font = font(800, 17); g.textAlign = 'center';
    g.fillText(l, gx + (n * cw - 8) / 2, y + 32);
  });
  g.font = font(700, 19); g.fillStyle = C.mut;
  g.textAlign = 'left'; g.fillText('Joueur', x0, y + 74);
  g.textAlign = 'center';
  COLS.forEach(([, h], i) => {
    const lines = h.split('\n');
    lines.forEach((ln, j) => g.fillText(ln, colX(i), y + 74 + (j - (lines.length - 1) / 2) * 21));
  });
  let ry = y + TH;
  const M = Object.fromEntries(COLS.map(([k]) => [k, max(k)]));
  T.forEach((r, n) => {
    if (n % 2) { g.fillStyle = '#F5F8F9'; g.fillRect(x0 - 8, ry, W - 2 * PAD - 24, ROW); }
    // Numéro en pastille couleur d'équipe, puis nom
    g.textAlign = 'center'; g.font = font(800, 22);
    const nw = Math.max(44, g.measureText(r.n).width + 20);
    g.fillStyle = tc; rrect(g, x0, ry + 12, nw, ROW - 24, 9); g.fill();
    g.fillStyle = '#fff'; g.fillText(r.n, x0 + nw / 2, ry + ROW / 2 + 1);
    g.textAlign = 'left'; g.font = font(700, 24); g.fillStyle = r.name ? C.ink : C.zero;
    g.fillText(fit(g, r.name || '—', nameW - nw - 26), x0 + nw + 14, ry + ROW / 2 + 1);
    g.textAlign = 'center';
    COLS.forEach(([k, , grp], i) => {
      const v = r[k], best = v && v === M[k];
      if (best) {
        g.font = font(800, 26);
        const bw = Math.max(46, g.measureText(String(v)).width + 26);
        g.fillStyle = C[grp]; rrect(g, colX(i) - bw / 2, ry + 11, bw, ROW - 22, 18); g.fill();
        g.fillStyle = C.ink;
      } else {
        g.font = font(v ? (k === 'miss' ? 800 : 600) : 400, 26);
        g.fillStyle = v ? C.ink : C.zero;
      }
      g.fillText(String(v), colX(i), ry + ROW / 2 + 1);
    });
    g.fillStyle = C.line; g.fillRect(x0 - 8, ry + ROW - 1, W - 2 * PAD - 24, 1);
    ry += ROW;
  });
  if (!T.length) { g.fillStyle = C.mut; g.font = font(600, 24); g.fillText('Aucun joueur', W / 2, ry + ROW / 2); ry += ROW; }
  // Ligne équipe
  g.fillStyle = C.bg; rrect(g, x0 - 8, ry + 8, W - 2 * PAD - 24, ROW, 14); g.fill();
  g.textAlign = 'left'; g.fillStyle = C.ink; g.font = font(800, 24); g.fillText('Équipe', x0 + 6, ry + 8 + ROW / 2);
  g.textAlign = 'center';
  COLS.forEach(([k], i) => g.fillText(String(s(k)), colX(i), ry + 8 + ROW / 2));

  // --- Rebonds (nous / eux) et ballons gagnés ---
  y += tableH + 30;
  const bw = (W - 2 * PAD - 20) / 2, bh = 300;
  g.textAlign = 'left';
  g.fillStyle = C.card; rrect(g, PAD, y, bw, bh, 22); g.fill();
  g.fillStyle = C.ink; g.font = font(800, 28); g.fillText('Rebonds', PAD + 24, y + 38);
  g.font = font(800, 20); g.fillStyle = tc; g.fillText(fit(g, S.me, bw / 2 - 30), PAD + 24, y + 76);
  g.textAlign = 'right'; g.fillStyle = C.opp; g.fillText(fit(g, S.opp, bw / 2 - 30), PAD + bw - 24, y + 76);
  [['Offensifs', ro, orb], ['Défensifs', rd, odr], ['Total', ro + rd, orb + odr]].forEach(([l, a, b], i) => {
    const yy = y + 116 + i * 62, x1 = PAD + 24, x2 = PAD + bw - 24, t = a + b, p = t ? a / t : 0.5;
    g.font = font(800, 30); g.fillStyle = C.ink;
    g.textAlign = 'left'; g.fillText(String(a), x1, yy);
    g.textAlign = 'right'; g.fillText(String(b), x2, yy);
    g.textAlign = 'center'; g.font = font(600, 20); g.fillStyle = C.mut; g.fillText(l, (x1 + x2) / 2, yy);
    const by = yy + 24, len = x2 - x1;
    g.fillStyle = C.opp; rrect(g, x1, by, len, 10, 5); g.fill();
    g.fillStyle = tc; rrect(g, x1, by, Math.max(len * p - 2, 0), 10, [5, 0, 0, 5]); g.fill();
  });
  const bx = PAD + bw + 20;
  g.textAlign = 'left';
  g.fillStyle = C.card; rrect(g, bx, y, bw, bh, 22); g.fill();
  g.fillStyle = C.ink; g.font = font(800, 28); g.fillText('Ballons gagnés', bx + 24, y + 38);
  const cells = [...WON.map((w, i) => [won[i], w[1]]), [wonT, 'Total']];
  const cwid = (bw - 48 - 4 * 10) / 5;
  cells.forEach(([v, l], i) => {
    const cx = bx + 24 + i * (cwid + 10), last = i === cells.length - 1;
    g.fillStyle = last ? tc : C.bg; rrect(g, cx, y + 90, cwid, 150, 16); g.fill();
    g.textAlign = 'center';
    g.fillStyle = last ? '#fff' : C.ink; g.font = font(800, 44); g.fillText(String(v), cx + cwid / 2, y + 150);
    g.fillStyle = last ? 'rgba(255,255,255,.85)' : C.mut; g.font = font(600, 19); g.fillText(l, cx + cwid / 2, y + 205);
  });

  // --- Pied de page ---
  g.textAlign = 'center'; g.fillStyle = C.mut; g.font = font(600, 20);
  g.fillText('Pick&Stats', W / 2, H - 34);
  return c;
}

// Partage l'image (feuille de partage du système), sinon la télécharge.
export async function shareImage() {
  const q = ui.sq === 'all' ? null : +ui.sq;
  const g = ui.view === 'game' ? curG() : null;
  toast('Préparation de l’image…');
  const logo = S.clubLogo ? await loadImg(S.clubLogo) : null;
  // Tout ce qui lit le match se fait d'un bloc, sans attente (voir drawStats).
  const make = () => ({
    c: drawStats(q, g ? g.date : Date.now(), logo),
    me: S.me, opp: S.opp,
  });
  const { c, me, opp } = g ? withMatch(g, make) : make();
  const blob = await new Promise(ok => c.toBlob(ok, 'image/png'));
  const clean = t => String(t).normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\w-]+/g, '_');
  const name = `stats-${clean(me)}-${clean(opp)}${q == null ? '' : '-' + clean(qLabel(q))}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    const go = () => navigator.share({ files: [file], title: me + ' contre ' + opp }).catch(() => {});
    try { await navigator.share({ files: [file], title: me + ' contre ' + opp }); return; }
    catch (e) {
      if (e && e.name === 'AbortError') return;
      // Le navigateur exige un appui juste avant le partage (iPad) : on le redemande.
      if (e && e.name === 'NotAllowedError') { ask('L’image des stats est prête.', 'Partager', go); return; }
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('Image enregistrée');
}
