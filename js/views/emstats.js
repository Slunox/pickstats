// Statistiques combinées : feuille e-Marque (tirs réussis, points, fautes, temps de jeu)
// + saisie Pick&Stats (tirs ratés, interceptions, pertes…).

import { S } from '../state.js';
import { esc } from '../util.js';
import { tally, roster1, allP, shortNames } from '../model.js';

const ZERO = { min: '', pts: 0, p3: 0, p2i: 0, p2e: 0, lf: 0, f: 0 };
const pct = (m, a) => Math.round(100 * m / a) + ' %';
const shot = (m, a) => (a ? `<b>${m}/${a}</b><small>${pct(m, a)}</small>` : '<span class="z">—</span>');

// Ligne combinée : e = feuille e-Marque, r = stats saisies
function line(e, r) {
  const m2 = e.p2i + e.p2e;
  const a2 = m2 + (r.m2 || 0), a3 = e.p3 + (r.m3 || 0), a1 = e.lf + (r.m1 || 0);
  return { e, m2, a2, a3, a1, fg: m2 + e.p3, afg: a2 + a3 };
}

const cells = L => `<td>${esc(L.e.min) || '<span class="z">—</span>'}</td><td class="b">${L.e.pts}</td>`
  + `<td>${shot(L.fg, L.afg)}</td><td>${shot(L.m2, L.a2)}</td><td>${shot(L.e.p3, L.a3)}</td><td>${shot(L.e.lf, L.a1)}</td>`
  + `<td>${L.e.f}</td>`;

const half = (h, i) => (h && h[i] != null ? h[i] : '?');

// Score de la feuille e-Marque : équipes, score, résultat, mi-temps.
export function emScore() {
  const em = S.em;
  if (!em || !em.us) return '';
  const us = em.us.total.pts, them = em.them.total.pts;
  const res = us > them ? ['w', 'Victoire'] : us < them ? ['l', 'Défaite'] : ['d', 'Égalité'];
  const halves = em.us.halves && em.them.halves
    ? `<p class="emhalf">Mi-temps : ${half(em.us.halves, 0)}–${half(em.them.halves, 0)} · 2e mi-temps : ${half(em.us.halves, 1)}–${half(em.them.halves, 1)}${em.us.ot || em.them.ot ? ` · prolongation : ${em.us.ot}–${em.them.ot}` : ''}</p>`
    : '';
  return `<div class="emblock">
    <div class="emhead"><span>${esc(S.me)}</span><b>${us} – ${them}</b><span>${esc(S.opp)}</span></div>
    <p class="emres ${res[0]}">${res[1]}</p>${halves}
  </div>`;
}

// Tableau par joueur : feuille e-Marque (réussis, points, fautes, temps) + saisie (ratés).
export function emTable() {
  const em = S.em;
  if (!em || !em.us) return '';
  const T = tally(null);
  const nums = [...new Set([...Object.keys(em.us.players || {}), ...Object.keys(T)])]
    .sort((a, b) => (+a - +b) || a.localeCompare(b));
  const nm = shortNames(allP()); // prénom, + initiale du nom si deux joueurs ont le même
  const rows = nums.map(n => {
    const e = { ...ZERO, ...(em.us.players[n] || {}) }, r = T[n] || {};
    const name = nm[n] || roster1(n).name;
    return `<tr><th scope="row"><span class="pn">${esc(n)}</span>${esc(name) || '<span class="z">—</span>'}</th>${cells(line(e, r))}</tr>`;
  }).join('');

  // Totaux : la feuille pour l'équipe, la saisie pour les ratés de tous les joueurs
  const sum = k => Object.values(T).reduce((a, r) => a + (r[k] || 0), 0);
  const tot = line({ ...ZERO, ...em.us.total }, { m1: sum('m1'), m2: sum('m2'), m3: sum('m3') });

  return `<div class="emblock">
    <h3>Feuille e-Marque + saisie</h3>
    <div class="tscroll"><table class="st emst">
      <thead><tr><th>Joueur</th><th>Temps</th><th>Pts</th><th>Tirs</th><th>2 pts</th><th>3 pts</th><th>LF</th><th>Fautes</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th scope="row">Équipe</th>${cells(tot)}</tr></tfoot>
    </table></div>
    <p class="help tnote">Réussis/tentés : les réussis viennent de l’e-Marque, les ratés de la saisie.</p>
  </div>`;
}

// Score + tableau (écran du match en cours, une fois la feuille importée).
export const emStats = () => emScore() + emTable();
