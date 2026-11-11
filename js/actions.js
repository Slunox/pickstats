// Réactions aux clics et à la saisie.
// Chaque bouton porte data-x="nom" ; ACTIONS[nom](el) est appelée au clic.
// Une action qui renvoie false n'entraîne pas de rafraîchissement de l'écran.

import { S, ui, save, withMatch } from './state.js';
import { $, uid, cmpN } from './util.js';
import { roster, dupN, evText, teamLabel, tm, matchTeam, sortPlayers, selTeam, curG, curTeamColor, oppColor, isLight, colorVars } from './model.js';
import { toast, ask, note, answer, choose, chosen } from './dom.js';
import { MISS, SWAP, DEMO } from './constants.js';
import { inCtx, pdf, backup, restoreFile, download } from './export.js';
import { reportFile, swipeNav } from './views/report.js';
import { oppOf } from './views/emarque.js';
import { shareImage } from './statimage.js';
import { markDup } from './views/pick.js';
import { logoFromFile } from './logo.js';
import { render } from './render.js';
import { readEmarque, fromEm, guessSide, toEm, tidyName, checkRow, playerName, teamSuffix } from './emarque.js';
import { keepAwake, releaseAwake } from './awake.js';
import { sendLink, sendFile, decodeMatch, extractCode, readMatchFile, addImported } from './share.js';
import { inClub, canDelMatch, canEditMatch } from './cloud.js';
import { deleteClub, deleteAccount } from './cloud.js';
import { canEdit, memberName, copyCode, shareCode, setName, login, signup, logout, resetPassword, setMode, createClub, joinClub, keepLocal, renewCode, setRole, removeMember, leaveClub, cloudDel, cloud } from './cloud.js';

// --- Match ---

// Feuille e-Marque lue (promesse) pour le match m : écran de vérification avant d'enregistrer.
function emRead(m, reading) {
  if (!m) return;
  ui.emBusy = true;
  render();
  reading.then(d => {
    const ours = [cloud.club && cloud.club.name, S.clubName, m.me].filter(Boolean);
    ui.em = { gid: m.id, data: d, side: guessSide(d, { ours, opp: m.opp, nums: (m.roster || []).map(p => p.n) }) };
    ui.view = 'emcheck';
    window.scrollTo(0, 0);
  }).catch(e => {
    note(e && e.message && /e-Marque|PDF/.test(e.message) ? e.message : 'Ce PDF ne peut pas être lu. Choisis le résumé de l’e-Marque (fichier « resume_… .pdf »).');
  }).finally(() => { ui.emBusy = false; render(); });
}

function endMatch() {
  S.ev = []; S.q = 1; S.opp = 'Adversaire'; S.oppColor = null; S.roster = []; S.active = false; S.matchId = null;
  ui.sel = null; ui.sq = 'all';
}

// Sauvegarde du match terminé, sur l'appareil seulement (st : 'local') : il part au club quand on le publie.
function archiveMatch() {
  const m = {
    st: 'local',
    id: S.matchId || Date.now(), date: new Date().toISOString(), me: S.me, opp: S.opp, oppColor: S.oppColor || null, teamId: S.teamId, q: S.q,
    ev: S.ev.slice(), roster: roster().map(p => ({ n: p.n, name: p.name, in: true })),
    ...(cloud.name ? { by: cloud.name } : {}), // pseudo de celui qui a fait les stats
  };
  S.arch.push(m);
  endMatch();
  save();
  if (!inClub()) { toast('Match sauvegardé'); return; }
  // Dans un club : on propose de le publier tout de suite, pour qu'il ne reste pas oublié sur la tablette
  ask('Match sauvegardé sur cet appareil. Le publier maintenant pour le club ?' + (canEdit() ? '' : ' Un coach ou un responsable le validera.'),
    'Publier', () => { publish(m); save(); toast(pubMsg(m)); render(); }, false,
    () => toast('Tu pourras le publier depuis la liste des matchs'), 'Plus tard');
}

// Publication au club : validé directement (coach, responsable) ou en attente de validation (bénévole)
function publish(m) {
  m.st = canEdit() ? 'ok' : 'pending';
  m.author = cloud.uid;
  if (!m.by && cloud.name) m.by = cloud.name;
  if (m.st === 'ok') m.val = cloud.name || '';
}
const pubMsg = m => (m.st === 'ok' ? 'Match publié pour le club' : 'Match publié : un coach ou un responsable doit le valider');
// Match visé : celui du bouton (carte de la liste) ou celui de la fiche ouverte
const targetG = el => (el && el.dataset.id ? S.arch.find(z => String(z.id) === el.dataset.id) : curG());

