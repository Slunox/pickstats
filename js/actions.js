// Réactions aux clics et à la saisie.
// Chaque bouton porte data-x="nom" ; ACTIONS[nom](el) est appelée au clic.
// Une action qui renvoie false n'entraîne pas de rafraîchissement de l'écran.

import { S, ui, save } from './state.js';
import { $, uid, cmpN } from './util.js';
import { roster, dupN, evText, teamLabel, tm, matchTeam, sortPlayers, selTeam } from './model.js';
import { toast, ask, note, answer, choose, chosen } from './dom.js';
import { MISS, SWAP } from './constants.js';
import { inCtx, share, copyText, pdf, csv, backup, restoreFile } from './export.js';
import { markDup } from './views/pick.js';
import { logoFromFile } from './logo.js';
import { render } from './render.js';
import { keepAwake, releaseAwake } from './awake.js';
import { sendLink, sendFile, decodeMatch, extractCode, readMatchFile, addImported } from './share.js';
import { shareCode, setName, login, signup, logout, resetPassword, setMode, createClub, joinClub, keepLocal, renewCode, setRole, removeMember, leaveClub, cloudDel, cloud } from './cloud.js';

// --- Match ---

function endMatch() {
  S.ev = []; S.q = 1; S.opp = 'Adversaire'; S.roster = []; S.active = false; S.matchId = null;
  ui.sel = null; ui.sq = 'all';
}

function archiveMatch() {
  S.arch.push({
    id: S.matchId || Date.now(), date: new Date().toISOString(), me: S.me, opp: S.opp, teamId: S.teamId, q: S.q,
    ev: S.ev.slice(), roster: roster().map(p => ({ n: p.n, name: p.name, in: true })),
    ...(cloud.name ? { by: cloud.name } : {}), // pseudo de celui qui a fait les stats
  });
  endMatch();
  save();
  toast('Match archivé');
}

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
    { label: 'Nous', sub: 'Rebond offensif', cls: 'us', fn: () => addEvent({ a: 'ro', q: S.q, p: '__team' }) },
    { label: 'Eux', sub: 'Rebond défensif', cls: 'them', fn: () => addEvent({ a: 'odr', q: S.q }) },
    { label: 'Personne', sub: 'Ballon dehors, faute…' },
  ]);
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
  share: () => { inCtx(share); return false; },
  copy: () => { inCtx(copyText); return false; },
  pdf: () => { inCtx(pdf); return false; },
  csv: () => { inCtx(csv); return false; },

  // Fin de match
  archive: () => {
    if (!S.ev.length) { note('Aucune action à archiver.'); return false; }
    archiveMatch();
    ui.view = 'games';
  },
  harchive: () => {
    if (!S.ev.length) ask('Ce match n’a aucune action enregistrée. Le fermer sans l’archiver ?', 'Fermer', () => { endMatch(); save(); });
    else ask('Terminer le match ' + S.me + ' contre ' + S.opp + ' et l’archiver ?', 'Archiver', archiveMatch);
    return false;
  },
  new: () => {
    ask('Effacer toutes les statistiques de ce match sans l’archiver ?', 'Effacer', () => { endMatch(); ui.view = 'home'; save(); }, true);
    return false;
  },

  // Matchs archivés
  gopen: el => { ui.gid = el.dataset.id; ui.view = 'game'; ui.sq = 'all'; },
  gf: el => { ui.gfilter = el.dataset.v; },
  gback: () => { ui.view = 'games'; },
  gdel: el => {
    const id = el.dataset.id;
    ask('Supprimer définitivement ce match archivé ?', 'Supprimer', () => {
      S.arch = S.arch.filter(m => String(m.id) !== id);
      cloudDel('matches', id);
      ui.view = 'games';
      save();
    }, true);
    return false;
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
    ui.P = { teamId: null, opp: '', rows: [] };
    ui.view = 'pick';
    if (S.teams.length === 1) selTeam(S.teams[0].id);
  },
  pickteam: el => { selTeam(el.dataset.id); },
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
  cnew: () => {
    const t = matchTeam(), r = { n: '', name: '', in: true };
    if (t) { const p = { id: uid(), name: '', num: '' }; t.players.push(p); r.pid = p.id; }
    S.roster.push(r);
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
  clogout: () => { logout(); return false; },
  cmode: el => { setMode(el.dataset.v); },
  sheet: () => { ui.sheet = 'account'; ui.sheetFlow = !(cloud.club && !cloud.ask); cloud.err = ''; cloud.info = ''; },
  sclose: () => { ui.sheet = null; ui.sheetFlow = false; },
  cshare: () => { shareCode(); return false; },
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
    ask('Retirer ' + (m ? m.email : 'ce membre') + ' du club ? Il n’aura plus accès aux données du club.', 'Retirer', () => removeMember(el.dataset.u), true);
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
  if (!f || f(el) === false) return;
  render();
  focusAfter(x);
  if (x === 'tact') popPlus(el.dataset.a);
});

// --- Saisie au clavier (enregistrée au fil de la frappe) ---

const INPUTS = {
  f: (d, t) => { S[d.f] = t.value; save(); },
  cn: (d, t) => { S.clubName = t.value; save(); },
  tn: (d, t) => {
    const team = tm();
    team.suf = t.value;
    team.name = teamLabel(team);
    save();
    const pv = $('#tprev');
    if (pv) pv.textContent = team.name;
  },
  pn: (d, t) => { tm().players[+d.pn].name = t.value; save(); },
  pu: (d, t) => { tm().players[+d.pu].num = t.value; save(); },
  po: (d, t) => { ui.P.opp = t.value; },
  imp: (d, t) => { ui.impText = t.value; },
  cm: (d, t) => { ui.cmail = t.value; },
  ccode: (d, t) => { ui.ccode = t.value; },
  cpseudo: (d, t) => { ui.cpseudo = t.value; },
  cclub: (d, t) => { ui.cclub = t.value; },
  pnum: (d, t) => { ui.P.rows[+d.pnum].num = t.value; markDup(); },
  cname: (d, t) => {
    const r = S.roster[+d.cname];
    r.name = t.value;
    const team = matchTeam(), p = team && r.pid && team.players.find(z => z.id === r.pid);
    if (p) p.name = r.name;
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
