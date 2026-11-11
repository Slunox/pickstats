// Compte et club : résumé sur l'accueil, fenêtre de connexion, page « Club et membres ».

import { S, ui } from '../state.js';
import { esc } from '../util.js';
import { cloud, showCode, memberName, ROLES } from '../cloud.js';
import { back } from './common.js';
import { ICON } from './icons.js';

const msgs = c => (c.err ? `<p class="cerr">${esc(c.err)}</p>` : '') + (c.info ? `<p class="cinfo">${esc(c.info)}</p>` : '');

// Initiales du club pour sa pastille (« BC Blanquefort » -> « BB »).
export function initials(name) {
  const w = String(name || '').trim().split(/[\s\-']+/).filter(Boolean);
  if (!w.length) return '?';
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[w.length - 1][0]).toUpperCase();
}

// Pastille du club : son logo, sinon ses initiales.
export const clubAvatar = (name, cls = '') => (S.clubLogo
  ? `<span class="av img ${cls}"><img src="${S.clubLogo}" alt=""></span>`
  : `<span class="av ${cls}">${esc(initials(name))}</span>`);

const syncText = c => (c.offline ? 'Hors ligne' : c.pending ? 'Envoi en cours…' : 'À jour');

// --- Bandeau de l'accueil ---

export function accountBar() {
  const c = cloud;
  if (c.status === 'none') return '';
  let avatar, title, sub, cls = '';
  if (c.status === 'on' && c.club && !c.ask) {
    avatar = clubAvatar(c.club.name || S.clubName);
    title = esc(c.club.name || S.clubName || 'Mon club');
    sub = `<span class="cdot${c.offline ? ' off' : ''}"></span>${c.name ? esc(c.name) + ' · ' : ''}${(ROLES[c.club.role] || 'Coach').toLowerCase()} · ${syncText(c)}`;
    cls = ' on';
  } else if (c.status === 'on') {
    avatar = `<span class="av ghost">${ICON.cloud}</span>`;
    title = c.clubLoading ? 'Recherche de ton club…' : c.ask ? 'Encore une étape' : 'Rejoindre un club';
    sub = esc(c.name || c.email);
  } else {
    avatar = `<span class="av ghost">${ICON.cloud}</span>`;
    title = c.status === 'loading' ? 'Connexion…' : 'Se connecter';
    sub = 'Partage tes équipes et tes matchs avec ton club';
  }
  return `<button class="acct${cls}" data-x="sheet">${avatar}<span class="acct-t"><b>${title}</b><small>${sub}</small></span><span class="chev">›</span></button>`;
}

// --- Fenêtre (layer) ---

function signInStep(c) {
  const up = c.mode === 'signup', busy = c.status === 'loading';
  return `<h2>${up ? 'Créer un compte' : 'Se connecter'}</h2>
    <div class="seg">
      <button class="${up ? '' : 'on'}" data-x="cmode" data-v="login">J’ai déjà un compte</button>
      <button class="${up ? 'on' : ''}" data-x="cmode" data-v="signup">Créer un compte</button>
    </div>
    ${up ? `<label for="cpseudo">Pseudo <small>(visible par les membres du club)</small></label><input id="cpseudo" data-cpseudo="1" autocomplete="nickname" maxlength="20" placeholder="Ex. Vincent, Coach U15…" value="${esc(ui.cpseudo)}">` : ''}
    <label for="cmail">E-mail</label><input id="cmail" data-cm="1" type="email" autocomplete="username" value="${esc(ui.cmail)}">
    <label for="cpass">Mot de passe${up ? ' <small>(6 caractères minimum)</small>' : ''}</label>
    <input id="cpass" type="password" autocomplete="${up ? 'new-password' : 'current-password'}">
    ${msgs(c)}
    <button class="btn wide" data-x="${up ? 'csignup' : 'clogin'}"${busy ? ' disabled' : ''}>${busy ? 'Un instant…' : up ? 'Créer mon compte' : 'Se connecter'}</button>
    ${up ? '<p class="help">Ensuite, tu rejoins ton club avec son code d’invitation, ou tu crées le tien.</p>'
    : '<button class="link" data-x="creset">Mot de passe oublié ?</button>'}`;
}

function clubStep(c) {
  if (c.clubLoading) return '<h2>Recherche de ton club…</h2><p class="help">Un instant.</p>';
  return `<h2>Ton club</h2>
    <p class="help">Connecté : ${esc(c.name || c.email)}</p>
    ${c.name ? '' : pseudoField(c)}
    ${msgs(c)}
    <h3>Rejoindre un club</h3>
    <input class="codein" data-ccode="1" value="${esc(ui.ccode)}" placeholder="K7P2-9QXM" autocapitalize="characters" autocomplete="off" aria-label="Code d’invitation">
    <button class="btn wide" data-x="cjoin">Rejoindre</button>
    <p class="help">Demande le code d’invitation au responsable de ton club.</p>
    <div class="or"><span>ou</span></div>
    <h3>Créer un club</h3>
    <input data-cclub="1" value="${esc(ui.cclub || S.clubName || '')}" placeholder="Nom du club" maxlength="40" aria-label="Nom du club">
    <button class="btn alt wide" data-x="ccreate">Créer le club</button>
    <p class="help">Tu en deviens le responsable et tu obtiens un code à donner aux autres coachs.</p>
    <button class="link" data-x="clogout">Se déconnecter</button>`;
}

function askStep(c) {
  const a = c.ask, s = n => (n > 1 ? 's' : '');
  const what = [a.teams && `${a.teams} équipe${s(a.teams)}`, a.matches && `${a.matches} match${s(a.matches)} archivé${s(a.matches)}`].filter(Boolean).join(' et ');
  if (c.club.role === 'benevole') {
    return `<h2>Bienvenue dans ${esc(c.club.name || 'le club')}</h2>
    <p>Tu rejoins le club comme <b>bénévole</b> : tu saisis les stats des matchs, les équipes sont gérées par les coachs.</p>
    <p>Cette tablette contient déjà ${what}.</p>
    ${a.matches ? '<button class="btn wide" data-x="cmerge" data-v="1">Garder mes matchs sur la tablette (à publier ensuite)</button>' : ''}
    <button class="btn ${a.matches ? 'bad' : ''} wide" data-x="cmerge" data-v="0">${a.matches ? 'Tout retirer de la tablette' : 'Continuer'}</button>
    <p class="help">Les équipes de cette tablette sont remplacées par celles du club. Fais d’abord une sauvegarde si tu veux les garder.</p>`;
  }
  return `<h2>Bienvenue dans ${esc(c.club.name || 'le club')}</h2>
    <p>Cette tablette contient déjà ${what}. Les ajouter au club ?</p>
    <button class="btn wide" data-x="cmerge" data-v="1">Les ajouter au club</button>
    <button class="btn bad wide" data-x="cmerge" data-v="0">Les retirer de la tablette</button>
    <p class="help">Si tu les retires, elles sont effacées de cette tablette (fais d’abord une sauvegarde si tu veux les garder). Les données du club arrivent ensuite.</p>`;
}

// Pseudo du compte, modifiable (obligatoire pour les comptes créés avant les pseudos).
function pseudoField(c) {
  const none = !c.name;
  return `<label for="cpseudo">Ton pseudo${none ? ' <small class="warn">à choisir</small>' : ''}</label>
    <div class="inrow"><input id="cpseudo" data-cpseudo="1" maxlength="20" autocomplete="nickname" placeholder="Ex. Vincent, Coach U15…" value="${esc(ui.cpseudo || c.name)}">
    <button class="btn${none ? '' : ' alt'}" data-x="csavename">Enregistrer</button></div>
    <p class="help">Affiché aux membres du club et sur les matchs que tu publies, à la place de ton e-mail.</p>`;
}

function summaryStep(c) {
  const k = c.club;
  return `<div class="sumhead">${clubAvatar(k.name, 'big')}
      <div><h2>${esc(k.name)}</h2><p class="help">${ROLES[k.role] || 'Coach'} · ${esc(c.email)}</p></div></div>
    <p class="cstate"><span class="cdot${c.offline ? ' off' : ''}"></span>${c.offline ? 'Hors ligne : les modifications partiront au retour du réseau.' : c.pending ? 'Envoi en cours…' : 'Données à jour.'}</p>
    ${pseudoField(c)}
    ${msgs(c)}
    <button class="btn wide" data-x="view" data-v="members">Club et membres</button>
    <button class="btn alt wide" data-x="clogout">Se déconnecter</button>
    <p class="help">Les équipes, leur composition et les matchs archivés sont partagés avec les membres du club. Un match sauvegardé reste sur cet appareil jusqu’à ce qu’il soit publié.</p>
    <p class="help">En te déconnectant, les équipes et les matchs du club sont retirés de cet appareil : ils reviennent à la prochaine connexion. Les matchs pas encore publiés restent ici.</p>`;
}

export function sheet() {
  if (ui.sheet !== 'account' || cloud.status === 'none') return '';
  const c = cloud;
  const body = c.status !== 'on' ? signInStep(c) : !c.club ? clubStep(c) : c.ask ? askStep(c) : summaryStep(c);
  // L'écran est redessiné à chaque changement (connexion en cours, club chargé…) : l'animation
  // d'ouverture ne joue que si la fenêtre n'était pas déjà affichée, sinon elle sautille.
  const anim = document.querySelector('#app .sheet') ? '' : ' anim';
  return `<div class="sheetwrap"><div class="sheetbg${anim}" data-x="sclose"></div>
    <div class="sheet${anim}" role="dialog" aria-modal="true"><button class="sx" data-x="sclose" aria-label="Fermer">✕</button>${body}</div></div>`;
}

// --- Page « Club et membres » ---

function memberRow(m, c, admin) {
  const me = m.uid === c.uid, role = ROLES[m.role] ? m.role : 'coach';
  // Le responsable choisit le rôle de chacun dans une liste.
  const acts = me ? '<span class="tag">toi</span>'
    : admin ? `<select class="rolesel" data-crole="${esc(m.uid)}" aria-label="Rôle de ${esc(memberName(m))}">`
      + Object.entries(ROLES).map(([v, l]) => `<option value="${v}"${v === role ? ' selected' : ''}>${l}</option>`).join('') + '</select>'
      + `<button class="btn bad sm" data-x="ckick" data-u="${esc(m.uid)}">Retirer</button>`
    : '';
  const name = memberName(m);
  return `<div class="mrow${me || !admin ? ' self' : ''}"><span class="av sm">${esc(name[0].toUpperCase())}</span>
    <div class="mname"><b>${esc(name)}</b><span>${ROLES[role]}</span></div><div class="macts">${acts}</div></div>`;
}

export function members() {
  const c = cloud, k = c.club;
  if (!k || c.ask) return back('Accueil', 'view', 'home') + '<div class="card"><p>Tu n’es connecté à aucun club.</p><button class="btn" data-x="sheet">Se connecter</button></div>';
  const admin = k.role === 'admin';
  const code = admin ? `<div class="card">
      <h2>Code d’invitation</h2>
      <div class="codebox"><p class="ccode">${esc(showCode(k.code))}</p><button class="btn alt sm" data-x="ccopy" aria-label="Copier le code d’invitation">Copier</button></div>
      <p class="help">Les nouveaux membres le saisissent après avoir créé leur compte et arrivent bénévoles. « Nouveau code » rend l’ancien inutilisable ; les membres actuels restent.</p>
      <div class="crow"><button class="btn" data-x="cshare">Envoyer le code</button><button class="btn alt" data-x="crenew">Nouveau code</button></div>
    </div>` : '';
  return back('Accueil', 'view', 'home') + `
    <div class="card clubhead">${clubAvatar(k.name, 'big')}
      <div><h2>${esc(k.name)}</h2><p class="help"><span class="cdot${c.offline ? ' off' : ''}"></span>Tu es ${(ROLES[k.role] || 'Coach').toLowerCase()} · ${syncText(c)}</p></div></div>
    ${msgs(c)}
    ${k.role === 'benevole' ? '' : `<div class="card"><h2>Nom du club</h2>
      <input data-cn="1" value="${esc(S.clubName || '')}" placeholder="Nom de ton club" maxlength="40" aria-label="Nom du club">
      <p class="help">Affiché en haut des exports PDF et pour tous les membres.</p></div>`}
    ${admin ? logoCard() : ''}
    ${code}
    <div class="card"><h2>Membres (${c.members.length})</h2>${c.members.map(m => memberRow(m, c, admin)).join('')}
      <p class="help">${admin ? 'Les nouveaux membres arrivent bénévoles. ' : ''}Responsable : gère le club et ses membres. Coach : modifie les équipes et les matchs. Bénévole : saisit les stats et publie ses matchs, validés ensuite par un coach ou un responsable.</p></div>
    <div class="card"><h2>Quitter le club</h2>
      <p class="help" style="margin-bottom:10px">Tu n’auras plus accès aux données en ligne du club. Il te faudra un nouveau code pour revenir.</p>
      <button class="btn bad" data-x="cleave">Quitter le club</button></div>`;
}

// Logo du club (responsable, ou sans club en ligne).
export function logoCard() {
  return `<div class="card"><h2>Logo du club</h2>
    <div class="logorow">${clubAvatar(S.clubName, 'big')}
      <div class="crow" style="margin:0"><button class="btn" data-x="logopick">${S.clubLogo ? 'Changer le logo' : 'Choisir une image'}</button>`
    + (S.clubLogo ? '<button class="btn alt" data-x="logodel">Retirer</button>' : '')
    + `</div></div>
    <input type="file" id="logofile" accept="image/*" hidden>
    <p class="help">Affiché à la place des initiales, pour tous les membres du club, et en haut des exports PDF. Une image carrée rend mieux.</p></div>`;
}