function startMatch() {
  const P = ui.P, er = $('#perr'), ch = P.rows.filter(r => r.in), t = S.teams.find(z => z.id === P.teamId);
  if (!ch.length) { er.textContent = 'Coche au moins un joueur présent.'; return false; }
  if (ch.some(r => !String(r.num).trim())) { er.textContent = 'Donne un numéro à chaque joueur présent.'; return false; }
  const seen = {};
  for (const r of ch) {
    const n = String(r.num).trim();
    if (seen[n]) { er.textContent = 'Le numéro ' + n + ' est attribué à deux joueurs.'; return false; }
    seen[n] = 1;
  }
  const go = () => {
    S.me = t.name;
    S.opp = (P.opp || '').trim() || 'Adversaire';
    S.oppColor = P.oppColor || null;
    S.teamId = t.id;
    S.roster = ch.map(r => ({ n: String(r.num).trim(), name: r.name, in: true, pid: r.id })).sort(cmpN);
    S.ev = []; S.q = 1; S.active = true;
    S.matchId = Date.now() * 1000 + Math.floor(Math.random() * 1000); // identifiant partagé avec les autres appareils
    ui.sel = null; ui.sq = 'all'; ui.P = null; ui.view = 'play';
    save();
  };
  if (S.active && S.ev.length) {
    ask('Un match est déjà en cours. Le remplacer ? Ses actions non archivées seront perdues (tu peux d’abord l’archiver depuis l’accueil).', 'Remplacer', go, true);
    return false;
  }
  go();
}

function addEvent(ev) {
  S.ev.push(ev);
  toast(evText(ev) + ' ✓');
  save();
}

// Après un tir raté : qui a pris le rebond ?
function askRebound() {
  choose('Qui a pris le rebond ?', [
    { label: (cloud.club && cloud.club.name) || S.clubName || S.me, sub: 'Rebond offensif', cls: 'tc', style: colorVars(curTeamColor()), fn: () => addEvent({ a: 'ro', q: S.q, p: '__team' }) },
    { label: S.opp, sub: 'Rebond défensif', cls: 'tc' + (isLight(oppColor()) ? ' lt' : ''), style: colorVars(oppColor()), fn: () => addEvent({ a: 'odr', q: S.q }) },
    { label: 'Personne', sub: 'Ballon dehors, faute…' },
  ]);
}

// Nouvelle équipe d'après le résumé e-Marque (side : 0 = locaux, 1 = visiteurs).
function teamFromSheet(d, side) {
  const name = (side ? d.b : d.a) || '', lv = d.level || {};
  const t = {
    id: uid(), cat: lv.cat || 'Sénior', sex: lv.sex || '', suf: teamSuffix(name),
    players: d.teams[side].players.map(p => ({ id: uid(), name: playerName(p.name), num: p.n })),
  };
  t.name = teamLabel(t);
  S.teams.push(t);
  ui.tid = t.id; ui.tnew = t.id; ui.view = 'tedit';
  sortPlayers();
  save();
  render();
  if (t.players.some(p => p.name.includes('?'))) note('Équipe créée. Certaines lettres n’ont pas été reconnues : elles sont remplacées par « ? ». Corrige les noms concernés.');
  else toast('Équipe créée : vérifie les noms et la catégorie');
}

// Après lecture du résumé : quelle équipe créer ? (la nôtre d'après le nom du club en premier)
function askSheetTeam(d) {
  const ours = guessSide(d, { ours: [cloud.club && cloud.club.name, S.clubName].filter(Boolean) });
  const opt = s => ({ label: tidyName(s ? d.b : d.a) || (s ? 'Visiteurs' : 'Locaux'), sub: `${s ? 'Visiteurs' : 'Locaux'} · ${d.teams[s].players.length} joueurs`, fn: () => teamFromSheet(d, s) });
  choose('Quelle équipe créer ?', [opt(ours), opt(1 - ours), { label: 'Annuler' }]);
}

