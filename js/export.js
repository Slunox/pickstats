// Fichiers : téléchargement, partage et sauvegarde.

import { S, ui, migrate, setS, save } from './state.js';
import { toast, ask, note } from './dom.js';
import { cloudResync } from './cloud.js';

export function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Partage un fichier par la feuille de partage du système, sinon le télécharge.
// À appeler sans attente, dans le geste de l'utilisateur : Safari refuse navigator.share sinon.
export function shareFile(name, content, type, title) {
  const file = new File([content], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title }).catch(() => {});
    return;
  }
  download(name, content, type);
  toast('Fichier enregistré');
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
