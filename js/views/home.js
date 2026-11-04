// Écran d'accueil.

import { S } from '../state.js';
import { esc } from '../util.js';

export function home() {
  const resume = S.active ? `
    <div class="resrow">
      <button class="hbig resume" data-x="resume"><b>Reprendre le match en cours</b><span>${esc(S.me)} contre ${esc(S.opp)}</span></button>
      <button class="hbig arch" data-x="harchive"><b>Archiver</b><span>Terminer le match</span></button>
    </div>` : '';

  return `<div class="homewrap">
    <div class="hgear"><button class="gear2" data-x="view" data-v="set" aria-label="Réglages">⚙</button></div>
    <h1>${esc(S.clubName || 'Stats Basket')}</h1>
    ${resume}
    <button class="hbig go" data-x="startpick"><b>Commencer un match</b><span>Choisir l’équipe et les joueurs</span></button>
    <button class="hbig" data-x="view" data-v="club"><b>Gérer mon club</b><span>Équipes, joueurs, matchs archivés</span></button>
  </div>`;
}