const ACTIONS = {
  // Fenêtre de confirmation
  myes: () => { const f = answer(true); if (!f) return false; f(); },
  mno: () => { const f = answer(false); if (!f) return false; f(); },

  // Navigation
  view: el => {
    if (ui.view === 'tedit') sortPlayers();
    if (ui.view === 'comp') { S.roster.sort(cmpN); save(); }
    ui.view = el.dataset.v;
    ui.sheet = null;
    ui.sel = null;
  },
  resume: () => { ui.view = 'play'; },

  // Saisie
  pl: el => { ui.sel = ui.sel === el.dataset.p ? null : el.dataset.p; },
  desel: () => { ui.sel = null; },
  act: el => {
    if (!ui.sel) return false;
    const ev = { a: el.dataset.a, q: S.q, p: ui.sel };
    addEvent(ev);
    ui.sel = null;
    if (MISS.includes(ev.a) && S.askReb !== false) askRebound();
  },
  // Boutons directs des équipes (rebonds, ballons gagnés)
  tact: el => {
    const a = el.dataset.a, ev = { a, q: S.q };
    if (a !== 'orb' && a !== 'odr') ev.p = '__team';
    ui.sel = null;
    addEvent(ev);
  },
  mopt: el => { const f = chosen(+el.dataset.i); if (f) f(); },
  undo: () => {
    if (!S.ev.length) return false;
    const u = S.ev.pop();
    toast('Annulé : ' + evText(u));
    save();
  },
  'q+': () => { S.q++; save(); },
  'q-': () => { if (S.q > 1) { S.q--; save(); } },

  // Historique et statistiques
  hq: el => { ui.hq = el.dataset.q; },
  sq: el => { ui.sq = el.dataset.q; },
  delev: el => { S.ev.splice(+el.dataset.i, 1); save(); },
  swapev: el => {
    const e = S.ev[+el.dataset.i], to = e && SWAP[e.a];
    if (!to) return false;
    e.a = to[0];
    toast('Corrigé : ' + evText(e));
    save();
  },
  share: () => { shareImage(); return false; },
  pdf: () => { inCtx(pdf); return false; },

  // Fin de match
  archive: () => {
    if (!S.ev.length) { note('Aucune action à sauvegarder.'); return false; }
    archiveMatch();
    ui.view = 'games';
  },
  harchive: () => {
    if (!S.ev.length) ask('Ce match n’a aucune action enregistrée. Le fermer sans le sauvegarder ?', 'Fermer', () => { endMatch(); save(); });
    else ask('Terminer le match ' + S.me + ' contre ' + S.opp + ' et le sauvegarder ?', 'Sauvegarder', archiveMatch);
    return false;
  },
  new: () => {
    ask(S.ev.length ? 'Abandonner le match ' + S.me + ' contre ' + S.opp + ' sans le sauvegarder ? ' + (S.ev.length > 1 ? 'Ses ' + S.ev.length + ' actions seront effacées' : 'Son action sera effacée') + ' définitivement.' : 'Abandonner ce match ? Il n’a aucune action enregistrée.', 'Abandonner', () => { endMatch(); ui.view = 'home'; save(); }, true);
    return false;
  },

  // Matchs archivés
  gopen: el => { ui.gid = el.dataset.id; ui.view = 'game'; ui.sq = 'all'; ui.gmOpen = false; },
  // Onglets de la fiche d'un match archivé : Équipe / Joueurs
  gtab: el => { ui.gtab = el.dataset.v; },
  gf: el => { ui.gfilter = el.dataset.v; },
  gback: () => { ui.view = 'games'; },
  // Feuille e-Marque d'un match archivé
  empick: () => {
    // Démo animée : pas de fichier à choisir, l'appli « lit » la feuille fictive préparée par la démo
    const demo = DEMO && localStorage.getItem('bb-demo-em');
    if (demo) { emRead(curG(), new Promise(ok => setTimeout(() => ok(fromEm(JSON.parse(demo))), 1200))); return false; }
    const f = $('#emfile'); if (f) f.click(); return false;
  },
  emdel: () => {
    const m = curG();
    if (!m) return false;
    ask('Retirer la feuille e-Marque de ce match ? Les stats saisies restent.', 'Retirer', () => { delete m.em; save(); }, true);
    return false;
  },
  rpopen: () => { ui.view = 'report'; ui.rp = 'resume'; window.scrollTo(0, 0); },
  rp: el => { ui.rp = el.dataset.v; window.scrollTo(0, 0); },
  rpfile: () => {
    const m = curG();
    if (!m || !m.em) return false;
    const clean = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_');
    download(`stats-${clean(m.me)}-${clean(m.opp)}-${String(m.date).slice(0, 10)}.html`, withMatch(m, () => reportFile(m)), 'text/html');
    return false;
  },
  emside: el => { ui.em.side = +el.dataset.v; ui.em.opp = null; },
  emcancel: () => { ui.em = null; ui.view = 'game'; },
  emsave: () => {
    const E = ui.em, m = E && S.arch.find(z => String(z.id) === String(E.gid));
    if (!m) return false;
    m.em = toEm(E.data, E.side);
    // Nom de l'adversaire : celui de la feuille (ou corrigé dans l'écran de vérification), s'il diffère
    const n = oppOf(E).trim(), renamed = !!n && n !== m.opp;
    if (renamed) m.opp = n;
    ui.em = null; ui.view = 'game'; ui.sq = 'all';
    save();
    toast(renamed ? 'Feuille enregistrée · adversaire renommé « ' + n + ' »' : 'Feuille e-Marque enregistrée');
  },
  gdel: el => {
    const id = el.dataset.id, m = S.arch.find(z => String(z.id) === id);
    if (!m) return false;
    if (!canDelMatch(m)) { note(m.st === 'pending' ? 'Seuls son auteur, les coachs et les responsables peuvent supprimer ce match.' : 'Un match validé ne peut être supprimé que par un coach ou un responsable.'); return false; }
    ask(m.st === 'local' ? 'Supprimer définitivement ce match ? Il n’a pas été publié : il disparaîtra de cet appareil.' : 'Supprimer définitivement ce match, pour tout le club ?', 'Supprimer', () => {
      S.arch = S.arch.filter(m => String(m.id) !== id);
      cloudDel('matches', id);
      ui.view = 'games';
      save();
    }, true);
    return false;
  },

  // Publication au club : en attente de validation (bénévole) ou validé directement (coach, responsable)
  gpub: el => {
    const m = targetG(el);
    if (!m || m.st !== 'local' || !inClub()) return false;
    publish(m);
    save();
    toast(pubMsg(m));
  },
  // Tous les matchs sauvegardés sur cet appareil
  gpuball: () => {
    const L = S.arch.filter(m => m.st === 'local');
    if (!L.length || !inClub()) return false;
    ask(`Publier les ${L.length} matchs sauvegardés sur cet appareil ?` + (canEdit() ? '' : ' Un coach ou un responsable les validera.'), 'Tout publier', () => {
      L.forEach(publish);
      save();
      toast(L.length + ' matchs publiés');
    });
    return false;
  },
  gval: el => {
    const m = targetG(el);
    if (!m || m.st !== 'pending') return false;
    m.st = 'ok';
    m.val = cloud.name || '';
    save();
    toast('Match validé');
  },

  // Envoi et réception d'un match
  sendlink: () => { sendLink(); return false; },
  sendfile: () => { sendFile(); return false; },
  impopen: () => { ui.imp = null; ui.impErr = ''; ui.impText = ''; ui.view = 'import'; },
  impcancel: () => { ui.imp = null; ui.impErr = ''; ui.view = 'games'; },
  impgo: () => {
    const code = extractCode(ui.impText), m = code && decodeMatch(code);
    ui.imp = m || null;
    ui.impErr = m ? '' : 'Ce lien n’est pas un match Pick&Stats valide.';
  },
  impfile: () => { $('#impfile').click(); return false; },
  impadd: () => {
    addImported(ui.imp);
    ui.gid = ui.imp.id; ui.imp = null; ui.sq = 'all'; ui.view = 'game';
    toast('Match ajouté à tes matchs archivés');
  },
  impview: () => { ui.gid = ui.imp.id; ui.imp = null; ui.sq = 'all'; ui.view = 'game'; },

  // Démarrage d'un match
  startpick: () => {
    if (S.active) return false;
    ui.P = { teamId: null, opp: '', oppColor: null, rows: [] };
    ui.view = 'pick';
    if (S.teams.length === 1) selTeam(S.teams[0].id);
  },
  pickteam: el => { selTeam(el.dataset.id); },
  // Couleur de maillot adverse : à la composition avant le match, ou pendant le match
  ocol: el => {
    if (ui.view === 'pick' && ui.P) ui.P.oppColor = el.dataset.v;
    else { S.oppColor = el.dataset.v; save(); }
  },
  pickback: () => { ui.P.teamId = null; ui.P.rows = []; },
  pallin: el => { ui.P.rows.forEach(r => { r.in = el.dataset.v === '1'; }); },
  pstart: startMatch,

  // Composition en cours de match
  cdel: el => {
    const r = S.roster[+el.dataset.i];
    if (!r) return false;
    const v = String(r.n).trim();
    if (v && S.ev.some(z => z.p === v)) { note('Ce joueur a déjà des actions : décoche-le plutôt.'); return false; }
    S.roster.splice(+el.dataset.i, 1);
    save();
  },
  cadd: el => {
    const t = matchTeam(), p = t && t.players.find(z => z.id === el.dataset.id);
    if (!p) return false;
    const n = String(p.num || '').trim(), ok = n && !dupN(n, -1) && !S.ev.some(z => z.p === n);
    S.roster.push({ n: ok ? n : '', name: p.name, in: true, pid: p.id });
    save();
    if (!ok) toast('Donne-lui un numéro pour ce match');
  },
  // Joueur ajouté pour ce match seulement (l'équipe ne change pas) ; nw : son nom reste modifiable
  cnew: () => {
    S.roster.push({ n: '', name: '', in: true, nw: true });
    save();
  },

  // Équipes
  tedit: el => { ui.tid = el.dataset.id; sortPlayers(); ui.view = 'tedit'; },
  addteam: () => {
    const t = { id: uid(), cat: 'Sénior', sex: '', suf: '', players: [] };
    t.name = teamLabel(t);
    S.teams.push(t);
    ui.tid = t.id; ui.tnew = t.id; ui.view = 'tedit';
    save();
  },
  // Match archivé : reprend les noms de l'équipe (même numéro habituel)
  gnames: () => {
    const m = curG(), t = m && S.teams.find(z => (m.teamId ? m.teamId === z.id : m.me === z.name));
    if (!t) return false;
    let n = 0;
    m.roster.forEach(p => {
      const tp = t.players.find(z => String(z.num || '').trim() === String(p.n) && String(z.name).trim());
      if (tp && tp.name !== p.name) { p.name = tp.name; n++; }
    });
    ui.gnOpen = true;
    save();
    if (n) toast(`${n} nom${n > 1 ? 's' : ''} mis à jour`);
    else note('Aucun nom à changer. Les noms sont repris d’après le numéro habituel de chaque joueur dans l’équipe : vérifie ces numéros dans « Effectifs et matchs », ou corrige les noms à la main ci-dessous.');
  },
  tempick: () => { const f = $('#tefile'); if (f) f.click(); return false; },
  tback: () => {
    sortPlayers();
    const t = tm() && ui.tnew === ui.tid ? tm() : null;
    ui.tnew = null; ui.view = 'club';
    save();
    if (t && !t.players.some(p => String(p.name).trim())) {
      ask('Cette nouvelle équipe n’a aucun joueur. La supprimer ?', 'Supprimer', () => {
        S.teams = S.teams.filter(z => z.id !== t.id);
        cloudDel('teams', t.id);
        save();
      }, true);
    }
  },
  logopick: () => { $('#logofile').click(); return false; },
  logodel: () => { S.clubLogo = ''; save(); },
  tcolor: el => { tm().color = el.dataset.v; save(); },
  addpl: () => { tm().players.push({ id: uid(), name: '', num: '' }); save(); },
  delpl: el => { tm().players.splice(+el.dataset.i, 1); save(); },
  delteam: () => {
    const id = ui.tid;
    ask('Supprimer cette équipe et tous ses joueurs ? Les matchs archivés sont conservés.', 'Supprimer', () => {
      S.teams = S.teams.filter(z => z.id !== id);
      cloudDel('teams', id);
      ui.tnew = null; ui.view = 'club';
      save();
    }, true);
    return false;
  },

  // Réglages
  theme: el => { S.theme = el.dataset.t; save(); },
  lay: el => { S.layout = el.dataset.l; save(); },
  pst: el => { S.pstats = el.dataset.v; save(); },
  askreb: el => { S.askReb = el.dataset.v === '1'; save(); },
  awake: el => {
    S.awake = el.dataset.v === '1';
    save();
    if (S.awake) keepAwake(); else releaseAwake();
  },
  vibe: el => {
    S.vibe = el.dataset.v === '1';
    save();
    if (S.vibe) try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) {}
  },
  backup: () => { backup(); return false; },
  restore: () => { $('#restore').click(); return false; },

  // Données partagées du club
  clogin: () => { login(ui.cmail || '', ($('#cpass') || {}).value || ''); return false; },
  creset: () => { resetPassword(ui.cmail || ''); return false; },
  // Déconnexion : si des modifications n'ont pas pu partir (hors ligne), on prévient avant de les perdre
  clogout: () => {
    // Une fois déconnecté, la fenêtre du compte se ferme : on revient simplement à l'accueil
    const closed = () => { ui.sheet = null; ui.sheetFlow = false; render(); };
    logout().then(ok => {
      if (ok === false) ask('Des modifications n’ont pas encore été envoyées au club (pas de connexion ?). En te déconnectant maintenant, elles seront perdues.', 'Se déconnecter quand même', () => logout(true).then(closed), true);
      else closed();
    });
    return false;
  },
  cmode: el => { setMode(el.dataset.v); },
  sheet: () => { ui.sheet = 'account'; ui.sheetFlow = !(cloud.club && !cloud.ask); cloud.err = ''; cloud.info = ''; },
  sclose: () => { ui.sheet = null; ui.sheetFlow = false; },
  cshare: () => { shareCode(); return false; },
  ccopy: () => { copyCode(); return false; },
  csignup: () => { signup(ui.cmail || '', ($('#cpass') || {}).value || '', ui.cpseudo); return false; },
  csavename: () => { setName($('#cpseudo') ? $('#cpseudo').value : ui.cpseudo); return false; },
  cjoin: () => { joinClub(ui.ccode); return false; },
  ccreate: () => { createClub(ui.cclub || S.clubName || ''); return false; },
  cmerge: el => { keepLocal(el.dataset.v === '1'); },
  crenew: () => {
    ask('Créer un nouveau code d’invitation ? L’ancien ne permettra plus de rejoindre le club.', 'Nouveau code', renewCode);
    return false;
  },
  crole: el => { setRole(el.dataset.u, el.dataset.v); return false; },
  ckick: el => {
    const m = cloud.members.find(z => z.uid === el.dataset.u);
    ask('Retirer ' + (m ? memberName(m) : 'ce membre') + ' du club ? Il n’aura plus accès aux données du club.', 'Retirer', () => removeMember(el.dataset.u), true);
    return false;
  },
  // Suppression du compte (mot de passe redemandé) et du club (nom retapé) : définitives, on confirme encore
  cdelacct: () => {
    ask('Supprimer définitivement ton compte ?', 'Supprimer', () => Promise.resolve(deleteAccount(ui.cdelpw)).then(() => {
      if (cloud.status === 'off') { ui.sheet = null; ui.cdelpw = ''; ui.view = 'home'; toast('Ton compte a été supprimé'); }
      render();
    }), true);
    return false;
  },
  cdelclub: () => {
    const n = cloud.club ? cloud.club.name : '';
    ask('Supprimer définitivement le club ' + n + ', pour tous ses membres ?', 'Supprimer le club', () => Promise.resolve(deleteClub(ui.cdelname)).then(() => {
      if (!cloud.club) { ui.cdelname = ''; ui.view = 'home'; toast('Club supprimé'); }
      render();
    }), true);
    return false;
  },
  cleave: () => {
    ask('Quitter le club ' + (cloud.club ? cloud.club.name : '') + ' ? Tu n’auras plus accès à ses données en ligne (il te faudra un code pour revenir).', 'Quitter', leaveClub, true);
    return false;
  },
};

