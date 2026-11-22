// Gestion du club : liste des équipes et fiche d'une équipe.

import { S, ui } from '../state.js';
import { CATS, SEXES } from '../constants.js';
import { esc, plural } from '../util.js';
import { sortedTeams, tm, teamColor } from '../model.js';
import { back } from './common.js';
import { rosterUpdate, tidyName } from '../emarque.js';
import { cloud, canEdit } from '../cloud.js';
import { clubHead } from './account.js';

export function club() {
  const n = (S.arch || []).length;
  const teams = S.teams.length
    ? sortedTeams().map(t => `<div class="grow">
        <div><b><i class="tdot" style="background:${teamColor(t)}"></i>${esc(t.name)}</b><span>${plural(t.players.length, 'joueur')}</span></div>
        ${canEdit() ? `<button class="btn" data-x="tedit" data-id="${t.id}">Modifier</button>` : ''}
      </div>`).join('')
    : '<p class="help">Aucune équipe pour l’instant.</p>';

  // Membre d'un club en ligne : le nom et le logo se changent dans « Club et membres ».
  const head = cloud.club && !cloud.ask ? ''
    : clubHead(true, true, 'Affiché en haut des exports PDF et sur l’image des stats.');

  return back('Accueil', 'view', 'home', 'Effectifs et matchs') + head + `
  <div class="card">
    <h2>Équipes</h2>
    ${teams}
    ${canEdit() ? `<button class="btn" data-x="addteam" style="margin-top:12px">+ Ajouter une équipe</button>
      <button class="btn alt" data-x="tempick" style="margin-top:8px"${ui.teBusy ? ' disabled' : ''}>${ui.teBusy ? 'Lecture du PDF…' : 'Créer depuis une feuille e-Marque'}</button>
      <input type="file" id="tefile" accept=".pdf,application/pdf,.zip,application/zip" hidden>
      <p class="help">Choisis le <b>.zip</b> de l’e-Marque d’un match, ou son <b>résumé</b> (« resume_… .pdf ») : l’équipe est créée avec ses joueurs, leurs numéros et sa catégorie.</p>` :'<p class="help" style="margin-top:10px">En tant que bénévole, tu ne peux pas modifier les équipes : demande à un coach ou au responsable.</p>'}
  </div>
  <div class="card">
    <h2>Matchs archivés</h2>
    <button class="btn" data-x="view" data-v="games">Voir les matchs archivés (${n})</button>
  </div>`;
}

export function tedit() {
  const t = tm();
  if (!t) return back('Effectifs et matchs', 'view', 'club', 'Équipe');
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

  return back('Effectifs et matchs', 'tback', null, ui.tnew === t.id ? 'Nouvelle équipe' : 'Modifier l’équipe') + `
  <div class="card">
    <h2>${ui.tnew === t.id ? 'Nouvelle équipe' : 'Équipe'} : <span id="tprev">${esc(t.name)}</span></h2>
    <label>Catégorie</label>
    <select data-tc="1" aria-label="Catégorie">${CATS.map(c => `<option${c === t.cat ? ' selected' : ''}>${c}</option>`).join('')}</select>
    <label>Sexe</label>
    <select data-ts="1" aria-label="Sexe">${SEXES.map(o => `<option value="${o[0]}"${o[0] === (t.sex || '') ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>
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
    <button class="btn alt" data-x="tupick" style="margin-top:8px"${ui.teBusy ? ' disabled' : ''}>${ui.teBusy ? 'Lecture du PDF…' : 'Mettre à jour depuis une feuille e-Marque'}</button>
    <input type="file" id="tufile" accept=".pdf,application/pdf,.zip,application/zip" multiple hidden>
    <p class="help">Choisis le <b>.zip</b> ou le <b>résumé</b> d’un match récent : les nouveaux joueurs sont ajoutés, les noms et numéros corrigés d’après la feuille. Personne n’est retiré.</p>
  </div>
  <button class="btn bad" data-x="delteam">Supprimer cette équipe</button>`;
}

// Mise à jour de l'effectif d'après une feuille e-Marque : récapitulatif avant d'enregistrer.
export function tupd() {
  const U = ui.tup, t = U && S.teams.find(z => z.id === U.tid);
  if (!t) return back('Effectifs et matchs', 'view', 'club', 'Mise à jour');
  const d = U.data, side = U.side, C = rosterUpdate(d.teams[side].players, t.players);
  const nameAt = i => esc(t.players[i].name) || 'sans nom';
  const block = (title, items) => items.length ? `<h3 class="tuh">${title}</h3><ul class="emren">${items.join('')}</ul>` : '';
  const pl = (n, one, many) => n + ' ' + (n > 1 ? many : one);
  const none = !C.add.length && !C.ren.length && !C.num.length, firsts = none && C.first.length;
  const unread = C.add.some(p => p.name.includes('?'));

  return back('Annuler', 'tupx', null, 'Mise à jour') + `<div class="card">
    <h2>${esc(t.name)} : mise à jour</h2>
    <label>L’équipe sur la feuille</label>
    <div class="chips">${[0, 1].map(s => `<button class="chip${side === s ? ' on' : ''}" data-x="tupside" data-v="${s}">${s ? 'Visiteurs' : 'Locaux'} : ${esc(tidyName(s ? d.b : d.a) || '?')}</button>`).join('')}</div>
    ${none ? `<p class="help">L’effectif est déjà à jour avec cette feuille${firsts ? '. Les prénoms de la feuille seront retenus pour l’affichage (« El Mehdi » plutôt que « El »).' : ' : rien à changer.'}</p>` : `
    ${block(`${pl(C.add.length, 'joueur ajouté', 'joueurs ajoutés')}`, C.add.map(p => `<li><b>#${esc(p.num)}</b> ${esc(p.name)}</li>`))}
    ${block(`${pl(C.ren.length, 'nom corrigé', 'noms corrigés')}`, C.ren.map(r => `<li><s>${nameAt(r.i)}</s> → <b>${esc(r.to)}</b></li>`))}
    ${block(`${pl(C.num.length, 'numéro changé', 'numéros changés')}`, C.num.map(r => `<li>${esc(r.name)} : <s>${r.from ? '#' + esc(r.from) : 'sans numéro'}</s> → <b>#${esc(r.to)}</b></li>`))}
    ${unread ? '<p class="emwarn">Certaines lettres n’ont pas été reconnues (« ? ») : corrige ces noms dans l’effectif après l’enregistrement.</p>' : ''}`}
    <p class="help">L’e-Marque fait foi. Les joueurs absents de la feuille restent dans l’effectif.</p>
    ${none && !firsts ? '' : '<button class="btn go2" data-x="tupsave">Enregistrer dans l’effectif</button>'}
  </div>`;
}
