// Petites fonctions sans dépendance.

export const $ = sel => document.querySelector(sel);

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const uid = () => Math.random().toString(36).slice(2, 9);

export const plural = (n, w) => n + ' ' + w + (n > 1 ? 's' : '');

export const qLabel = q => (q <= 4 ? 'Q' + q : 'Prol. ' + (q - 4));

export const fdate = m => new Date(m.date).toLocaleDateString('fr-FR');

// Tri par numéro de maillot : numériques d'abord, puis texte, vides à la fin.
export function cmpN(a, b) {
  const x = String(a.n).trim(), y = String(b.n).trim();
  if (!x && !y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  const nx = Number(x), ny = Number(y), fx = !isNaN(nx), fy = !isNaN(ny);
  if (fx && fy && nx !== ny) return nx - ny;
  if (fx && !fy) return -1;
  if (!fx && fy) return 1;
  return x < y ? -1 : x > y ? 1 : 0;
}
