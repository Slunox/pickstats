// Logo du club : l'image choisie est réduite (carré de 192 px) et gardée en texte (data URL),
// pour tenir dans les données de l'appli et dans le document du club en ligne.

const SIZE = 192;

export async function logoFromFile(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('not-image');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = url;
    });
    // L'image entière tient dans le carré (pas de rognage), centrée sur fond transparent.
    const k = SIZE / Math.max(img.naturalWidth, img.naturalHeight);
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    c.getContext('2d').drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
    const webp = c.toDataURL('image/webp', 0.85);
    return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
