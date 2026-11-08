// Morceaux d'interface partagés entre plusieurs écrans.

import { S } from '../state.js';
import { WON } from '../constants.js';
import { esc, qLabel } from '../util.js';
import { periods, tally, cnt, miss } from '../model.js';

export const back = (label, x, v) =>
  `<button class="btn alt" data-x="${x}"${v ? ` data-v="${v}"` : ''}>‹ ${label}</button>`;

// Pastilles de choix de période : « Tout », Q1, Q2…
export function periodChips(cur, x, allLabel) {
  return `<div class="chips"><button class="chip${cur === 'all' ? ' on' : ''}" data-x="${x}" data-q="all">${allLabel}</button>`
    + periods().map(p => `<button class="chip${cur == p ? ' on' : ''}" data-x="${x}" data-q="${p}">${qLabel(p)}</button>`).join('')
    + '</div>';
}

// Boutons d'export (sans espace entre eux, comme avant).
export const exportButtons = () => [
  '<button class="btn" data-x="share">Partager le résumé (WhatsApp…)</button>',
  '<button class="btn" data-x="copy">Copier le texte</button>',
  '<button class="btn" data-x="pdf">Exporter en PDF</button>',
  '<button class="btn" data-x="csv">Exporter en CSV</button>',
].join('');

// Envoi du match à un autre utilisateur de l'appli.
export const sendCard = () => `<div class="card">
  <h2>Envoyer le match</h2>
  <p class="help" style="margin:0 0 10px">Pour un autre coach qui utilise Pick&amp;Stats : il pourra l’ajouter à ses matchs archivés et retrouver toutes les stats.</p>
  <button class="btn" data-x="sendlink">Envoyer un lien</button><button class="btn" data-x="sendfile">Envoyer un fichier</button>
</div>`;

// Tableaux de stats pour une période (null = tout le match).
export function tables(q) {
  const T = Object.values(tally(q));
  const s = k => T.reduce((a, r) => a + r[k], 0);
  const td = v => `<td>${v}</td>`;
  const row = r => `<tr><td>#${esc(r.n)} ${esc(r.name)}</td>${[r.stl, r.fd, r.to, r.trav].map(td).join('')}`
    + `<td><b>${miss(r)}</b></td>${[r.m2, r.m3, r.m1].map(td).join('')}</tr>`;
  const won = WON.map(w => cnt(w[0], q));
  const head = ['Joueur', 'Interc.', 'Fautes prov.', 'Balles perdues', 'Marchers', 'Ratés', 'dont 2 pts', 'dont 3 pts', 'dont LF'];

  return `<table>
    <tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>
    ${T.map(row).join('')}
    <tr class="tot"><td>Équipe</td>${[s('stl'), s('fd'), s('to'), s('trav'), s('m1') + s('m2') + s('m3'), s('m2'), s('m3'), s('m1')].map(td).join('')}</tr>
  </table>
  <table class="mt">
    <tr><th>Rebonds</th><th>Offensifs</th><th>Défensifs</th><th>Total</th></tr>
    <tr><td>${esc(S.me)}</td><td>${cnt('ro', q)}</td><td>${cnt('rd', q)}</td><td><b>${cnt('ro', q) + cnt('rd', q)}</b></td></tr>
    <tr><td>${esc(S.opp)}</td><td>${cnt('orb', q)}</td><td>${cnt('odr', q)}</td><td><b>${cnt('orb', q) + cnt('odr', q)}</b></td></tr>
  </table>
  <table class="mt">
    <tr><th>Ballons gagnés</th><th>5 s</th><th>8 s</th><th>24 s</th><th>Récupérés</th><th>Total</th></tr>
    <tr><td>${esc(S.me)}</td>${won.map(td).join('')}<td><b>${won.reduce((a, b) => a + b, 0)}</b></td></tr>
  </table>`;
}