// Après certaines actions, place le curseur dans le bon champ.
// Animation « +1 » sur le bouton d'équipe qui vient d'être touché (après le rendu).
function popPlus(a) {
  const btn = document.querySelector('[data-x="tact"][data-a="' + a + '"]');
  if (!btn) return;
  const s = document.createElement('span');
  s.className = 'plus1';
  s.textContent = '+1';
  btn.appendChild(s);
  const b = btn.querySelector('b');
  if (b) b.classList.add('bump');
  setTimeout(() => s.remove(), 800);
}

function focusAfter(x) {
  if (x === 'cnew') { const a = document.querySelectorAll('[data-cname]'); if (a.length) a[a.length - 1].focus(); }
  if (x === 'cadd') { const a = document.querySelectorAll('[data-cnum]'), l = a[a.length - 1]; if (l && !l.value) l.focus(); }
  if (x === 'addpl') { const a = document.querySelectorAll('[data-pn]'); if (a.length) a[a.length - 1].focus(); }
}

// Actions interdites aux bénévoles.
// Actions sur un match, permises aussi à un bénévole sur son match pas encore validé (voir canEditMatch)
const MATCH_EDIT = ['gnames', 'empick', 'emdel', 'emsave'];
const EDIT_ONLY = ['tedit', 'addteam', 'tempick', 'gnames', 'delteam', 'addpl', 'delpl', 'tcolor', 'gval', 'empick', 'emdel', 'emsave', 'logopick', 'logodel', 'crenew', 'cshare', 'ccopy', 'crole', 'ckick'];

