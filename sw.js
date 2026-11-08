// Réseau d'abord : si tu as du réseau, tu as toujours la dernière version.
// Sans réseau (ou réseau très lent), l'appli s'ouvre avec la copie gardée en mémoire.
// Ce fichier n'a pas besoin d'être modifié à chaque mise à jour,
// sauf pour ajouter un nouveau fichier à FILES (indispensable pour le mode hors ligne).
const CACHE = 'stats-basket-2';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'css/style.css',
  'js/main.js', 'js/constants.js', 'js/util.js', 'js/state.js', 'js/model.js', 'js/dom.js',
  'js/awake.js', 'js/export.js', 'js/render.js', 'js/actions.js', 'js/share.js', 'js/cloud.js', 'js/cloud-config.js',
  'js/views/common.js', 'js/views/home.js', 'js/views/club.js', 'js/views/pick.js',
  'js/views/play.js', 'js/views/history.js', 'js/views/stats.js', 'js/views/archives.js',
  'js/views/composition.js', 'js/views/settings.js', 'js/views/import.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(FILES.map(u => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Autres sites : seul le SDK Firebase (gstatic) est gardé pour le hors ligne.
  // Les échanges avec Firebase (connexion, données) passent sans le service worker.
  const url = new URL(e.request.url);
  if (url.origin !== location.origin && url.hostname !== 'www.gstatic.com') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await Promise.race([
        fetch(e.request, { cache: 'no-cache' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      if (res && res.ok) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      // La page d'accueil sert de secours uniquement pour la navigation,
      // jamais à la place d'un fichier JS ou CSS manquant.
      const cached = (await cache.match(e.request, { ignoreSearch: true }))
        || (e.request.mode === 'navigate' ? await cache.match('./') : null);
      return cached || Response.error();
    }
  })());
});
