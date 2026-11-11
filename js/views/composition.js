// Composition pendant un match en cours.

import { S } from '../state.js';
import { esc } from '../util.js';
import { dupN, matchTeam, oppSwatches } from '../model.js';

const key = v => String(v || '').trim().toLowerCase();

export function comp() {
  const t = matchTeam();
  // Joueurs de l'équipe pas encore dans le match (repérés par id, sinon par nom).
  const pids = new Set(S.roster.map(r => r.pid).filter(Boolean));
  const names = new Set(S.roster.map(r => key(r.name)).filter(Boolean));
  const others = t ? t.players.filter(p => !pids.has(p.id) && !(key(p.name) && names.has(key(p.name)))) : [];
  const hasEv = n => { const v = String(n).trim(); return v !== '' && S.ev.some(e => e.p === v); };

  const rows = S.roster.length
    ? S.roster.map((r, i) => `<div class="prow4">
        <input type="checkbox" data-cin="${i}"${r.in !== false ? ' checked' : ''} aria-label="Présent">
        ${r.nw ? `<input data-cname="${i}" value="${esc(r.name)}" placeholder="Nom du joueur" aria-label="Nom">` : `<span class="cname">${esc(r.name) || '<span class="z">Sans nom</span>'}</span>`}
        <input data-cnum="${i}" class="${dupN(r.n, i) ? 'dup' : ''}" value="${esc(r.n)}" inputmode="numeric" maxlength="3" placeholder="N°" aria-label="Numéro du match">
        <button class="del" data-x="cdel" data-i="${i}"${hasEv(r.n) ? ' disabled' : ''} aria-label="Retirer ce joueur">✕</button>
      </div>`).join('')
    : '<p class="help">Aucun joueur dans ce match.</p>';

  const add = others.length ? `<h3>Ajouter un joueur de l’équipe</h3>
    <div class="chips">${others.map(p => `<button class="chip" data-x="cadd" data-id="${p.id}">+ ${esc(p.name || 'Sans nom')}${String(p.num || '').trim() ? ' (#' + esc(p.num) + ')' : ''}</button>`).join('')}</div>` : '';

  return `<div class="card">
    <h2>Composition${t ? ' : ' + esc(t.name) : ''}</h2>
    <label>Équipe adverse</label>
    <input data-f="opp" value="${esc(S.opp)}" placeholder="Nom de l’adversaire" maxlength="30" aria-label="Équipe adverse">
    ${oppSwatches(S.oppColor)}
    <p class="help" style="margin:10px 0">Décoche un joueur pour le retirer de l’écran de saisie : ses stats déjà saisies restent dans les statistiques. Changer un numéro déplace aussi ses actions déjà saisies. Les noms des joueurs de l’équipe se modifient dans la fiche de l’équipe.</p>
    <div class="prow4 head"><span></span><span>Joueur</span><span>N° du match</span><span></span></div>
    ${rows}
    <p class="help">La croix est grisée pour un joueur qui a déjà des actions : décoche-le plutôt.</p>
    ${add}
    <h3>Joueur qui n’est pas dans l’équipe</h3>
    <button class="btn" data-x="cnew">Nouveau joueur</button>
    <p class="help">Il est ajouté à ce match uniquement : l’équipe${t ? ' ' + esc(t.name) : ''} ne change pas.</p>
  </div>`;
}
