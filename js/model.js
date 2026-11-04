// Calculs sur les données : effectif, stats, équipes.

import { S, ui } from './state.js';
import { LBL, PK, CATS } from './constants.js';
import { cmpN } from './util.js';

const inQ = (e, q) => q == null || e.q === q;

export const periods = () => {
  const m = Math.max(4, S.q, ...S.ev.map(e => e.q));
  return Array.from({ length: m }, (_, i) => i + 1);
};

// Tous les joueurs du match qui ont un numéro (sans doublon), triés.
export function allP() {
  return S.roster
    .filter(p => String(p.n).trim())
    .map(p => ({ n: String(p.n).trim(), name: String(p.name || '').trim(), in: p.in !== false }))
    .filter((p, i, a) => a.findIndex(q => q.n === p.n) === i)
    .sort(cmpN);
}

// Joueurs à faire apparaître dans les stats : présents ou ayant des actions.
export const roster = () => allP().filter(p => p.in || S.ev.some(e => e.p === p.n));

export const roster1 = n => roster().find(r => r.n === n) || { n, name: '' };

// Numéro déjà pris par un autre joueur que celui d'indice i ?
export const dupN = (n, i) => {
  const v = String(n).trim();
  return v !== '' && S.roster.some((q, j) => j !== i && String(q.n).trim() === v);
};

// Stats par joueur pour une période (null = tout le match).
export function tally(q) {
  const o = {};
  roster().forEach(p => { o[p.n] = { ...p }; PK.forEach(k => { o[p.n][k] = 0; }); });
  S.ev.forEach(e => { if (inQ(e, q) && o[e.p] && PK.includes(e.a)) o[e.p][e.a]++; });
  return o;
}

export const cnt = (a, q) => S.ev.filter(e => e.a === a && inQ(e, q)).length;

export const miss = r => r.m1 + r.m2 + r.m3;

const isOpp = e => e.a === 'orb' || e.a === 'odr';

export const who = e => isOpp(e) ? S.opp
  : e.p === '__team' ? 'Équipe'
  : '#' + e.p + (roster1(e.p).name ? ' ' + roster1(e.p).name : '');

// Stats affichées sur les boutons joueurs : 'all' (toutes), 'last' (la dernière) ou 'off'.
// Les anciennes versions enregistraient true/false.
export const statsMode = () => (S.pstats === false || S.pstats === 'off' ? 'off' : S.pstats === 'last' ? 'last' : 'all');

// Dernière action individuelle d'un joueur pendant la période q.
export const lastAction = (n, q) => {
  for (let i = S.ev.length - 1; i >= 0; i--) {
    const e = S.ev[i];
    if (e.p === n && e.q === q && PK.includes(e.a)) return e;
  }
  return null;
};

export const evText = e => isOpp(e) ? LBL[e.a] : (e.p === '__team' ? 'Équipe' : '#' + e.p) + ' : ' + LBL[e.a];

// --- Équipes ---

export function teamLabel(t) {
  if (t.cat === 'Autre') return String(t.suf || '').trim() || 'Équipe';
  return [t.cat, t.sex, String(t.suf || '').trim()].filter(Boolean).join(' ');
}

export const sortedTeams = () => S.teams.slice().sort((a, b) =>
  (CATS.indexOf(a.cat) - CATS.indexOf(b.cat))
  || String(a.sex || '').localeCompare(String(b.sex || ''))
  || String(a.suf || '').localeCompare(String(b.suf || ''), 'fr', { numeric: true }));

// Équipe en cours de modification
export const tm = () => S.teams.find(z => z.id === ui.tid);

// Équipe du match en cours
export const matchTeam = () => S.teams.find(z => z.id === S.teamId);

const byNumThenName = (a, b) => cmpN({ n: a.num || '' }, { n: b.num || '' }) || String(a.name).localeCompare(String(b.name));

export function sortPlayers() {
  const t = tm();
  if (t) t.players.sort(byNumThenName);
}

// Prépare la composition d'un match pour l'équipe id.
export function selTeam(id) {
  const t = S.teams.find(z => z.id === id);
  if (!t) return;
  ui.P.teamId = id;
  ui.P.rows = t.players.map(p => ({ id: p.id, name: p.name, num: String(p.num || ''), in: true })).sort(byNumThenName);
}

// --- Matchs archivés ---

export const curG = () => (S.arch || []).find(m => String(m.id) === String(ui.gid));

export const inTeam = (m, t) => (m.teamId ? m.teamId === t.id : m.me === t.name);
