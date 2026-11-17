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

  return back(S.active ? '' : 'Accueil', 'view', 'home', 'Réglages')
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
    + `<div class="card"><h2>Écran de saisie</h2>
      ${choice('entry', 'v', [['1', 'Classique'], ['lock', 'Mode dynamique']], S.entry === 'lock' ? 'lock' : '1')}
      <p class="help"><b>Classique</b> : l’écran habituel. On touche le joueur, puis son action ; après un tir raté, une fenêtre demande qui a pris le rebond.</p>
      <p class="help"><b>Mode dynamique</b> : à l’essai, pour les mêlées. Après un tir raté à 2 ou 3 points, le bas de l’écran demande qui a pris le rebond ; en attendant, chaque joueur touché enregistre un <b>rebond offensif et un nouveau tir raté</b> pour lui, en un seul appui (2 pts ou 3 pts au choix). Répondre au rebond fait sortir du mode. « LF » : choisis le nombre de lancers, puis dis pour chacun s’il est marqué ou raté. Les ballons gagnés sont dans la barre du bas.</p>
      <p class="help">Dis-nous ce que ça donne en match : à terme il n’en restera qu’un.</p>
    </div>`
    + match
    + card('Écran',
      choice('awake', 'v', [['1', 'Toujours allumé'], ['0', 'Veille normale']], onOff(S.awake)),
      'Évite que la tablette se mette en veille pendant la saisie (selon les appareils et les navigateurs).')
    + card('Vibration',
      choice('vibe', 'v', [['1', 'Activée'], ['0', 'Désactivée']], onOff(S.vibe)),
      'Une courte vibration à chaque action enregistrée. Elle fonctionne surtout sur Android : les iPhone et iPad ne la prennent pas en charge, le son ci-dessous les remplace.')
    + card('Son',
      choice('sound', 'v', [['1', 'Activé'], ['0', 'Désactivé']], S.sound ? '1' : '0'),
      'Un petit « tic » à chaque action enregistrée, utile sur iPad et iPhone où la vibration ne marche pas. Il suit le volume de l’appareil et se tait en mode silencieux.')
    + card('Sauvegarde',
      '<button class="btn" data-x="backup">Sauvegarder (fichier)</button><button class="btn" data-x="restore">Restaurer une sauvegarde</button><input type="file" id="restore" accept=".json,application/json" hidden>',
      'Le fichier contient le match en cours, les archives, les équipes et les réglages. Garde-le en lieu sûr : si les données du navigateur sont effacées, tu pourras tout récupérer.')
    + (DEMO ? '' : card('Découvrir l’appli',
      '<a class="btn" href="demo.html">Voir la démo animée</a>',
      'Trois minutes pour tout comprendre, à partager avec les bénévoles et les coachs. La démo utilise des données inventées : elle ne touche pas aux tiennes.'))
    + '<p class="help">Tout est enregistré automatiquement sur cet appareil. Fais une sauvegarde de temps en temps.</p>'
    + `<p class="help">Version ${APP_VERSION}</p>`;
}