document.addEventListener('click', e => {
  // Toucher le fond sombre ferme la fenêtre comme « Annuler ».
  if (e.target.id === 'modal') {
    const f = answer(false);
    if (f) { f(); render(); }
    return;
  }
  const el = e.target.closest('[data-x]');
  if (!el) {
    // Toucher en dehors du menu d'actions le ferme.
    if (ui.sel && !e.target.closest('.bar')) { ui.sel = null; render(); }
    return;
  }
  const x = el.dataset.x, f = ACTIONS[x];
  // Menu d'actions ouvert : toucher un bouton en dehors (équipe, période, annuler…) ne fait que fermer le menu,
  // pour ne pas ajouter une action par erreur. Toucher un autre joueur change de joueur.
  if (ui.sel && x !== 'pl' && !el.closest('.bar') && !el.closest('#modal')) { ui.sel = null; render(); return; }
  // Bénévole d'un club : saisie seulement (les règles Firestore l'imposent aussi).
  if (!canEdit() && EDIT_ONLY.includes(x) && !(MATCH_EDIT.includes(x) && canEditMatch(curG()))) { note('Réservé aux coachs et responsables du club.'); return; }
  if (!f || f(el) === false) return;
  render();
  focusAfter(x);
  if (x === 'tact') popPlus(el.dataset.a);
});

