// Données partagées du club (Firebase) : équipes, matchs archivés et nom du club.
//
// Chaque utilisateur crée son compte, puis crée un club (il en devient responsable)
// ou en rejoint un avec le code d'invitation donné par un responsable.
// Il n'a accès qu'aux données de son club (voir firestore.rules).
//
// Organisation dans Firestore :
//   users/{uid}                     -> { clubId } : club de l'utilisateur
//   invites/{code}                  -> { clubId } : code d'invitation en cours
//   clubs/{clubId}                  -> { name, owner, code }
//   clubs/{clubId}/members/{uid}    -> { email, role: 'admin' | 'coach' }
//   clubs/{clubId}/teams/{id}       -> une équipe et sa composition
//   clubs/{clubId}/matches/{id}     -> un match archivé
//
// Tout reste enregistré sur l'appareil comme avant ; quand on est connecté, chaque
// modification est envoyée et celles des autres appareils arrivent ici.
// Le match en cours n'est pas partagé : il part au moment de l'archivage.
//
// Pour chaque élément, on retient l'empreinte de la dernière version échangée (seen) :
//  - modifié ici, inchangé en ligne -> on envoie la version de l'appareil ;
//  - sinon                          -> la version en ligne remplace celle de l'appareil.
// Les suppressions sont notées (tombes) jusqu'à ce que Firestore les ait reçues.

import { S, save, saveHooks } from './state.js';
import { FIREBASE } from './cloud-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const SEEN_KEY = 'bb-cloud-seen';
const DEL_KEY = 'bb-cloud-del';
const ON_KEY = 'bb-cloud-on';

// État affiché dans les réglages.
// status : 'none' (pas configuré), 'off' (déconnecté), 'loading', 'on' (connecté)
// club   : null tant que l'utilisateur n'a pas de club, sinon { id, name, code, role }
// ask    : { teams, matches } quand il faut décider quoi faire des données déjà sur l'appareil
export const cloud = {
  status: FIREBASE ? 'off' : 'none', mode: 'login', email: '', uid: '', err: '', info: '',
  club: null, clubLoading: false, ask: null, members: [], offline: false, pending: false,
};

// Pour les tests : remplace le SDK chargé depuis gstatic et la configuration.
export const _test = { sdk: null, config: null };
const cfg = () => _test.config || FIREBASE;

// --- Éléments partagés ---

const byId = (list, id) => list.findIndex(x => String(x.id) === id);
const putIn = (key, id, d) => { const i = byId(S[key], id); if (i < 0) S[key].push(d); else S[key][i] = d; };

const KINDS = {
  teams: {
    ids: () => S.teams.map(t => String(t.id)),
    get: id => S.teams[byId(S.teams, id)],
    put: (id, d) => putIn('teams', id, d),
    del: id => { S.teams = S.teams.filter(t => String(t.id) !== id); },
  },
  matches: {
    ids: () => S.arch.map(m => String(m.id)),
    get: id => S.arch[byId(S.arch, id)],
    put: (id, d) => putIn('arch', id, d),
    del: id => { S.arch = S.arch.filter(m => String(m.id) !== id); },
  },
};

// Empreinte indépendante de l'ordre des clés (Firestore ne le conserve pas).
export function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(x => (x === undefined ? 'null' : canon(x))).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

const plain = v => JSON.parse(JSON.stringify(v));

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

let seen = load(SEEN_KEY, {});   // 'club/kind/id' -> empreinte
let tombs = load(DEL_KEY, []);   // ['club/kind/id'] à supprimer dans Firestore
const keepSeen = () => store(SEEN_KEY, seen);
const keepTombs = () => store(DEL_KEY, tombs);

// --- Firebase ---

let F = null;         // fonctions du SDK
let auth = null, db = null;
let unsubs = [];      // écoutes des données du club
let unsubMember = null;
let ready = {};       // kind -> premier instantané reçu
let meta = {};        // kind -> { fromCache, pending }
let redraw = () => {};
let deferred = false;

async function loadSdk() {
  if (_test.sdk) return _test.sdk;
  const [app, a, f] = await Promise.all([
    import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js'),
  ]);
  return { ...app, ...a, ...f };
}

