// Réception d'un match envoyé depuis un autre appareil.

import { ui } from '../state.js';
import { esc, plural, fdate } from '../util.js';
import { teamFor, importStatus, existing } from '../share.js';
import { back } from './common.js';

function preview(m) {
  const t = teamFor(m), st = importStatus(m);
  const where = t
    ? `Il sera classé dans l’équipe <b>${esc(t.name)}</b>.`
    : `Aucune de tes équipes ne s’appelle « ${esc(m.me)} » : il sera classé dans « Autres ».`;
  const action = st === 'same'
    ? '<p class="help">Ce match est déjà dans tes matchs archivés.</p><button class="btn go2" data-x="impview">Voir le match</button>'
    : st === 'diff'
      ? `<p class="help">Tu as déjà une autre version de ce match (${plural(existing(m).ev.length, 'action')}). Celle-ci va la remplacer.</p><button class="btn go2" data-x="impadd">Remplacer par cette version</button>`
      : '<button class="btn go2" data-x="impadd">Ajouter à mes matchs archivés</button>';

  return back('Matchs archivés', 'impcancel') + `
  <div class="card">
    <h2>Match reçu</h2>
    <div class="grow"><div>
      <b>${esc(m.me)} contre ${esc(m.opp)}</b>
      <span>${fdate(m)} · ${plural(m.ev.length, 'action')} · ${plural(m.roster.length, 'joueur')}</span>
    </div></div>
    <p class="help">${where}</p>
    ${action}
  </div>`;
}

function pasteForm() {
  return back('Matchs archivés', 'impcancel') + `
  <div class="card imp">
    <h2>Importer un match</h2>
    <label>Lien reçu</label>
    <textarea data-imp="1" placeholder="Colle ici le lien reçu (…/stats-basket/#m=…)" aria-label="Lien reçu">${esc(ui.impText || '')}</textarea>
    <p class="adderr" id="imperr">${esc(ui.impErr || '')}</p>
    <button class="btn go2" data-x="impgo">Importer</button>
    <h3>Ou à partir d’un fichier reçu</h3>
    <button class="btn" data-x="impfile">Choisir un fichier</button>
    <input type="file" id="impfile" accept=".json,application/json" hidden>
    <p class="help">Sur iPad et iPhone, un lien touché dans WhatsApp s’ouvre dans Safari et pas dans l’appli installée sur l’écran d’accueil. Dans ce cas, fais un appui long sur le lien, copie-le, puis colle-le ici.</p>
  </div>`;
}

export const importView = () => (ui.imp ? preview(ui.imp) : pasteForm());