// --- Saisie au clavier (enregistrée au fil de la frappe) ---

const INPUTS = {
  f: (d, t) => { S[d.f] = t.value; save(); },
  cn: (d, t) => { S.clubName = t.value; save(); },
  mby: (d, t) => {
    const m = (S.arch || []).find(z => String(z.id) === d.mby);
    if (!canEditMatch(m)) return;
    const v = t.value.trim().slice(0, 20);
    if (v) m.by = v; else delete m.by;
    save();
  },
  tn: (d, t) => {
    const team = tm();
    team.suf = t.value;
    team.name = teamLabel(team);
    save();
    const pv = $('#tprev');
    if (pv) pv.textContent = team.name;
  },
  pn: (d, t) => { tm().players[+d.pn].name = t.value; save(); },
  // Nom d'un joueur dans un match archivé
  gpn: (d, t) => { const m = curG(); if (canEditMatch(m)) { m.roster[+d.gpn].name = t.value; save(); } },
  pu: (d, t) => { tm().players[+d.pu].num = t.value; save(); },
  po: (d, t) => { ui.P.opp = t.value; },
  // Correction d'une valeur lue sur la feuille e-Marque
  // Nom de l'adversaire corrigé avant d'enregistrer la feuille e-Marque
  emo: (d, t) => { if (ui.em) ui.em.opp = t.value; },
  emv: (d, t) => {
    const [i, k] = d.emv.split('|'), p = ui.em.data.teams[ui.em.side].players[+i];
    p[k] = k === 'min' ? t.value.trim() : (parseInt(t.value, 10) || 0);
    const tr = t.closest('tr');
    if (tr) tr.classList.toggle('bad', !checkRow(p));
  },
  imp: (d, t) => { ui.impText = t.value; },
  cm: (d, t) => { ui.cmail = t.value; },
  ccode: (d, t) => { ui.ccode = t.value; },
  cpseudo: (d, t) => { ui.cpseudo = t.value; },
  cdelpw: (d, t) => { ui.cdelpw = t.value; },
  cdelname: (d, t) => { ui.cdelname = t.value; },
  cclub: (d, t) => { ui.cclub = t.value; },
  pnum: (d, t) => { ui.P.rows[+d.pnum].num = t.value; markDup(); },
  // Nom d'un joueur ajouté pour ce match (les noms des joueurs de l'équipe ne se modifient pas ici)
  cname: (d, t) => {
    const r = S.roster[+d.cname];
    if (!r || !r.nw) return;
    r.name = t.value;
    save();
  },
  // Le numéro n'est validé qu'en quittant le champ (voir CHANGES.cnum)
  cnum: (d, t) => {
    const i = +d.cnum, v = t.value.trim(), old = String(S.roster[i].n).trim();
    t.classList.toggle('dup', v !== old && (dupN(v, i) || (v !== '' && S.ev.some(z => z.p === v))));
  },
};

