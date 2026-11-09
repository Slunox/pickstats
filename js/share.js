// Envoi d'un match à un autre appareil, par lien ou par fichier.
//
// Le match est encodé dans l'adresse après « #m= » : rien ne passe par un serveur
// (le navigateur n'envoie jamais ce qui suit le # à GitHub).
//
// Format (JSON puis base64url) :
//   { v: 1, i: id, d: date, me, op: adversaire, q: dernière période,
//     r: [[numéro, nom], …],   // joueurs
//     e: "…" }                 // actions, 3 caractères chacune :
//                              //   code de l'action, période, joueur
//                              //   (indice dans r, « y » = équipe, « z » = adversaire)
// Si le match a plus de 34 joueurs ou de 35 périodes, les actions sont dans
// E: [[action, période, joueur], …] à la place de e.

import { S, ui, save } from './state.js';
import { $, esc } from './util.js';
import { roster, curG } from './model.js';
import { toast } from './dom.js';

// Ordre FIGÉ : les liens déjà envoyés en dépendent. Ajouter à la fin uniquement.
const CODES = ['ro', 'rd', 'stl', 'fd', 'to', 'trav', 'm1', 'm2', 'm3', 'w5', 'w8', 'w24', 'wr', 'orb', 'odr'];
const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';

function toB64(s) {
  let t = '';
  new TextEncoder().encode(s).forEach(c => { t += String.fromCharCode(c); });
  return btoa(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
}

export function encodeMatch(m) {
  const r = [], idx = {};
  const add = (n, name) => { if (idx[n] === undefined) { idx[n] = r.length; r.push([n, name || '']); } };
  (m.roster || []).forEach(p => add(String(p.n).trim(), p.name));
  m.ev.forEach(e => { if (e.p && e.p !== '__team') add(e.p, ''); });

  const ev = m.ev.filter(e => CODES.includes(e.a)).map(e => [
    CODES.indexOf(e.a), e.q, e.p === undefined ? 'z' : e.p === '__team' ? 'y' : idx[e.p],
  ]);
  const o = { v: 1, i: m.id, d: m.date, me: m.me, op: m.opp, q: m.q, r };
  if (m.by) o.b = m.by;
  if (m.oppColor) o.oc = m.oppColor;
  if (r.length <= 34 && ev.every(x => x[1] < 36)) {
    o.e = ev.map(x => B36[x[0]] + B36[x[1]] + (typeof x[2] === 'number' ? B36[x[2]] : x[2])).join('');
  } else {
    o.E = ev;
  }
  return toB64(JSON.stringify(o));
}

// Renvoie le match décodé, ou null si le code est invalide.
export function decodeMatch(code) {
  try {
    const o = JSON.parse(fromB64(code));
    if (!o || o.v !== 1 || !Array.isArray(o.r)) return null;
    const str = (v, max) => String(v == null ? '' : v).slice(0, max);
    const rr = o.r.map(x => (Array.isArray(x) ? { n: str(x[0], 3).trim(), name: str(x[1], 40).trim(), in: true } : { n: '' }));

    let raw;
    if (typeof o.e === 'string') {
      if (o.e.length % 3) return null;
      raw = [];
      for (let i = 0; i < o.e.length; i += 3) {
        const p = o.e[i + 2];
        raw.push([B36.indexOf(o.e[i]), B36.indexOf(o.e[i + 1]), p === 'y' || p === 'z' ? p : B36.indexOf(p)]);
      }
    } else if (Array.isArray(o.E)) raw = o.E;
    else return null;

    const ev = [];
    for (const x of raw) {
      if (!Array.isArray(x)) return null;
      const [a, q, p] = x, code = CODES[a];
      if (!code || !Number.isInteger(q) || q < 1) return null;
      const e = { a: code, q };
      if (p === 'y') e.p = '__team';
      else if (p !== 'z') {
        const pl = rr[p];
        if (!pl || !pl.n) return null;
        e.p = pl.n;
      }
      ev.push(e);
    }

    const date = !isNaN(Date.parse(o.d)) ? o.d : new Date().toISOString();
    const id = (typeof o.i === 'number' && isFinite(o.i)) || (typeof o.i === 'string' && o.i) ? o.i : Date.now();
    return {
      id, date,
      me: str(o.me, 40) || 'Équipe',
      opp: str(o.op, 40) || 'Adversaire',
      q: Math.max(1, Number.isInteger(o.q) ? o.q : 1, ...ev.map(e => e.q)),
      ev,
      roster: rr.filter(p => p.n),
      ...(o.b ? { by: str(o.b, 20) } : {}),
      ...(/^#[0-9a-f]{6}$/i.test(o.oc || '') ? { oppColor: o.oc } : {}),
    };
  } catch (e) {
    return null;
  }
}

// Retrouve le code d'un match dans un texte collé (lien complet ou code seul).
export function extractCode(txt) {
  const t = String(txt || '').trim();
  const m = t.match(/[#&?]m=([A-Za-z0-9_-]+)/) || t.match(/^([A-Za-z0-9_-]{10,})$/);
  return m ? m[1] : null;
}

// Match à envoyer : le match archivé affiché, sinon le match en cours.
function matchToSend() {
  if (ui.view === 'game') return curG();
  if (!S.matchId) { S.matchId = Date.now() * 1000 + Math.floor(Math.random() * 1000); save(); }
  return { id: S.matchId, date: new Date().toISOString(), me: S.me, opp: S.opp, oppColor: S.oppColor || null, q: S.q, ev: S.ev, roster: roster() };
}

const linkFor = m => location.origin + location.pathname + '#m=' + encodeMatch(m);

async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
  toast('Lien copié : colle-le dans ta conversation');
}

// Le partage est lancé sans attente pour rester dans le geste de l'utilisateur
// (Safari refuse navigator.share sinon).
export function sendLink() {
  const m = matchToSend();
  if (!m) return;
  const url = linkFor(m), title = m.me + ' contre ' + m.opp;
  if (navigator.share) {
    navigator.share({ title, text: 'Match ' + title + ' à ajouter dans Pick&Stats :', url })
      .catch(e => { if (!e || e.name !== 'AbortError') copy(url); });
  } else copy(url);
}

export function sendFile() {
  const m = matchToSend();
  if (!m) return;
  const name = ('match-' + m.me + '-' + m.opp).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_') + '.json';
  const json = JSON.stringify({ app: 'stats-basket', kind: 'match', v: 1, code: encodeMatch(m) });
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: m.me + ' contre ' + m.opp }).catch(() => {});
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Lit un fichier de match reçu.
export async function readMatchFile(f) {
  try {
    const d = JSON.parse(await f.text());
    return d && d.app === 'stats-basket' && d.kind === 'match' ? decodeMatch(d.code) : null;
  } catch (e) {
    return null;
  }
}

// --- Ajout aux matchs archivés ---

export const teamFor = m => S.teams.find(t => t.name === m.me);

export const existing = m => S.arch.find(a => String(a.id) === String(m.id));

// 'new' : pas encore reçu, 'same' : déjà identique, 'diff' : une autre version existe.
export function importStatus(m) {
  const ex = existing(m);
  if (!ex) return 'new';
  const same = ex.me === m.me && ex.opp === m.opp && JSON.stringify(ex.ev) === JSON.stringify(m.ev);
  return same ? 'same' : 'diff';
}

export function addImported(m) {
  const t = teamFor(m);
  const entry = { id: m.id, date: m.date, me: m.me, opp: m.opp, teamId: t ? t.id : null, q: m.q, ev: m.ev, roster: m.roster, ...(m.by ? { by: m.by } : {}), ...(m.oppColor ? { oppColor: m.oppColor } : {}) };
  const i = S.arch.findIndex(a => String(a.id) === String(m.id));
  if (i >= 0) S.arch[i] = entry; else S.arch.push(entry);
  save();
}

// Ouverture de l'appli par un lien de match : on le prépare pour l'écran d'import.
export function takeHash() {
  if (!location.hash.startsWith('#m=')) return false;
  const m = decodeMatch(location.hash.slice(3));
  history.replaceState(null, '', location.pathname + location.search);
  ui.imp = m;
  ui.impErr = m ? '' : 'Ce lien n’est pas un match Pick&Stats valide.';
  ui.impText = '';
  ui.view = 'import';
  return true;
}