// Redessine l'écran, sauf pendant une saisie (on attend que le champ soit quitté).
function refresh() {
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
    if (!deferred) {
      deferred = true;
      el.addEventListener('blur', () => { deferred = false; setTimeout(redraw, 0); }, { once: true });
    }
    return;
  }
  redraw();
}

// Quitte le champ de saisie pour que l'écran puisse se mettre à jour tout de suite.
const unfocus = () => { try { document.activeElement.blur(); } catch (e) {} };

function setStatus() {
  const m = Object.values(meta);
  cloud.offline = m.some(x => x.fromCache);
  cloud.pending = m.some(x => x.pending) || tombs.some(k => cloud.club && k.startsWith(cloud.club.id + '/'));
}

const clubId = () => (cloud.club && !cloud.ask ? cloud.club.id : null);
const col = (kind) => F.collection(db, 'clubs', clubId(), kind);
const ref = (kind, id) => F.doc(db, 'clubs', clubId(), kind, id);

// Applique les changements reçus de Firestore.
function onSnap(kind, snap) {
  const K = KINDS[kind], c = clubId();
  if (!c) return;
  let changed = false;
  snap.docChanges().forEach(ch => {
    if (ch.doc.metadata.hasPendingWrites) return; // écho de nos propres envois
    const id = ch.doc.id, key = c + '/' + kind + '/' + id;
    if (tombs.includes(key)) return;
    const local = K.get(id), lh = local ? canon(local) : null;
    if (ch.type === 'removed') {
      if (local) { K.del(id); changed = true; }
      delete seen[key];
      return;
    }
    const remote = ch.doc.data(), rh = canon(remote), s = seen[key];
    if (lh === rh) { seen[key] = rh; return; }
    if (s !== undefined && lh !== null && lh !== s && rh === s) return; // modifié ici seulement : flush l'enverra
    K.put(id, remote);
    seen[key] = rh;
    changed = true;
  });
  meta[kind] = { fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites };
  ready[kind] = true;
  keepSeen();
  afterSnap(changed);
}

// Nom du club : même principe, sur le document du club.
function onClubSnap(snap) {
  const c = clubId();
  if (!c || !snap.exists()) return;
  const d = snap.data(), key = c + '/name', s = seen[key], lh = S.clubName || '', rh = d.name || '';
  cloud.club.name = rh;
  cloud.club.code = d.code || '';
  let changed = false;
  if (snap.metadata.hasPendingWrites) { /* écho de notre envoi */ }
  else if (lh === rh) seen[key] = rh;
  else if (!(s !== undefined && lh !== s && rh === s)) { S.clubName = rh; seen[key] = rh; changed = true; }
  ready.club = true;
  keepSeen();
  afterSnap(changed);
  if (!changed) refresh(); // le nom ou le code affichés ont pu changer
}

function afterSnap(changed) {
  const before = cloud.offline + '' + cloud.pending;
  setStatus();
  if (changed) save(); // enregistre sur l'appareil ; flush (différé) envoie ce qui reste
  else flush();
  if (changed || before !== cloud.offline + '' + cloud.pending) refresh();
}

// Envoie à Firestore ce qui a changé sur l'appareil.
function flush() {
  const c = clubId();
  if (!db || !c) return;
  tombs.filter(k => k.startsWith(c + '/')).forEach(key => {
    const [, kind, id] = key.split('/');
    F.deleteDoc(ref(kind, id)).then(() => {
      tombs = tombs.filter(k => k !== key);
      keepTombs();
      setStatus();
    }).catch(fail);
    delete seen[key];
  });
  Object.entries(KINDS).forEach(([kind, K]) => {
    if (!ready[kind]) return;
    K.ids().forEach(id => {
      const key = c + '/' + kind + '/' + id;
      if (tombs.includes(key)) return;
      const d = K.get(id), h = canon(d);
      if (seen[key] === h) return;
      seen[key] = h;
      F.setDoc(ref(kind, id), plain(d)).catch(fail);
    });
  });
  if (ready.club) {
    const key = c + '/name', name = S.clubName || '';
    if (seen[key] !== name) {
      seen[key] = name;
      F.updateDoc(F.doc(db, 'clubs', c), { name }).catch(fail);
    }
  }
  keepSeen();
}

