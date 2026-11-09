// Matchs archivés : liste et détail.

import { S, ui, withMatch } from '../state.js';
import { esc, fdate } from '../util.js';
import { sortedTeams, curG, inTeam, tally, cnt, miss, teamColor } from '../model.js';
import { back, periodChips, exportButtons, statsView } from './common.js';
import { canEdit } from '../cloud.js';
import { emCard, emManage } from './emarque.js';
import { emScore } from './emstats.js';
import { reportView } from './report.js';

// Équipe d'un match archivé (pour sa couleur), même si l'équipe a été supprimée.
const matchTeamOf = (m, teams) => teams.find(t => inTeam(m, t));
const colorOf = (m, teams) => { const t = matchTeamOf(m, teams); return teamColor(t || m.me); };

// Quelques chiffres d'équipe pour la carte du match.
function keyStats(m) {
  return withMatch(m, () => {
    const T = Object.values(tally(null)), s = k => T.reduce((a, r) => a + r[k], 0);
    return [
      [s('stl'), 'Interc.'],
      [s('to'), 'Pertes'],
      [T.reduce((a, r) => a + miss(r), 0), 'Ratés'],
      [cnt('ro') + cnt('rd'), 'Rebonds'],
    ];
  });
}

const longDate = m => new Date(m.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const monthOf = m => new Date(m.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

// Score et résultat d'après la feuille e-Marque importée.
const scoreTag = m => {
  if (!m.em || !m.em.us) return '';
  const a = m.em.us.total.pts, b = m.em.them.total.pts, r = a > b ? ['w', 'V'] : a < b ? ['l', 'D'] : ['d', 'N'];
  return `<span class="mscore ${r[0]}">${r[1]} ${a}–${b}</span>`;
};

export function gameCard(m, teams, del = true) {
  return `<div class="mcard" style="--tc:${colorOf(m, teams)}">
    <button class="mmain" data-x="gopen" data-id="${m.id}">
      <span class="mtop"><span class="mteam">${esc(m.me)}</span><span class="mdate">${longDate(m)}</span></span>
      <span class="mopp">contre <b>${esc(m.opp)}</b>${scoreTag(m)}</span>
      ${m.by ? `<span class="mby">Stats : ${esc(m.by)}</span>` : ''}
      <span class="mstats">${keyStats(m).map(([v, l]) => `<span><b>${v}</b>${l}</span>`).join('')}</span>
    </button>
    ${del && canEdit() ? `<button class="mdel" data-x="gdel" data-id="${m.id}" aria-label="Supprimer le match contre ${esc(m.opp)}">✕</button>` : ''}
  </div>`;
}

// Cartes regroupées par mois, le plus récent en premier.
function gameCards(L, teams) {
  let html = '', month = '';
  L.forEach(m => {
    const mo = monthOf(m);
    if (mo !== month) {
      if (month) html += '</div>';
      month = mo;
      html += `<h3 class="mhead">${mo.charAt(0).toUpperCase() + mo.slice(1)}</h3><div class="mgrid">`;
    }
    html += gameCard(m, teams);
  });
  return html + (month ? '</div>' : '');
}

export function games() {
  const all = S.arch || [], teams = sortedTeams();
  const orphan = all.filter(m => !teams.some(t => inTeam(m, t)));
  let L = all;
  if (ui.gfilter === 'none') L = orphan;
  else if (ui.gfilter !== 'all') {
    const t = teams.find(z => z.id === ui.gfilter);
    if (t) L = all.filter(m => inTeam(m, t));
  }
  L = L.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const chip = (v, label, color) => `<button class="chip${ui.gfilter === v ? ' on' : ''}" data-x="gf" data-v="${v}">`
    + `${color ? `<i class="tdot" style="background:${color}"></i>` : ''}${label}</button>`;
  const chips = '<div class="chips scroll">'
    + chip('all', `Toutes (${all.length})`)
    + teams.map(t => chip(t.id, `${esc(t.name)} (${all.filter(m => inTeam(m, t)).length})`, teamColor(t))).join('')
    + (orphan.length ? chip('none', `Autres (${orphan.length})`) : '')
    + '</div>';

  return back('Effectifs et matchs', 'view', 'club') + chips
    + `<div class="ghead"><h2>Matchs archivés (${L.length})</h2><button class="btn alt" data-x="impopen">Importer un match reçu</button></div>`
    + (L.length ? gameCards(L, teams) : '<div class="card"><p class="help">Aucun match archivé pour ce filtre.</p></div>');
}

// Rapport complet du match (feuille e-Marque importée)
export function report() {
  const m = curG();
  if (!m || !m.em) return '<div class="card"><p class="help">Pas de feuille e-Marque pour ce match.</p></div>';
  return back('Fiche du match', 'view', 'game') + withMatch(m, () => reportView(m));
}

// Auteur des stats : modifiable par les coachs et responsables (match archivé sans pseudo, ou erreur)
const byInput = m => `<label class="gby">Stats saisies par <input data-mby="${m.id}" value="${esc(m.by || '')}" maxlength="20" placeholder="Pseudo" autocomplete="off"></label>`;
const byText = m => (m.by ? `<p class="help" style="margin:-4px 0 10px">Stats saisies par ${esc(m.by)}</p>` : '');

// Noms des joueurs d'un match archivé : ils sont copiés au moment de l'archivage,
// on peut donc les corriger ici (à la main ou d'après l'équipe, par numéro de maillot).
function namesCard(m) {
  if (!canEdit() || !m.roster.length) return '';
  const t = S.teams.find(z => inTeam(m, z));
  return `<details class="gnames gsec"${ui.gnOpen ? ' open' : ''}><summary><h4>Corriger les noms des joueurs</h4></summary>
    <p class="help">Les noms sont enregistrés avec le match au moment de l’archivage : modifier l’équipe ensuite ne les change pas. Corrige-les ici.</p>
    ${t ? `<button class="btn alt" data-x="gnames">Reprendre les noms de l’équipe ${esc(t.name)}</button>
    <p class="help" style="margin-top:0">Chaque joueur du match reçoit le nom du joueur de l’équipe qui a le même numéro habituel.</p>` : ''}
    ${m.roster.map((p, i) => `<div class="gpn"><b>#${esc(p.n)}</b><input data-gpn="${i}" value="${esc(p.name)}" placeholder="Nom du joueur" aria-label="Nom du n° ${esc(p.n)}"></div>`).join('')}
  </details>`;
}

// Actions qu'on fait une fois (auteur, feuille, noms, exports, envoi, suppression) : regroupées, repliées.
function manageCard(m) {
  const edit = canEdit();
  const sec = (title, body) => body ? `<section class="gsec"><h4>${title}</h4>${body}</section>` : '';
  return `<details class="card gman"${ui.gmOpen ? ' open' : ''}><summary><h3>Gérer le match</h3></summary>
    ${edit ? sec('Auteur des stats', byInput(m)) : ''}
    ${sec('Feuille e-Marque', emManage(m))}
    ${namesCard(m)}
    ${sec('Exporter', exportButtons() + (m.em ? '<button class="btn alt" data-x="rpfile">Télécharger le dossier (HTML)</button>' : ''))}
    ${sec('Envoyer le match', `<p class="help" style="margin:0 0 10px">Pour un autre coach qui utilise Pick&amp;Stats : il pourra l’ajouter à ses matchs archivés et retrouver toutes les stats.</p>
      <button class="btn" data-x="sendlink">Envoyer un lien</button><button class="btn" data-x="sendfile">Envoyer un fichier</button>`)}
    ${edit ? `<section class="gsec"><button class="btn bad" data-x="gdel" data-id="${m.id}">Supprimer ce match</button></section>` : ''}
  </details>`;
}

// Fiche d'un match archivé : score, onglets Équipe / Joueurs, puis « Gérer le match ».
export function game() {
  const m = curG();
  if (!m) return '<div class="card"><p class="help">Match introuvable.</p></div>';
  return back('Matchs archivés', 'gback') + withMatch(m, () => {
    const q = ui.sq === 'all' ? null : +ui.sq;
    const tab = ui.gtab === 'players' ? 'players' : 'team';
    const tabBtn = (v, l) => `<button class="chip${tab === v ? ' on' : ''}" data-x="gtab" data-v="${v}">${l}</button>`;
    return periodChips(ui.sq, 'sq', 'Total match')
      + `<div class="card"><h2>${esc(S.me)} contre ${esc(S.opp)} — ${fdate(m)}</h2>${byText(m)}${emScore()}`
      + (m.em ? '<div class="crow grep"><button class="btn" data-x="rpopen">Rapport du match</button></div>' : '')
      + `<div class="chips gtabs">${tabBtn('team', 'Équipe')}${tabBtn('players', 'Joueurs')}</div>`
      + `${statsView(q, tab)}</div>`
      + emCard(m)
      + manageCard(m);
  });
}