document.addEventListener('input', e => {
  const d = e.target.dataset;
  const k = Object.keys(INPUTS).find(k => d[k] !== undefined);
  if (k) INPUTS[k](d, e.target);
});

// --- Changements validés (cases à cocher, listes, champ quitté) ---

// Change le numéro d'un joueur en cours de match et déplace ses actions.
function renumber(t, i) {
  const r = S.roster[i], old = String(r.n).trim(), v = t.value.trim();
  if (v === old) return;
  const bad = !v && old && S.ev.some(z => z.p === old) ? 'Ce joueur a déjà des actions : il lui faut un numéro.'
    : dupN(v, i) ? 'Le numéro ' + v + ' est déjà attribué à un autre joueur.'
    : v && S.ev.some(z => z.p === v) ? 'Le numéro ' + v + ' a déjà des actions dans ce match.'
    : '';
  if (bad) { note(bad); t.value = r.n; t.classList.remove('dup'); return; }
  if (old) S.ev.forEach(z => { if (z.p === old) z.p = v; });
  r.n = v;
  save();
  const b = document.querySelector('[data-x="cdel"][data-i="' + i + '"]');
  if (b) b.disabled = !!v && S.ev.some(z => z.p === v);
}

document.addEventListener('change', e => {
  const t = e.target, d = t.dataset;
  if (t.id === 'restore') { restoreFile(t.files[0], render); t.value = ''; return; }
  if (t.id === 'logofile') {
    const f = t.files[0];
    t.value = '';
    logoFromFile(f).then(url => { S.clubLogo = url; save(); render(); toast('Logo enregistré'); })
      .catch(() => note('Cette image ne peut pas être lue. Essaie une image JPEG ou PNG.'));
    return;
  }
  if (t.id === 'emfile') {
    const files = Array.from(t.files || []);
    t.value = '';
    if (files.length) emRead(curG(), readEmarque(files));
    return;
  }
  if (t.id === 'tefile') {
    const files = Array.from(t.files || []);
    t.value = '';
    if (!files.length) return;
    ui.teBusy = true;
    render();
    readEmarque(files).then(d => { ui.teBusy = false; render(); askSheetTeam(d); })
      .catch(e => {
        ui.teBusy = false;
        render();
        note(e && e.message && /e-Marque|PDF/.test(e.message) ? e.message : 'Ce PDF ne peut pas être lu. Choisis le résumé de l’e-Marque (fichier « resume_… .pdf »).');
      });
    return;
  }
  if (t.id === 'impfile') {
    const f = t.files[0];
    t.value = '';
    if (f) readMatchFile(f).then(m => {
      ui.imp = m;
      ui.impErr = m ? '' : 'Ce fichier n’est pas un match Pick&Stats valide.';
      render();
    });
    return;
  }
  if (d.crole !== undefined) { setRole(d.crole, t.value); return; }
  if (d.pc !== undefined) { ui.P.rows[+d.pc].in = t.checked; markDup(); return; }
  if (d.cin !== undefined) { S.roster[+d.cin].in = t.checked; save(); return; }
  if (d.cnum !== undefined) { renumber(t, +d.cnum); return; }
  if (d.f && !t.value.trim()) {
    S[d.f] = d.f === 'me' ? 'Mon équipe' : 'Adversaire';
    t.value = S[d.f];
    save();
  }
  if (d.tc !== undefined || d.ts !== undefined) {
    const team = tm();
    if (d.tc !== undefined) team.cat = t.value; else team.sex = t.value;
    team.name = teamLabel(team);
    save();
    render();
  }
});

// Garde ouvert le volet « Corriger les noms des joueurs » d'un match archivé entre deux affichages.
swipeNav(document);

document.addEventListener('toggle', e => {
  if (e.target.classList && e.target.classList.contains('gnames')) ui.gnOpen = e.target.open;
  if (e.target.classList && e.target.classList.contains('gman')) ui.gmOpen = e.target.open;
}, true);

// Tableaux qui défilent de côté : ombre sous la colonne des joueurs seulement une fois glissés.
document.addEventListener('scroll', e => {
  const t = e.target;
  if (t.classList && t.classList.contains('tscroll')) t.classList.toggle('slid', t.scrollLeft > 2);
}, true);