let timer = null;
saveHooks.push(() => {
  clearTimeout(timer);
  timer = setTimeout(flush, 800);
});

function fail(e) {
  const code = (e && e.code) || '';
  cloud.err = code.includes('permission-denied')
    ? 'Accès refusé par Firebase. Vérifie que les règles Firestore sont à jour (voir FIREBASE.md).'
    : 'Erreur de synchronisation : ' + (e && e.message ? e.message : code);
  refresh();
}

function listen() {
  stopListening();
  ready = {};
  meta = {};
  const c = clubId();
  if (!c) return;
  unsubs = Object.keys(KINDS).map(kind =>
    F.onSnapshot(col(kind), { includeMetadataChanges: true }, snap => onSnap(kind, snap), fail));
  unsubs.push(F.onSnapshot(F.doc(db, 'clubs', c), onClubSnap, fail));
  unsubs.push(F.onSnapshot(col('members'), snap => {
    cloud.members = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => (a.role === b.role ? String(a.email).localeCompare(String(b.email)) : a.role === 'admin' ? -1 : 1));
    refresh();
  }, () => {}));
}

function stopListening() {
  unsubs.forEach(u => u());
  unsubs = [];
  ready = {};
  meta = {};
}

// --- Club de l'utilisateur ---

// Données de cet appareil rattachées au club c : on commence à synchroniser.
function attach(c) {
  if (S.cloudClub && S.cloudClub !== c) {
    // Données d'un autre club : elles sont déjà en ligne dans ce club, on les retire d'ici.
    S.teams = [];
    S.arch = [];
    S.clubName = '';
    S.cloudClub = c;
    save();
  } else if (!S.cloudClub && (S.teams.length || S.arch.length)) {
    cloud.ask = { teams: S.teams.length, matches: S.arch.length };
    refresh();
    return;
  }
  S.cloudClub = c;
  cloud.ask = null;
  save();
  listen();
  refresh();
}

// Suit son appartenance au club : rôle, ou retrait par un responsable.
function watchMember(c) {
  if (unsubMember) unsubMember();
  cloud.clubLoading = true;
  let attached = false;
  unsubMember = F.onSnapshot(F.doc(db, 'clubs', c, 'members', cloud.uid), snap => {
    cloud.clubLoading = false;
    if (!snap.exists()) {
      if (!snap.metadata.fromCache || attached) {
        if (attached) cloud.info = 'Tu ne fais plus partie du club ' + (cloud.club ? cloud.club.name : '') + '.';
        detach();
      }
      refresh();
      return;
    }
    const role = snap.data().role || 'coach';
    if (!cloud.club || cloud.club.id !== c) cloud.club = { id: c, name: '', code: '', role };
    else cloud.club.role = role;
    if (attached) { refresh(); return; }
    attached = true;
    // Nom du club (pour la question sur les données de l'appareil), puis synchronisation.
    F.getDoc(F.doc(db, 'clubs', c)).then(d => {
      if (d.exists() && cloud.club) { cloud.club.name = d.data().name || ''; cloud.club.code = d.data().code || ''; }
    }).catch(() => {}).then(() => { if (cloud.club && cloud.club.id === c) attach(c); });
  }, e => { cloud.clubLoading = false; detach(); fail(e); });
}

function detach() {
  if (unsubMember) { unsubMember(); unsubMember = null; }
  stopListening();
  cloud.club = null;
  cloud.ask = null;
  cloud.members = [];
  cloud.clubLoading = false;
}

async function findClub() {
  cloud.clubLoading = true;
  refresh();
  let c = null;
  try {
    const u = await F.getDoc(F.doc(db, 'users', cloud.uid));
    c = u.exists() ? u.data().clubId : null;
  } catch (e) {
    c = S.cloudClub || null; // hors ligne : on reprend le club de l'appareil
  }
  if (c) watchMember(c);
  else { cloud.clubLoading = false; refresh(); }
}

// --- Démarrage et connexion ---

