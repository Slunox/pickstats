// Écran d'accueil.

import { S, ui } from '../state.js';
import { esc, plural } from '../util.js';
import { cloud, canEdit } from '../cloud.js';
import { toast } from '../dom.js';
import { accountBar, sheet } from './account.js';
import { ICON } from './icons.js';
import { gameCard } from './archives.js';
import { sortedTeams } from '../model.js';

// Gros bouton de l'accueil : icône, titre, sous-titre.
const big = (attrs, cls, icon, title, sub) =>
  `<button class="hbig${cls}" ${attrs}><span class="hic">${icon}</span><span class="htx"><b>${title}</b><span>${sub}</span></span></button>`;

export function home() {
  // La fenêtre de connexion se ferme d'elle-même une fois le club rejoint ou créé.
  if (ui.sheet && ui.sheetFlow && cloud.club && !cloud.ask && !cloud.clubLoading) {
    ui.sheet = null;
    ui.sheetFlow = false;
    const name = cloud.club.name;
    setTimeout(() => toast('Connecté au club ' + name), 0);
  }

  // Bouton principal : reprendre le match en cours (avec « Sauvegarder » à côté et « Abandonner » dessous), sinon en commencer un.
  const main = S.active ? `
    <div class="resrow">
      ${big('data-x="resume"', ' go', ICON.ball, 'Reprendre le match', `${esc(S.me)} contre ${esc(S.opp)}`)}
      ${big('data-x="harchive" aria-label="Sauvegarder le match"', ' arch', ICON.archive, 'Sauvegarder', 'Terminer le match')}
    </div>
    <button class="link habandon" data-x="new">Abandonner le match sans le sauvegarder</button>`
    : big('data-x="startpick"', ' go', ICON.play, 'Commencer un match', 'Choisir l’équipe et les joueurs');

  const inClub = cloud.club && !cloud.ask;
  const nTeams = S.teams.length, nGames = (S.arch || []).length;
  const clubBtn = inClub
    ? big('data-x="view" data-v="members"', '', ICON.shield, 'Club et membres',
      `${plural(cloud.members.length || 1, 'membre')}${cloud.club.role === 'admin' ? ' · code d’invitation' : ''}`)
    : '';

  return `<div class="homewrap">
    <div class="htop">${accountBar() || '<span></span>'}<button class="gear2" data-x="view" data-v="set" aria-label="Réglages">${ICON.gear}</button></div>
    <div class="hmain">
    ${main}
    ${big('data-x="view" data-v="club"', '', ICON.team, 'Effectifs et matchs',
      `${plural(nTeams, 'équipe')} · ${plural(nGames, 'match archivé').replace('matchs archivé', 'matchs archivés')}`)}
    ${clubBtn}
    ${waiting(inClub)}
    ${lastGame()}
    </div>
  </div>${sheet()}`;
}

// Matchs qui attendent quelque chose : à publier (sur cet appareil), à valider (coachs et responsables).
function waiting(inClub) {
  if (!inClub) return '';
  const all = S.arch || [];
  const loc = all.filter(m => m.st === 'local').length;
  const val = canEdit() ? all.filter(m => m.st === 'pending').length : 0;
  const s = n => (n > 1 ? 's' : '');
  const parts = [loc && `<b>${loc}</b> match${s(loc)} à publier`, val && `<b>${val}</b> à valider`].filter(Boolean);
  return parts.length ? `<button class="hwait" data-x="view" data-v="games"><span class="hwdot"></span><span>${parts.join(' · ')}</span><span class="hwgo">›</span></button>` : '';
}

// Dernier match archivé : sa carte, qui ouvre sa fiche.
function lastGame() {
  const all = S.arch || [];
  if (!all.length) return '';
  const m = all.reduce((a, b) => (String(b.date) > String(a.date) ? b : a));
  return `<div class="lastg"><div class="lgh"><h3>Dernier match</h3><button class="link" data-x="view" data-v="games">Tous les matchs ›</button></div>${gameCard(m, sortedTeams(), false)}</div>`;
}
