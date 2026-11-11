// Réglages.

import { S } from '../state.js';
import { APP_VERSION, DEMO } from '../constants.js';
import { back } from './common.js';
import { statsMode } from '../model.js';

// Groupe de pastilles : options = [[valeur, libellé]], on = valeur active.
const choice = (x, attr, options, on) => '<div class="chips">'
  + options.map(([v, label]) => `<button class="chip${v === on ? ' on' : ''}" data-x="${x}" data-${attr}="${v}">${label}</button>`).join('')
  + '</div>';

const card = (title, body, help) => `<div class="card"><h2>${title}</h2>${body}<p class="help">${help}</p></div>`;

export function settings() {
  const onOff = v => (v === false ? '0' : '1');

  const match = S.active ? card('Match en cours',
    '<button class="btn" data-x="archive">Terminer et sauvegarder le match</button><button class="btn bad" data-x="new">Effacer sans sauvegarder</button>',
    'Sauvegarder range le match dans « Effectifs et matchs », avec sa date, sur cet appareil. Pour le partager au club, ouvre-le et touche « Publier ».') : '';

  return (S.active ? '' : back('Accueil', 'view', 'home'))
    + card('Apparence',
      choice('theme', 't', [['light', 'Clair'], ['dark', 'Sombre'], ['auto', 'Automatique']], S.theme || 'light'),
      'Automatique suit le réglage clair ou sombre de la tablette.')
    + `<div class="card"><h2>Affichage des joueurs</h2>
      ${choice('lay', 'l', [['cards', 'Liste détaillée'], ['stack', 'Numéro en grand']], S.layout === 'stack' ? 'stack' : 'cards')}
      <p class="help">Liste détaillée : le numéro à gauche, le nom et les stats à droite. Numéro en grand : le numéro en gros en haut de chaque bloc, le nom et les stats en plus petit dessous.</p>
      <h3>Stats sur les boutons joueurs</h3>
      ${choice('pst', 'v', [['all', 'Toutes'], ['last', 'La dernière'], ['off', 'Masquées']], statsMode())}
      <p class="help">Toutes : les stats non nulles du quart en cours. La dernière : seulement la dernière action saisie pour le joueur dans le quart en cours, avec son total sur le quart. Int : interceptions, FP : fautes provoquées, BP : balles perdues, Mar : marchers, ✗ : tirs ratés.</p>
    </div>`
    + card('Tirs ratés',
      choice('askreb', 'v', [['1', 'Demander qui a le rebond'], ['0', 'Ne pas demander']], onOff(S.askReb)),
      'Après un tir raté, une fenêtre propose : nous (rebond offensif), eux (rebond défensif adverse) ou personne.')
    + match
    + card('Écran',
      choice('awake', 'v', [['1', 'Toujours allumé'], ['0', 'Veille normale']], onOff(S.awake)),
      'Évite que la tablette se mette en veille pendant la saisie (selon les appareils et les navigateurs).')
    + card('Vibration',
      choice('vibe', 'v', [['1', 'Activée'], ['0', 'Désactivée']], onOff(S.vibe)),
      'Une courte vibration à chaque action enregistrée. Elle fonctionne surtout sur Android : les iPhone et iPad ne la prennent pas en charge.')
    + card('Sauvegarde',
      '<button class="btn" data-x="backup">Sauvegarder (fichier)</button><button class="btn" data-x="restore">Restaurer une sauvegarde</button><input type="file" id="restore" accept=".json,application/json" hidden>',
      'Le fichier contient le match en cours, les archives, les équipes et les réglages. Garde-le en lieu sûr : si les données du navigateur sont effacées, tu pourras tout récupérer.')
    + (DEMO ? '' : card('Découvrir l’appli',
      '<a class="btn" href="demo.html">Voir la démo animée</a>',
      'Trois minutes pour tout comprendre, à partager avec les bénévoles et les coachs. La démo utilise des données inventées : elle ne touche pas aux tiennes.'))
    + '<p class="help">Tout est enregistré automatiquement sur cet appareil. Exporte le CSV après chaque match.</p>'
    + `<p class="help">Version ${APP_VERSION}</p>`;
}
