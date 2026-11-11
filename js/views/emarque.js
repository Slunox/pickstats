// Import du résumé e-Marque : carte dans la fiche du match et écran de vérification.

import { S, ui, withMatch } from '../state.js';
import { esc } from '../util.js';
import { roster1 } from '../model.js';
import { checkRow, oppName } from '../emarque.js';
import { canEditMatch } from '../cloud.js';
import { back } from './common.js';

// Colonnes vérifiées : [clé, en-tête]
const COLS = [['min', 'Temps'], ['pts', 'Pts'], ['p3', '3 pts'], ['p2i', '2 pts int.'], ['p2e', '2 pts ext.'], ['lf', 'LF'], ['f', 'Fautes']];

const EM_INPUT = '<input type="file" id="emfile" accept=".pdf,application/pdf" multiple hidden>';

// Carte « Feuille e-Marque » dans la fiche d'un match archivé : seulement tant qu'aucune feuille
// n'est importée (ensuite, Remplacer / Retirer sont dans « Gérer le match »).
export function emCard(m) {
  if (m.em || !canEditMatch(m)) return '';
  if (ui.emBusy) return '<div class="card"><h3>Feuille e-Marque</h3><p class="help">Lecture du PDF…</p></div>';
  return `<div class="card"><h3>Feuille e-Marque</h3>
    <p class="help" style="margin-bottom:14px">Choisis le <b>résumé</b> (« resume_… .pdf ») et, si tu l’as, la <b>feuille de marque</b> (« feuillematch_… .pdf ») : tu peux sélectionner les deux fichiers en même temps. Tu obtiens les points, les fautes, le temps de jeu, les % de réussite et un rapport complet du match, quart-temps par quart-temps.</p>
    <button class="btn" data-x="empick">Importer la feuille e-Marque</button>${EM_INPUT}
  </div>`;
}

// Feuille déjà importée : infos, Remplacer / Retirer (dans « Gérer le match »).
export function emManage(m) {
  if (!m.em || !canEditMatch(m)) return '';
  if (ui.emBusy) return '<p class="help">Lecture du PDF…</p>';
  return `<p class="help" style="margin-top:0">Importée${m.em.num ? ' (rencontre n° ' + esc(m.em.num) + ')' : ''}${m.em.us && m.em.us.q ? ', avec le score par quart-temps' : ' (sans la feuille de marque : pas de détail par quart-temps)'}.</p>
    <button class="btn alt" data-x="empick">Remplacer</button><button class="btn alt" data-x="emdel">Retirer</button>${EM_INPUT}`;
}

// Nom de l'adversaire à enregistrer : celui de la feuille (l'autre équipe), sauf s'il a été corrigé.
export const oppOf = E => E.opp != null ? E.opp : oppName(E.side ? E.data.a : E.data.b);

// Écran de vérification avant d'enregistrer.
export function emCheck() {
  const E = ui.em;
  const m = E && (S.arch || []).find(z => String(z.id) === String(E.gid));
  if (!m) return '<div class="card"><p class="help">Match introuvable.</p></div>';
  const d = E.data, side = E.side, us = d.teams[side], them = d.teams[1 - side];
  const names = [d.a || 'Locaux', d.b || 'Visiteurs'];
  const nums = new Set((m.roster || []).map(p => String(p.n)));
  const nameOf = n => withMatch(m, () => roster1(n).name);

  const rows = us.players.map((p, i) => {
    const ok = checkRow(p), inRoster = nums.has(p.n);
    return `<tr class="${ok ? '' : 'bad'}"><th scope="row">#${esc(p.n)} ${inRoster ? esc(nameOf(p.n)) : '<span class="z">hors composition</span>'}</th>`
      + COLS.map(([k]) => `<td><input class="emi${k === 'min' ? ' w' : ''}" data-emv="${i}|${k}" value="${esc(p[k])}" inputmode="${k === 'min' ? 'text' : 'numeric'}" aria-label="${k}"></td>`).join('')
      + '</tr>';
  }).join('');

  const bad = us.players.filter(p => !checkRow(p)).length;
  const sum = us.players.reduce((a, p) => a + (+p.pts || 0), 0);
  const missing = [...nums].filter(n => !us.players.some(p => p.n === n));
  const warn = [
    bad ? `<p class="emwarn">${bad} ligne${bad > 1 ? 's' : ''} en rouge : les points ne correspondent pas aux tirs réussis. Compare avec la feuille et corrige.</p>` : '',
    sum !== us.total.pts ? `<p class="emwarn">Le total des joueurs (${sum} pts) ne correspond pas au total de l’équipe (${us.total.pts} pts).</p>` : '',
    missing.length ? `<p class="help">Joueurs de la composition absents de la feuille : ${missing.map(n => '#' + esc(n)).join(', ')}.</p>` : '',
  ].join('');

  return back('Annuler', 'emcancel') + `<div class="card">
    <h2>Vérifier la feuille e-Marque</h2>
    <p class="help" style="margin-top:0">${esc(m.me)} contre ${esc(m.opp)}${d.num ? ' · rencontre n° ' + esc(d.num) : ''}</p>
    <label>Mon équipe sur la feuille</label>
    <div class="chips">${[0, 1].map(s => `<button class="chip${side === s ? ' on' : ''}" data-x="emside" data-v="${s}">${s ? 'Visiteurs' : 'Locaux'} : ${esc(names[s])}</button>`).join('')}</div>
    <label for="emopp">Nom de l’adversaire</label>
    <input id="emopp" data-emo value="${esc(oppOf(E) || m.opp)}" maxlength="60" autocomplete="off">
    <p class="help" style="margin-top:4px">${!oppOf(E).trim() ? 'Nom de l’adversaire non lu sur la feuille : le nom actuel est gardé, tu peux le corriger.'
      : oppOf(E).trim() !== m.opp ? `Repris de la feuille : il remplacera « ${esc(m.opp)} » dans le match. Tu peux le corriger.` : 'Repris de la feuille.'}</p>
    <p class="emscore"><b>${us.total.pts}</b> – <b>${them.total.pts}</b> <span>${us.total.pts > them.total.pts ? 'Victoire' : us.total.pts < them.total.pts ? 'Défaite' : 'Égalité'}</span></p>
    ${d.quarters ? `<p class="help" style="margin:0">Par quart-temps : ${d.quarters[side].map((q, i) => `${i < 4 ? 'Q' + (i + 1) : 'Prol.'} ${q.pts}-${d.quarters[1 - side][i] ? d.quarters[1 - side][i].pts : '?'}`).join(' · ')}</p>` : '<p class="help" style="margin:0">Sans la feuille de marque : pas de score par quart-temps.</p>'}
    ${(d.warn || []).map(w => `<p class="emwarn">${esc(w)}</p>`).join('')}
    ${warn}
    <div class="tscroll"><table class="st emt">
      <thead><tr><th>Joueur</th>${COLS.map(([, h]) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="help">Les joueurs sont reliés par leur numéro de maillot. Corrige une valeur si elle ne correspond pas à la feuille.</p>
    <button class="btn go2" data-x="emsave">Enregistrer dans le match</button>
  </div>`;
}
