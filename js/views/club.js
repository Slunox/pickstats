// Gestion du club : liste des équipes et fiche d'une équipe.

import { S, ui } from '../state.js';
import { CATS, SEXES } from '../constants.js';
import { esc, plural } from '../util.js';
import { sortedTeams, tm, teamColor, TEAM_COLORS } from '../model.js';
import { back } from './common.js';
import { cloud, canEdit } from '../cloud.js';
import { logoCard } from './account.js';

export function club() {
  const n = (S.arch || []).length;
  const teams = S.teams.length
    ? sortedTeams().map(t => `<div class="grow">
        <div><b><i class="tdot" style="background:${teamColor(t)}"></i>${esc(t.name)}</b><span>${plural(t.players.length, 'joueur')}</span></div>
        ${canEdit() ? `<button class="btn" data-x="tedit" data-id="${t.id}">Modifier</button>` : ''}
      </div>`).join('')
    : '<p class="help">Aucune équipe pour l’instant.</p>';

  // Membre d'un club en ligne : le nom se change dans « Club et membres ».
  const name = cloud.club && !cloud.ask ? '' : `
  <div class="card">
    <h2>Nom du club</h2>
    <input data-cn="1" value="${esc(S.clubName || '')}" placeholder="Nom de ton club" maxlength="40" aria-label="Nom du club">
    <p class="help">Affiché en haut des exports PDF.</p>
  </div>${logoCard()}`;

  return back('Accueil', 'view', 'home') + name + `
  <div class="card">
    <h2>Équipes</h2>
    ${teams}
    ${canEdit() ? '<button class="btn" data-x="addteam" style="margin-top:12px">+ Ajouter une équipe</button>' : '<p class="help" style="margin-top:10px">En tant que bénévole, tu ne peux pas modifier les équipes : demande à un coach ou au responsable.</p>'}
  </div>
  <div class="card">
    <h2>Matchs archivés</h2>
    <button class="btn" data-x="view" data-v="games">Voir les matchs archivés (${n})</button>
  </div>`;
}

export function tedit() {
  const t = tm();
  if (!t) return back('Effectifs et matchs', 'view', 'club');
  const autre = t.cat === 'Autre';
  const sufLabel = autre ? 'Nom de l’équipe' : 'Numéro d’équipe (facultatif)';
  const sufHelp = autre
    ? 'Avec la catégorie « Autre », ce champ sert de nom à l’équipe.'
    : 'Sert à différencier deux équipes de la même catégorie, par exemple Sénior 1 et Sénior 2. Laisse vide si tu n’en as qu’une.';

  const players = t.players.map((p, i) => `<div class="prow2">
      <input data-pn="${i}" value="${esc(p.name)}" placeholder="Nom du joueur" aria-label="Nom">
      <input data-pu="${i}" value="${esc(p.num || '')}" inputmode="numeric" maxlength="3" placeholder="N°" aria-label="Numéro habituel">
      <button class="del" data-x="delpl" data-i="${i}" aria-label="Supprimer ce joueur">✕</button>
    </div>`).join('');

  return back('Effectifs et matchs', 'tback') + `
  <div class="card">
    <h2>${ui.tnew === t.id ? 'Nouvelle équipe' : 'Équipe'} : <span id="tprev">${esc(t.name)}</span></h2>
    <label>Catégorie</label>
    <select data-tc="1" aria-label="Catégorie">${CATS.map(c => `<option${c === t.cat ? ' selected' : ''}>${c}</option>`).join('')}</select>
    <label>Sexe</label>
    <select data-ts="1" aria-label="Sexe">${SEXES.map(o => `<option value="${o[0]}"${o[0] === (t.sex || '') ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>
    <label>Couleur</label>
    <div class="swatches">${TEAM_COLORS.map(c => `<button class="sw${teamColor(t) === c ? ' on' : ''}" style="background:${c}" data-x="tcolor" data-v="${c}" aria-label="Couleur ${c}"></button>`).join('')}</div>
    <p class="help">Reprise sur l’écran de saisie, les matchs archivés et les exports PDF.</p>
    <label>${sufLabel}</label>
    <input data-tn="1" value="${esc(t.suf || '')}" maxlength="${autre ? 20 : 3}"${autre ? '' : ' inputmode="numeric"'} placeholder="${autre ? 'Nom de l’équipe' : '1, 2…'}" aria-label="${autre ? 'Nom de l’équipe' : 'Numéro d’équipe'}">
    <p class="help">${sufHelp}</p>
  </div>
  <div class="card">
    <h2>Joueurs (${t.players.length})</h2>
    <p class="help" style="margin:0 0 10px">Le numéro habituel est facultatif : tu choisis le numéro de chaque joueur pour chaque match, au moment de la composition.</p>
    <div class="prow2 head"><span>Nom</span><span>N° habituel</span><span></span></div>
    ${players}
    <button class="btn" data-x="addpl">Ajouter un joueur</button>
  </div>
  <button class="btn bad" data-x="delteam">Supprimer cette équipe</button>`;
}
