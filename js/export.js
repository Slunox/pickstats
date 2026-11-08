// Partage, copie, PDF, CSV et sauvegarde.

import { S, ui, withMatch, migrate, setS, save } from './state.js';
import { WON, PK } from './constants.js';
import { $, esc, qLabel } from './util.js';
import { periods, tally, cnt, miss, curG } from './model.js';
import { toast, ask, note } from './dom.js';
import { tables } from './views/common.js';

// Sur la fiche d'un match archivé, les exports portent sur ce match.
export const inCtx = f => (ui.view === 'game' ? withMatch(curG(), f) : f());

function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function summary() {
  const sec = q => {
    const T = Object.values(tally(q));
    const s = k => T.reduce((a, r) => a + r[k], 0);
    const lines = T.filter(r => PK.some(k => r[k] > 0)).map(r =>
      `#${r.n}${r.name ? ' ' + r.name : ''} : Int ${r.stl}, Faute prov. ${r.fd}, Perdues ${r.to}, Marchers ${r.trav}, Ratés ${miss(r)} (2 pts ${r.m2}, 3 pts ${r.m3}, LF ${r.m1})`);
    const w = WON.map(x => x[1] + ' ' + cnt(x[0], q)).join(', ');
    return `*${q == null ? 'Total du match' : qLabel(q)}*\n`
      + `Équipe : Reb off. ${cnt('ro', q)}, Reb déf. ${cnt('rd', q)}, Int ${s('stl')}, Fautes prov. ${s('fd')}, Perdues ${s('to')}, Marchers ${s('trav')}, Ratés ${s('m1') + s('m2') + s('m3')}\n`
      + `Ballons gagnés : ${w}\n`
      + `${S.opp} : Reb off. ${cnt('orb', q)}, Reb déf. ${cnt('odr', q)}`
      + (lines.length ? '\n' + lines.join('\n') : '');
  };
  const ps = periods().filter(p => S.ev.some(e => e.q === p));
  return `*${S.me} contre ${S.opp}* (${new Date().toLocaleDateString('fr-FR')})\n\n` + [null, ...ps].map(sec).join('\n\n');
}

export async function share() {
  const text = summary();
  if (navigator.share) {
    try { await navigator.share({ title: S.me + ' contre ' + S.opp, text }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  location.href = 'whatsapp://send?text=' + encodeURIComponent(text);
}

export async function copyText() {
  const text = summary();
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
  toast('Texte copié : colle-le dans ta conversation');
}

export function pdf() {
  const sec = q => `<section><h2>${q == null ? 'Total du match' : qLabel(q)}</h2>${tables(q)}</section>`;
  $('#print').innerHTML = `<h1>${esc(S.me)} contre ${esc(S.opp)}</h1>`
    + `<p class="date">${S.clubName ? esc(S.clubName) + ' · ' : ''}${new Date().toLocaleDateString('fr-FR')}</p>`
    + [null, ...periods()].map(sec).join('');
  window.print();
}

export function csv() {
  const rows = [['Match', 'Période', 'N°', 'Nom', 'Reb. off.', 'Reb. déf.', 'Interceptions', 'Fautes provoquées', 'Balles perdues', 'Marchers', 'Ratés total', 'Ratés 2 pts', 'Ratés 3 pts', 'Ratés LF', 'Ballons gagnés 5 s', 'Ballons gagnés 8 s', 'Ballons gagnés 24 s', 'Ballons récupérés', 'Reb. off. adverses', 'Reb. déf. adverses']];
  const m = S.me + ' - ' + S.opp;
  [null, ...periods()].forEach(q => {
    const T = Object.values(tally(q));
    const pl = q == null ? 'Total' : qLabel(q);
    // Les rebonds sont comptés pour l'équipe seulement (colonnes vides pour les joueurs).
    T.forEach(r => rows.push([m, pl, r.n, r.name, '', '', r.stl, r.fd, r.to, r.trav, miss(r), r.m2, r.m3, r.m1, '', '', '', '', '', '']));
    const s = k => T.reduce((a, r) => a + r[k], 0);
    rows.push([m, pl, '', 'ÉQUIPE', cnt('ro', q), cnt('rd', q), s('stl'), s('fd'), s('to'), s('trav'), s('m1') + s('m2') + s('m3'), s('m2'), s('m3'), s('m1'), ...WON.map(w => cnt(w[0], q)), cnt('orb', q), cnt('odr', q)]);
  });
  const txt = '\uFEFF' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
  download('stats-basket-' + S.opp.replace(/[^\w-]+/g, '_') + '.csv', txt, 'text/csv;charset=utf-8');
}

export function backup() {
  const txt = JSON.stringify({ app: 'stats-basket', version: 1, date: new Date().toISOString(), data: S });
  download('sauvegarde-stats-basket-' + new Date().toISOString().slice(0, 10) + '.json', txt, 'application/json');
}

// render est passé en paramètre : la restauration se termine après la lecture du fichier.
export async function restoreFile(f, render) {
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    const x = d && d.app === 'stats-basket' ? d.data : null;
    if (!x || !Array.isArray(x.ev) || !Array.isArray(x.roster)) throw 0;
    ask('Remplacer toutes les données actuelles (match en cours et archives) par cette sauvegarde ?', 'Remplacer', () => {
      setS(migrate({ ...x }));
      save();
      ui.sel = null;
      ui.view = 'home';
      toast('Sauvegarde restaurée');
    }, true);
  } catch (e) {
    note('Fichier de sauvegarde invalide.');
  }
  render();
}
