// Feuille e-Marque recréée à partir des données enregistrées avec le match (m.em) :
// à l'écran, en fichier HTML autonome, ou imprimée (PDF).
// Le PDF d'origine n'est pas gardé : on refait le résumé (équipes, score, joueurs, chiffres clés).

import { S, withMatch } from '../state.js';
import { esc } from '../util.js';
import { roster1, curG } from '../model.js';
import { back } from './common.js';
import { matchInfo } from '../emarque.js';

// Styles propres à la feuille (repris tels quels dans le fichier exporté et à l'impression).
export const SHEET_CSS = `.ems{--l:var(--line,#d6dbd7);--m:var(--mut,#5d6862)}
.ems .emsh{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-end;border-bottom:2px solid currentColor;padding-bottom:8px;margin-bottom:12px}
.ems .emsh h2{margin:0;font-size:1.25rem}.ems .emsh p{margin:2px 0 0;color:var(--m);font-size:.9rem}
.ems .emsc{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;text-align:center;margin:10px 0 16px}
.ems .emsc b{display:block;font-size:2rem;line-height:1.1}.ems .emsc span{font-size:.85rem;color:var(--m)}.ems .emsc .t{font-weight:600;font-size:.95rem}
.ems h3{font-size:1rem;margin:18px 0 6px}.ems .emw{overflow-x:auto}
.ems table{border-collapse:collapse;width:100%;font-size:.88rem;font-variant-numeric:tabular-nums}
.ems th,.ems td{border-bottom:1px solid var(--l);padding:5px 6px;text-align:right;white-space:nowrap}
.ems th:nth-child(-n+2),.ems td:nth-child(-n+2){text-align:left}.ems .emq th:first-child,.ems .emq td:first-child{text-align:left}
.ems .emq th:nth-child(2),.ems .emq td:nth-child(2){text-align:right}
.ems thead th{font-size:.78rem;color:var(--m);font-weight:600}.ems tfoot td{font-weight:700;border-top:2px solid var(--l)}
.ems td.f5{color:#c0392b;font-weight:700}.ems .emn{margin-top:14px;font-size:.78rem;color:var(--m)}`;

const qLab = (i, n) => (i < 4 ? 'Q' + (i + 1) : n > 5 ? 'Prol. ' + (i - 3) : 'Prol.');
const COLS = [['min', 'Temps'], ['pts', 'Pts'], ['fg', 'Tirs'], ['p3', '3 pts'], ['p2i', '2 pts int.'], ['p2e', '2 pts ext.'], ['lf', 'LF'], ['f', 'Fautes']];

// Les deux équipes dans l'ordre de la feuille : locaux (A) puis visiteurs (B). À appeler dans withMatch.
function sides(m) {
  const em = m.em, nameUs = em.side ? em.b : em.a, nameTh = em.them.name || (em.side ? em.a : em.b);
  const us = { t: em.us, name: nameUs || S.me, nameOf: p => p.name || roster1(p.n).name };
  const th = { t: em.them, name: nameTh || S.opp, nameOf: p => p.name || '' };
  return em.side ? [th, us] : [us, th];
}

