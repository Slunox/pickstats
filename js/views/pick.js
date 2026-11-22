// Démarrage d'un match : choix de l'équipe puis composition.

import { S, ui } from '../state.js';
import { esc, plural } from '../util.js';
import { sortedTeams, jerseys } from '../model.js';
import { back } from './common.js';

function chooseTeam() {
  const list = S.teams.length
    ? sortedTeams().map(t => `<button class="teamrow" data-x="pickteam" data-id="${t.id}"><b>${esc(t.name)}</b><span>${plural(t.players.length, 'joueur')}</span></button>`).join('')
    : '<p class="help">Tu n’as pas encore créé d’équipe.</p><button class="btn" data-x="view" data-v="club">Effectifs et matchs</button>';
  return back('Accueil', 'view', 'home', 'Nouveau match') + `<div class="card"><h2>Quelle équipe joue ?</h2>${list}</div>`;
}

export function pick() {
  const P = ui.P;
  if (!P) return '';
  if (!P.teamId) return chooseTeam();

  const t = S.teams.find(z => z.id === P.teamId);
  // Les doublons et numéros manquants sont en rouge dès l'ouverture,
  // pas seulement après une saisie : markDup ne tourne qu'à la frappe.
  const c = dupCount(P.rows);
  const rows = P.rows.length
    ? P.rows.map((r, i) => `<div class="prow3">
        <input type="checkbox" data-pc="${i}"${r.in ? ' checked' : ''} aria-label="Présent">
        <span class="pname">${esc(r.name) || 'Sans nom'}</span>
        <input data-pnum="${i}"${isDup(r, c) ? ' class="dup"' : ''} value="${esc(r.num)}" inputmode="numeric" maxlength="3" placeholder="N°" aria-label="Numéro du match">
      </div>`).join('')
    : '<p class="help">Cette équipe n’a aucun joueur. Ajoute-en depuis « Effectifs et matchs ».</p>';

  return back('Choisir une autre équipe', 'pickback', null, 'Composition') + `
  <div class="card">
    <h2>${esc(t ? t.name : '')} : composition</h2>
    <label>Équipe adverse</label>
    <input data-po="1" value="${esc(P.opp)}" placeholder="Nom de l’adversaire" maxlength="30" aria-label="Équipe adverse">
    ${jerseys(P.myColor, P.oppColor, t ? t.name : 'Mon équipe', (P.opp || '').trim())}
    <p class="help">Coche les joueurs présents et donne à chacun son numéro pour ce match.</p>
    <div class="chips" style="margin-top:10px">
      <button class="chip" data-x="pallin" data-v="1">Tout présent</button>
      <button class="chip" data-x="pallin" data-v="0">Tout absent</button>
    </div>
    <div class="prow3 head"><span></span><span>Joueur</span><span>N° du match</span></div>
    ${rows}
    <p class="adderr" id="perr"></p>
    <button class="btn go2" data-x="pstart">Démarrer le match</button>
  </div>`;
}

// Combien de joueurs cochés portent chaque numéro.
function dupCount(rows) {
  const c = {};
  rows.forEach(r => {
    if (!r.in) return;
    const n = String(r.num).trim();
    if (n) c[n] = (c[n] || 0) + 1;
  });
  return c;
}
// En rouge : un joueur coché sans numéro, ou dont le numéro est porté par un autre joueur coché.
const isDup = (r, c) => { const n = String(r.num ?? '').trim(); return r.in && (!n || c[n] > 1); };

// Signale en rouge les numéros manquants ou en double parmi les joueurs cochés (frappe, coche).
export function markDup() {
  const c = dupCount(ui.P.rows);
  document.querySelectorAll('[data-pnum]').forEach(i => {
    i.classList.toggle('dup', isDup(ui.P.rows[+i.dataset.pnum], c));
  });
}
