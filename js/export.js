// PDF, image des stats et sauvegarde.

import { S, ui, withMatch, migrate, setS, save } from './state.js';
import { WON } from './constants.js';
import { $, esc, qLabel } from './util.js';
import { periods, tally, cnt, curG, curTeamColor } from './model.js';
import { toast, ask, note } from './dom.js';
import { tables } from './views/common.js';
import { cloudResync } from './cloud.js';

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

// Tableau équipe : une ligne par stat, une colonne par période + total.
function evolution(ps) {
  const team = q => {
    const T = Object.values(tally(q));
    const s = k => T.reduce((a, r) => a + r[k], 0);
    return {
      stl: s('stl'), fd: s('fd'), to: s('to'), trav: s('trav'), miss: s('m1') + s('m2') + s('m3'),
      ro: cnt('ro', q), rd: cnt('rd', q), orb: cnt('orb', q), odr: cnt('odr', q),
      won: WON.reduce((a, w) => a + cnt(w[0], q), 0),
    };
  };
  const cols = [...ps, null].map(team);
  const lines = [
    ['Interceptions', 'stl'], ['Fautes provoquées', 'fd'], ['Balles perdues', 'to'], ['Marchers', 'trav'],
    ['Ratés', 'miss'], ['Reb. offensifs', 'ro'], ['Reb. défensifs', 'rd'], ['Ballons gagnés', 'won'],
    [`Reb. off. ${esc(S.opp)}`, 'orb'], [`Reb. déf. ${esc(S.opp)}`, 'odr'],
  ];
  return `<section class="evo"><h2>Évolution par quart-temps</h2><table>`
    + `<tr><th>${esc(S.me)}</th>${ps.map(q => `<th>${qLabel(q)}</th>`).join('')}<th>Total</th></tr>`
    + lines.map(([l, k]) => `<tr><td>${l}</td>${cols.map((c, i) => i === ps.length ? `<td><b>${c[k]}</b></td>` : `<td>${c[k]}</td>`).join('')}</tr>`).join('')
    + `</table></section>`;
}

export function pdf() {
  const sec = q => `<section><h2>${q == null ? 'Total du match' : qLabel(q)}</h2>${tables(q)}</section>`;
  const logo = S.clubLogo ? `<img class="plogo" src="${S.clubLogo}" alt="">` : '';
  const head = `<div class="phead">${logo}<div><h1>${esc(S.me)} contre ${esc(S.opp)}</h1>`
    + `<p class="date">${S.clubName ? esc(S.clubName) + ' · ' : ''}${new Date().toLocaleDateString('fr-FR')}</p></div></div>`;
  // Page 1 : total du match + évolution de l'équipe par période. Ensuite, 2 périodes par page.
  const ps = periods();
  const pages = [head + sec(null) + evolution(ps)];
  for (let i = 0; i < ps.length; i += 2) pages.push(ps.slice(i, i + 2).map(sec).join(''));
  $('#print').style.setProperty('--tc', curTeamColor());
  $('#print').innerHTML = pages.map(p => `<div class="pg">${p}</div>`).join('');
  window.print();
}

export function backup() {
  const txt = JSON.stringify({ app: 'stats-basket', version: 1, date: new Date().toISOString(), data: S });
  download('sauvegarde-pick-and-stats-' + new Date().toISOString().slice(0, 10) + '.json', txt, 'application/json');
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
      cloudResync();
      ui.sel = null;
      ui.view = 'home';
      toast('Sauvegarde restaurée');
    }, true);
  } catch (e) {
    note('Fichier de sauvegarde invalide.');
  }
  render();
}