async function start() {
  if (F) return true;
  cloud.status = 'loading';
  cloud.err = '';
  refresh();
  try {
    F = await loadSdk();
  } catch (e) {
    cloud.status = 'off';
    cloud.err = 'Impossible de charger Firebase : vérifie la connexion internet.';
    refresh();
    return false;
  }
  const app = F.initializeApp(cfg());
  auth = F.getAuth(app);
  try {
    db = F.initializeFirestore(app, {
      localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  } catch (e) {
    db = F.initializeFirestore(app, { ignoreUndefinedProperties: true });
  }
  F.onAuthStateChanged(auth, user => {
    detach();
    if (user) {
      cloud.status = 'on';
      cloud.email = user.email || '';
      cloud.uid = user.uid;
      cloud.err = '';
      store(ON_KEY, 1);
      findClub();
    } else {
      cloud.status = 'off';
      cloud.email = '';
      cloud.uid = '';
    }
    refresh();
  });
  return true;
}

// Au démarrage : se reconnecte si on l'était.
export function initCloud(render) {
  redraw = render;
  if (cfg() && load(ON_KEY, 0)) start();
}

const ERR = {
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
  'auth/invalid-login-credentials': 'E-mail ou mot de passe incorrect.',
  'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
  'auth/user-not-found': 'E-mail ou mot de passe incorrect.',
  'auth/invalid-email': 'Adresse e-mail invalide.',
  'auth/missing-password': 'Saisis un mot de passe.',
  'auth/weak-password': 'Mot de passe trop court : 6 caractères minimum.',
  'auth/email-already-in-use': 'Un compte existe déjà avec cet e-mail : connecte-toi.',
  'auth/operation-not-allowed': 'Les inscriptions ne sont pas activées dans Firebase (voir FIREBASE.md).',
  'auth/too-many-requests': 'Trop d’essais : réessaie dans quelques minutes.',
  'auth/network-request-failed': 'Pas de connexion internet.',
  'auth/user-disabled': 'Ce compte a été désactivé.',
  'permission-denied': 'Accès refusé par Firebase. Vérifie que les règles Firestore sont à jour (voir FIREBASE.md).',
  'unavailable': 'Pas de connexion internet.',
};
const errText = e => ERR[e && e.code] || 'Erreur (' + ((e && (e.code || e.message)) || 'inconnue') + ').';

// Lance une opération en affichant son erreur éventuelle.
async function run(f) {
  if (!cfg()) return;
  unfocus();
  cloud.err = '';
  cloud.info = '';
  if (!(await start())) return;
  try {
    await f();
  } catch (e) {
    cloud.err = errText(e);
    if (cloud.status === 'loading') cloud.status = 'off';
  }
  refresh();
}

export const setMode = m => { cloud.mode = m; cloud.err = ''; cloud.info = ''; };

export const login = (email, password) => run(async () => {
  if (!email) throw { code: 'auth/invalid-email' };
  cloud.status = 'loading';
  refresh();
  await F.signInWithEmailAndPassword(auth, email.trim(), password);
});

export const signup = (email, password) => run(async () => {
  if (!email) throw { code: 'auth/invalid-email' };
  cloud.status = 'loading';
  refresh();
  await F.createUserWithEmailAndPassword(auth, email.trim(), password);
});

export const resetPassword = email => run(async () => {
  if (!email) { cloud.err = 'Saisis ton adresse e-mail, puis touche « Mot de passe oublié ».'; return; }
  await F.sendPasswordResetEmail(auth, email.trim());
  cloud.info = 'Un e-mail pour choisir un nouveau mot de passe a été envoyé à ' + email.trim() + '.';
});

export async function logout() {
  detach();
  store(ON_KEY, 0);
  if (auth) await F.signOut(auth);
  cloud.status = 'off';
  cloud.email = '';
  cloud.err = '';
  cloud.info = '';
  refresh();
}

// Code d'invitation : 8 caractères faciles à lire (sans 0/O, 1/I/L).
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCodeValue() {
  const r = new Uint32Array(8);
  crypto.getRandomValues(r);
  return Array.from(r, x => ABC[x % ABC.length]).join('');
}
export const showCode = c => (c ? c.slice(0, 4) + '-' + c.slice(4) : '');
const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export const createClub = name => run(async () => {
  name = String(name || '').trim();
  if (!name) { cloud.err = 'Donne un nom à ton club.'; return; }
  const c = F.doc(F.collection(db, 'clubs')).id, code = newCodeValue(), now = new Date().toISOString();
  const b = F.writeBatch(db);
  b.set(F.doc(db, 'clubs', c), { name, owner: cloud.uid, code, created: now });
  b.set(F.doc(db, 'clubs', c, 'members', cloud.uid), { email: cloud.email, role: 'admin', joined: now });
  b.set(F.doc(db, 'invites', code), { clubId: c });
  b.set(F.doc(db, 'users', cloud.uid), { clubId: c });
  await b.commit();
  if (!S.clubName) S.clubName = name;
  watchMember(c);
});

export const joinClub = code => run(async () => {
  code = cleanCode(code);
  if (code.length !== 8) { cloud.err = 'Le code d’invitation a 8 caractères (par ex. K7P2-9QXM).'; return; }
  const inv = await F.getDoc(F.doc(db, 'invites', code));
  if (!inv.exists()) { cloud.err = 'Code inconnu ou plus valable : demande le code actuel au responsable du club.'; return; }
  const c = inv.data().clubId, now = new Date().toISOString();
  const b = F.writeBatch(db);
  b.set(F.doc(db, 'clubs', c, 'members', cloud.uid), { email: cloud.email, role: 'coach', code, joined: now });
  b.set(F.doc(db, 'users', cloud.uid), { clubId: c });
  await b.commit();
  watchMember(c);
});

// Données déjà sur l'appareil au premier rattachement : on les ajoute au club ou on les retire.
export function keepLocal(add) {
  const c = cloud.club && cloud.club.id;
  if (!c) return;
  if (!add) { S.teams = []; S.arch = []; }
  S.cloudClub = c;
  cloud.ask = null;
  save();
  listen();
}

// Responsable : nouveau code (l'ancien ne permet plus de rejoindre le club).
export const renewCode = () => run(async () => {
  const c = cloud.club, code = newCodeValue();
  const b = F.writeBatch(db);
  b.set(F.doc(db, 'invites', code), { clubId: c.id });
  if (c.code) b.delete(F.doc(db, 'invites', c.code));
  b.update(F.doc(db, 'clubs', c.id), { code });
  await b.commit();
  cloud.info = 'Nouveau code : ' + showCode(code) + '. L’ancien ne fonctionne plus.';
});

const admins = () => cloud.members.filter(m => m.role === 'admin');

export const setRole = (uid, role) => run(async () => {
  if (role === 'coach' && admins().length < 2 && admins().some(m => m.uid === uid)) {
    cloud.err = 'Le club doit garder au moins un responsable.';
    return;
  }
  await F.updateDoc(F.doc(db, 'clubs', cloud.club.id, 'members', uid), { role });
});

export const removeMember = uid => run(async () => {
  await F.deleteDoc(F.doc(db, 'clubs', cloud.club.id, 'members', uid));
});

export const leaveClub = () => run(async () => {
  const c = cloud.club;
  if (c.role === 'admin' && admins().length < 2 && cloud.members.length > 1) {
    cloud.err = 'Tu es le seul responsable : nomme d’abord un autre responsable.';
    return;
  }
  const b = F.writeBatch(db);
  b.delete(F.doc(db, 'clubs', c.id, 'members', cloud.uid));
  b.delete(F.doc(db, 'users', cloud.uid));
  detach();
  await b.commit();
  cloud.info = 'Tu as quitté le club ' + c.name + '. Ses équipes et matchs restent sur cet appareil.';
});

// Suppression d'une équipe ou d'un match archivé (kind : 'teams' ou 'matches').
export function cloudDel(kind, id) {
  if (!cfg() || !S.cloudClub) return;
  const key = S.cloudClub + '/' + kind + '/' + String(id);
  if (!tombs.includes(key)) tombs.push(key);
  keepTombs();
  setStatus();
  flush();
}

// Après une restauration de sauvegarde : relit tout depuis Firestore
// (ce qui n'est pas dans la sauvegarde revient, ce qui a changé est envoyé).
export function cloudResync() {
  if (!clubId()) return;
  S.cloudClub = clubId();
  save();
  listen();
}
