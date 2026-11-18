// Lecture d'un .zip dans le navigateur, sans bibliothèque : l'e-Marque exporte le résumé et la feuille
// de marque dans un seul .zip, qu'on peut ainsi choisir tel quel au lieu de le décompresser d'abord.
// Formats gérés : fichiers stockés tels quels (méthode 0) ou compressés « deflate » (méthode 8),
// décompressés par le navigateur (DecompressionStream). Pas de zip64 ni de chiffrement, inutiles ici.

const NO_DEFLATE = 'Ce navigateur ne sait pas ouvrir le .zip : décompresse-le d’abord, puis choisis les fichiers PDF.';
export const isZip = f => /\.zip$/i.test(f.name) || /zip/i.test(f.type || '');

async function inflate(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error(NO_DEFLATE);
  const out = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(out).arrayBuffer());
}

// Fichiers du .zip, en File, avec leur nom sans dossier. keep : filtre sur ce nom.
export async function unzip(file, keep = () => true) {
  const buf = new Uint8Array(await file.arrayBuffer()), v = new DataView(buf.buffer);
  // Fin du répertoire central : cherchée depuis la fin (elle peut être suivie d'un commentaire)
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (v.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('Ce fichier .zip est illisible.');
  const count = v.getUint16(end + 10, true);
  let p = v.getUint32(end + 16, true);
  const out = [];
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Ce fichier .zip est illisible.');
    const flags = v.getUint16(p + 8, true), method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
    const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const path = new TextDecoder(flags & 0x800 ? 'utf-8' : 'latin1').decode(buf.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    // Certains outils Windows écrivent les dossiers avec « \ » au lieu de « / »
    const name = path.split(/[\\/]/).pop();
    if (!name || /[\\/]$/.test(path) || /(^|[\\/])__MACOSX[\\/]/.test(path) || name.startsWith('._') || !keep(name)) continue;
    if (flags & 1) throw new Error('Ce fichier .zip est protégé par un mot de passe.');
    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true);
    const raw = buf.subarray(start, start + size);
    const data = method === 0 ? raw : method === 8 ? await inflate(raw) : null;
    if (!data) throw new Error('Ce fichier .zip utilise une compression inconnue : décompresse-le d’abord.');
    out.push(new File([data], name, { type: /\.pdf$/i.test(name) ? 'application/pdf' : '' }));
  }
  return out;
}

// Remplace chaque .zip de la liste par les PDF qu'il contient.
export async function expandZips(files) {
  const out = [];
  for (const f of files) {
    if (isZip(f)) out.push(...await unzip(f, n => /\.pdf$/i.test(n)));
    else out.push(f);
  }
  return out;
}
