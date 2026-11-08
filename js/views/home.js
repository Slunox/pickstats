// Écran d'accueil.

import { S, ui } from '../state.js';
import { esc, plural } from '../util.js';
import { cloud } from '../cloud.js';
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

  const resume = S.active ? `
    <div class="resrow">
      ${big('data-x="resume"', ' resume', ICON.ball, 'Reprendre le match', `${esc(S.me)} contre ${esc(S.opp)}`)}
      ${big('data-x="harchive" aria-label="Archiver le match"', ' arch', ICON.archive, 'Archiver', 'Terminer le match')}
    </div>` : '';

  const inClub = cloud.club && !cloud.ask;
  const nTeams = S.teams.length, nGames = (S.arch || []).length;
  const clubBtn = inClub
    ? big('data-x="view" data-v="members"', '', ICON.shield, 'Club et membres',
      `${plural(cloud.members.length || 1, 'membre')}${cloud.club.role === 'admin' ? ' · code d’invitation' : ''}`)
    : '';

  return `<div class="homewrap">
    <div class="htop">${accountBar() || '<span></span>'}<button class="gear2" data-x="view" data-v="set" aria-label="Réglages">${ICON.gear}</button></div>
    <div class="hmain">
    ${resume}
    ${big(`data-x="startpick"${S.active ? ' disabled' : ''}`, ' go', ICON.play, 'Commencer un match',
      S.active ? 'Archive le match en cours pour en commencer un nouveau' : 'Choisir l’équipe et les joueurs')}
    ${big('data-x="view" data-v="club"', '', ICON.team, 'Effectifs et matchs',
      `${plural(nTeams, 'équipe')} · ${plural(nGames, 'match archivé').replace('matchs archivé', 'matchs archivés')}`)}
    ${clubBtn}
    ${lastGame()}
    </div>
  </div>${sheet()}`;
}

// Dernier match archivé : sa carte, qui ouvre sa fiche.
function lastGame() {
  const all = S.arch || [];
  if (!all.length) return '';
  const m = all.reduce((a, b) => (String(b.date) > String(a.date) ? b : a));
  return `<div class="lastg"><div class="lgh"><h3>Dernier match</h3><button class="link" data-x="view" data-v="games">Tous les matchs ›</button></div>${gameCard(m, sortedTeams(), false)}</div>`;
}
