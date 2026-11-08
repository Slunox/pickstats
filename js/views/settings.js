// Réglages.

import { S, ui } from '../state.js';
import { APP_VERSION } from '../constants.js';
import { esc } from '../util.js';
import { cloud, showCode } from '../cloud.js';
import { back } from './common.js';
import { statsMode } from '../model.js';

// Groupe de pastilles : options = [[valeur, libellé]], on = valeur active.
const choice = (x, attr, options, on) => '<div class="chips">'
  + options.map(([v, label]) => `<button class="chip${v === on ? ' on' : ''}" data-x="${x}" data-${attr}="${v}">${label}</button>`).join('')
  + '</div>';

const card = (title, body, help) => `<div class="card"><h2>${title}</h2>${body}<p class="help">${help}</p></div>`;

// --- Compte et club (Firebase) ---

const TITLE = 'Compte et club';
const msgs = c => (c.err ? `<p class="cerr">${esc(c.err)}</p>` : '') + (c.info ? `<p class="cinfo">${esc(c.info)}</p>` : '');
const who = c => `<p class="cstate">Connecté : <b>${esc(c.email)}</b></p>`;
const logoutBtn = '<button class="btn alt" data-x="clogout">Se déconnecter</button>';

// Déconnecté : connexion ou création de compte.
function signInCard(c) {
  const up = c.mode === 'signup', busy = c.status === 'loading';
  return card(TITLE,
    choice('cmode', 'v', [['login', 'J’ai déjà un compte'], ['signup', 'Créer un compte']], c.mode)
    + `<label for="cmail">E-mail</label><input id="cmail" data-cm="1" type="email" autocomplete="username" value="${esc(ui.cmail)}">`
    + `<label for="cpass">Mot de passe${up ? ' (6 caractères minimum)' : ''}</label>`
    + `<input id="cpass" type="password" autocomplete="${up ? 'new-password' : 'current-password'}">`
    + msgs(c)
    + `<p class="crow"><button class="btn" data-x="${up ? 'csignup' : 'clogin'}"${busy ? ' disabled' : ''}>`
    + `${busy ? 'Un instant…' : up ? 'Créer mon compte' : 'Se connecter'}</button>`
    + (up ? '' : '<button class="btn alt" data-x="creset">Mot de passe oublié</button>') + '</p>',
    'Avec un compte, les équipes et les matchs archivés de ton club sont partagés entre tous ses membres, sur chaque appareil. Sans compte, tout reste sur cet appareil.');
}

// Connecté sans club : en rejoindre un ou en créer un.
function noClubCard(c) {
  if (c.clubLoading) return card(TITLE, who(c) + '<p>Recherche de ton club…</p>', '');
  return card(TITLE, who(c) + msgs(c)
    + '<h3>Rejoindre un club</h3>'
    + `<input data-ccode="1" value="${esc(ui.ccode)}" placeholder="Code d’invitation, par ex. K7P2-9QXM" autocapitalize="characters" autocomplete="off" aria-label="Code d’invitation">`
    + '<p class="crow"><button class="btn" data-x="cjoin">Rejoindre</button></p>'
    + '<p class="help">Demande le code au responsable de ton club : il le trouve ici, dans ses réglages.</p>'
    + '<h3>Créer un club</h3>'
    + `<input data-cclub="1" value="${esc(ui.cclub || S.clubName || '')}" placeholder="Nom du club" maxlength="40" aria-label="Nom du club">`
    + '<p class="crow"><button class="btn" data-x="ccreate">Créer le club</button></p>'
    + '<p class="help">Tu en deviens le responsable : tu obtiens un code d’invitation à donner aux autres coachs.</p>'
    + `<p class="crow">${logoutBtn}</p>`,
    'Tu ne vois que les données de ton club.');
}

