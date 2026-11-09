// Matchs archivés : liste et détail.

import { S, ui, withMatch } from '../state.js';
import { esc, fdate } from '../util.js';
import { sortedTeams, curG, inTeam, tally, cnt, miss, teamColor } from '../model.js';
import { back, periodChips, exportButtons, sendCard, statsView } from './common.js';
import { canEdit } from '../cloud.js';
import { emCard } from './emarque.js';
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
const byLine = m => canEdit()
  ? `<label class="gby">Stats saisies par <input data-mby="${m.id}" value="${esc(m.by || '')}" maxlength="20" placeholder="Pseudo" autocomplete="off"></label>`
  : (m.by ? `<p class="help" style="margin:-4px 0 10px">Stats saisies par ${esc(m.by)}</p>` : '');

export function game() {
  const m = curG();
  if (!m) return '<div class="card"><p class="help">Match introuvable.</p></div>';
  return back('Matchs archivés', 'gback') + withMatch(m, () => {
    const q = ui.sq === 'all' ? null : +ui.sq;
    return periodChips(ui.sq, 'sq', 'Total match')
      + `<div class="card"><h2>${esc(S.me)} contre ${esc(S.opp)} — ${fdate(m)}</h2>${byLine(m)}${statsView(q)}</div>`
      + emCard(m)
      + exportButtons()
      + sendCard()
      + (canEdit() ? `<button class="btn bad" data-x="gdel" data-id="${m.id}">Supprimer ce match</button>` : '');
  });
}