function teamTable(s, label) {
  const P = Object.entries(s.t.players || {}).map(([n, p]) => ({ n, ...p })).sort((a, b) => +a.n - +b.n);
  const tot = s.t.total || {};
  return `<h3>${label} : ${esc(s.name)}</h3><div class="emw"><table>
    <thead><tr><th>N°</th><th>Joueur</th>${COLS.map(([, h]) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${P.map(p => `<tr><td>${esc(p.n)}</td><td>${esc(s.nameOf(p)) || '–'}</td>${COLS.map(([k]) => `<td${k === 'f' && p.f >= 5 ? ' class="f5"' : ''}>${esc(p[k] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
    <tfoot><tr><td></td><td>Équipe</td>${COLS.map(([k]) => `<td>${esc(tot[k] ?? '')}</td>`).join('')}</tr></tfoot>
  </table></div>`;
}

// Score par quart-temps (feuille de marque), sinon par mi-temps.
function periodTable(A, B) {
  const qa = A.t.q, qb = B.t.q;
  let heads, va, vb;
  if (qa && qb) { const n = Math.max(qa.length, qb.length); heads = [...Array(n)].map((_, i) => qLab(i, n)); va = qa; vb = qb; }
  else if (A.t.halves && B.t.halves) { heads = ['1re mi-temps', '2e mi-temps']; va = A.t.halves; vb = B.t.halves; if (A.t.ot || B.t.ot) { heads.push('Prol.'); va = [...va, A.t.ot]; vb = [...vb, B.t.ot]; } }
  else return '';
  const row = (s, v) => `<tr><td>${esc(s.name)}</td>${heads.map((_, i) => `<td>${v[i] ?? '–'}</td>`).join('')}<td><b>${s.t.total.pts}</b></td></tr>`;
  return `<h3>Score par période</h3><div class="emw"><table class="emq"><thead><tr><th>Équipe</th>${heads.map(h => `<th>${h}</th>`).join('')}<th>Total</th></tr></thead>
    <tbody>${row(A, va)}${row(B, vb)}</tbody></table></div>`;
}

function ratios(m, A, B) {
  const r = k => A.t[k] != null && B.t[k] != null;
  const lines = [['adv', 'Avantage maximum'], ['run', 'Série maximum'], ['bench', 'Points du banc']].filter(([k]) => r(k));
  if (!lines.length && m.em.ties == null) return '';
  return `<h3>Chiffres clés</h3><div class="emw"><table class="emq"><thead><tr><th></th><th>${esc(A.name)}</th><th>${esc(B.name)}</th></tr></thead><tbody>`
    + lines.map(([k, l]) => `<tr><td>${l}</td><td>${A.t[k]}</td><td>${B.t[k]}</td></tr>`).join('')
    + (m.em.ties != null ? `<tr><td>Égalités</td><td colspan="2" style="text-align:center">${m.em.ties}</td></tr>` : '')
    + '</tbody></table></div>';
}

// Contenu de la feuille (à appeler dans withMatch).
export function sheetBody(m) {
  const [A, B] = sides(m), em = m.em;
  return `<div class="ems">
    <div class="emsh"><div><h2>Résumé de la rencontre</h2><p>${esc(matchInfo(em, m.date))}</p></div>${S.clubName ? `<p>${esc(S.clubName)}</p>` : ''}</div>
    <div class="emsc"><div><span>Locaux</span><div class="t">${esc(A.name)}</div><b>${A.t.total.pts}</b></div><span>–</span><div><span>Visiteurs</span><div class="t">${esc(B.name)}</div><b>${B.t.total.pts}</b></div></div>
    ${periodTable(A, B)}
    ${teamTable(A, 'Locaux')}
    ${teamTable(B, 'Visiteurs')}
    ${ratios(m, A, B)}
    <p class="emn">Feuille recréée par Pick&amp;Stats à partir du résumé e-Marque importé${em.us.q ? ' et de la feuille de marque' : ''}. Tirs = paniers réussis. Ce document ne remplace pas la feuille officielle.</p>
  </div>`;
}

// Écran dans l'appli.
export function emSheet() {
  const m = curG();
  if (!m || !m.em) return '<div class="card"><p class="help">Pas de feuille e-Marque pour ce match.</p></div>';
  return back('Fiche du match', 'view', 'game', 'Feuille de marque') + `<style>${SHEET_CSS}</style><div class="card">${withMatch(m, () => sheetBody(m))}
    <div class="crow" style="margin-top:14px"><button class="btn" data-x="emsfile">Télécharger (HTML)</button><button class="btn alt" data-x="emsprint">Imprimer / PDF</button></div></div>`;
}

// Fichier HTML autonome (à appeler dans withMatch).
export function sheetFile(m) {
  const title = `Feuille ${S.me} – ${S.opp} ${new Date(m.date).toLocaleDateString('fr-FR')}`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>`
    + `<style>:root{color-scheme:light dark;--line:#d6dbd7;--mut:#5d6862}body{margin:0;background:#fff;color:#1b2420;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}`
    + `@media (prefers-color-scheme:dark){:root{--line:#2c3531;--mut:#9aa6a0}body{background:#121715;color:#e7ece9}}`
    + `main{max-width:900px;margin:0 auto;padding:24px 16px 40px}@media print{:root{--line:#bbb;--mut:#555}body{background:#fff;color:#000}main{padding:0}}${SHEET_CSS}</style></head>`
    + `<body><main>${sheetBody(m)}</main></body></html>`;
}