// Premier rattachement : que faire des données déjà sur l'appareil ?
function askCard(c) {
  const a = c.ask, what = [a.teams && a.teams + ' équipe' + (a.teams > 1 ? 's' : ''), a.matches && a.matches + ' match' + (a.matches > 1 ? 's' : '') + ' archivé' + (a.matches > 1 ? 's' : '')].filter(Boolean).join(' et ');
  return card(TITLE, who(c)
    + `<p>Cette tablette contient déjà ${what}. Les ajouter au club <b>${esc(c.club.name || '')}</b> ?</p>`
    + '<p class="crow"><button class="btn" data-x="cmerge" data-v="1">Les ajouter au club</button>'
    + '<button class="btn bad" data-x="cmerge" data-v="0">Les retirer de la tablette</button></p>',
    'Si tu les retires, elles sont effacées de cette tablette (fais d’abord une sauvegarde si tu veux les garder). Les données du club arrivent ensuite.');
}

function memberRow(m, c) {
  const me = m.uid === c.uid, admin = m.role === 'admin';
  const acts = me ? '<span class="help">toi</span>'
    : `<button class="btn alt sm" data-x="crole" data-u="${esc(m.uid)}" data-v="${admin ? 'coach' : 'admin'}">${admin ? 'Passer coach' : 'Nommer responsable'}</button>`
      + `<button class="btn bad sm" data-x="ckick" data-u="${esc(m.uid)}">Retirer</button>`;
  return `<div class="mrow"><div><b>${esc(m.email || '—')}</b><span class="help">${admin ? 'Responsable' : 'Coach'}</span></div><div>${acts}</div></div>`;
}

// Membre d'un club.
function clubInfoCard(c) {
  const k = c.club, admin = k.role === 'admin';
  const state = c.offline ? 'Hors ligne : les modifications seront envoyées au retour du réseau.'
    : c.pending ? 'Envoi en cours…' : 'Données à jour.';
  const adminPart = admin
    ? '<h3>Code d’invitation</h3>'
      + `<p class="ccode">${esc(showCode(k.code))}</p>`
      + '<p class="help">Donne ce code aux coachs du club : ils le saisissent après avoir créé leur compte. « Nouveau code » rend l’ancien inutilisable (les membres actuels restent).</p>'
      + '<p class="crow"><button class="btn alt" data-x="crenew">Nouveau code</button></p>'
      + `<h3>Membres (${c.members.length})</h3>` + c.members.map(m => memberRow(m, c)).join('')
    : '';
  return card(TITLE,
    `<p class="cstate"><span class="cdot${c.offline ? ' off' : ''}"></span>Club : <b>${esc(k.name)}</b> · ${admin ? 'responsable' : 'coach'}<br>`
    + `Connecté : ${esc(c.email)}<br>${state}</p>`
    + msgs(c) + adminPart
    + `<p class="crow"><button class="btn alt" data-x="cleave">Quitter le club</button>${logoutBtn}</p>`,
    'Les équipes, leur composition et les matchs archivés sont partagés avec les membres du club. Le match en cours reste sur cet appareil jusqu’à son archivage.');
}

function clubCard() {
  const c = cloud;
  if (c.status === 'none') return '';
  if (c.status !== 'on') return signInCard(c);
  if (!c.club) return noClubCard(c);
  if (c.ask) return askCard(c);
  return clubInfoCard(c);
}

export function settings() {
  const onOff = v => (v === false ? '0' : '1');

  const match = S.active ? card('Match en cours',
    '<button class="btn" data-x="archive">Terminer et archiver le match</button><button class="btn bad" data-x="new">Effacer sans archiver</button>',
    'Archiver range le match dans « Gérer mon club » (matchs archivés), avec sa date.') : '';

  return (S.active ? '' : back('Accueil', 'view', 'home'))
    + clubCard()
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
    + '<p class="help">Tout est enregistré automatiquement sur cet appareil. Exporte le CSV après chaque match.</p>'
    + `<p class="help">Version ${APP_VERSION}</p>`;
}
