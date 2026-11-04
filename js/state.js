// État de l'appli : données enregistrées (S) et état de l'écran (ui).

import { STORAGE_KEY } from './constants.js';
import { uid, cmpN } from './util.js';

function fresh() {
  return { me: 'Mon équipe', opp: 'Adversaire', roster: [], ev: [], q: 1, arch: [], teams: [], active: false, teamId: null, clubName: '' };
}

// Met à niveau les données des anciennes versions.
export function migrate(s) {
  if (typeof s.roster === 'string') {
    s.roster = s.roster.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const i = l.search(/\s/);
      return i < 0 ? { n: l, name: '' } : { n: l.slice(0, i), name: l.slice(i + 1).trim() };
    });
  }
  if (!Array.isArray(s.roster)) s.roster = [];
  s.ev.forEach(e => { if (e.a === 'reb') e.a = 'rd'; });
  s.roster.sort(cmpN);
  if (!Array.isArray(s.arch)) s.arch = [];
  const seen = new Set();
  s.arch.forEach((m, i) => {
    if (!Array.isArray(m.ev)) m.ev = [];
    if (!Array.isArray(m.roster)) m.roster = [];
    if (!m.date) m.date = new Date().toISOString();
    if (!m.me) m.me = 'Équipe';
    if (!m.opp) m.opp = 'Adversaire';
    if (!m.q) m.q = 1;
    if (m.id == null || seen.has(String(m.id))) m.id = Date.now() + i;
    seen.add(String(m.id));
  });
  if (!Array.isArray(s.teams)) {
    s.teams = [];
    const pl = s.roster.filter(p => String(p.n).trim());
    if (pl.length) {
      const t = { id: uid(), name: s.me || 'Mon équipe', players: pl.map(p => ({ id: uid(), name: p.name || '', num: String(p.n) })) };
      s.teams.push(t);
      s.teamId = t.id;
    }
    s.active = s.ev.length > 0;
  }
  s.teams.forEach(t => { if (!t.cat) { t.cat = 'Autre'; t.suf = t.name || ''; t.sex = ''; } });
  return { ...fresh(), ...s };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && Array.isArray(s.ev)) return migrate(s);
  } catch (e) {}
  return fresh();
}

// Données enregistrées. Export « vivant » : les autres modules voient
// toujours la valeur actuelle, mais seul ce fichier peut la réaffecter.
export let S = load();

export function setS(v) { S = v; }

export function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch (e) {}
}

// Exécute f() comme si le match archivé m était le match en cours
// (pour réutiliser les tableaux et les exports).
export function withMatch(m, f) {
  if (!m) return f();
  const b = S;
  S = { ...b, me: m.me, opp: m.opp, ev: m.ev, q: m.q, roster: m.roster };
  try { return f(); } finally { S = b; }
}

// État de l'écran (non enregistré).
export const ui = {
  view: 'home',   // écran affiché
  sel: null,      // joueur sélectionné sur la saisie ('__team', '__opp' ou un numéro)
  tid: null,      // équipe en cours de modification
  tnew: null,     // équipe tout juste créée
  gid: null,      // match archivé affiché
  gfilter: 'all', // filtre de la liste des matchs archivés
  P: null,        // préparation d'un match : { teamId, opp, rows }
  sq: 'all',      // période affichée dans les statistiques
  hq: 'all',      // période affichée dans l'historique
};
