// Réseau d'abord : si tu as du réseau, tu as toujours la dernière version.
// Sans réseau (ou réseau très lent), l'appli s'ouvre avec la copie gardée en mémoire.
// Exception, la démo animée : cache d'abord, pour qu'elle se déroule sans à-coups (voir fromDemo).
// Une modification de l'appli n'y apparaît donc qu'à la lecture suivante ; pour la voir tout de
// suite, ouvrir l'appli une fois (elle, reste en réseau d'abord) ou changer CACHE ci-dessous.
// Ce fichier n'a pas besoin d'être modifié à chaque mise à jour,
// sauf pour ajouter un nouveau fichier à FILES (indispensable pour le mode hors ligne).
const CACHE = 'pickstats-3';
const FILES = [
  './', 'index.html', 'demo.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'css/style.css',
  'js/main.js', 'js/constants.js', 'js/util.js', 'js/state.js', 'js/model.js', 'js/dom.js',
  'js/awake.js', 'js/export.js', 'js/render.js', 'js/actions.js', 'js/share.js', 'js/cloud.js', 'js/cloud-config.js', 'js/logo.js', 'js/statimage.js',
  'js/views/common.js', 'js/views/home.js', 'js/views/club.js', 'js/views/pick.js',
  'js/views/play.js', 'js/views/history.js', 'js/views/stats.js', 'js/views/archives.js',
  'js/emarque.js', 'js/emarque-glyphs.js', 'js/views/emarque.js', 'js/views/emstats.js', 'js/views/report.js', 'js/views/emsheet.js',
  'js/views/composition.js', 'js/views/settings.js', 'js/views/import.js', 'js/views/account.js', 'js/views/icons.js',
  // Lecture des PDF de l'e-Marque : pour pouvoir importer une feuille même sans réseau
  'js/vendor/pdf.min.js', 'js/vendor/pdf.worker.min.js',
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

// Garde la réponse, sauf si l'adresse a des paramètres : les lectures se font avec ignoreSearch,
// et la démo recharge l'appli avec un « ?t= » différent à chaque chapitre — on accumulerait
// sinon une copie de index.html par chapitre lu.
function keep(cache, req, res) {
  if (res && res.ok && !new URL(req.url).search) cache.put(req, res.clone());
}

// La démo pilote l'appli dans un cadre (index.html?demo) qu'elle recharge à chaque chapitre.
// Ces fichiers-là sont servis depuis le cache sans attendre le réseau : sinon chaque changement
// de chapitre attend le réseau, et le film est haché. La page de la démo (demo.html) reste en
// réseau d'abord : c'est le scénario, c'est lui qu'on change le plus souvent.
// L'appel vient de la démo si son adresse porte « ?demo », ou si la page qui le demande le porte.
const isDemo = u => { try { return /[?&]demo(=|&|$)/.test(new URL(u).search); } catch (err) { return false; } };
async function fromDemo(e) {
  if (isDemo(e.request.url) || isDemo(e.request.referrer)) return true;
  if (!e.clientId) return false;
  const c = await self.clients.get(e.clientId);
  return !!c && isDemo(c.url);
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Autres sites : seul le SDK Firebase (gstatic) est gardé pour le hors ligne.
  // Les échanges avec Firebase (connexion, données) passent sans le service worker.
  const url = new URL(e.request.url);
  if (url.origin !== location.origin && url.hostname !== 'www.gstatic.com') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (await fromDemo(e)) {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      if (hit) {
        // La copie est rafraîchie en arrière-plan, sans retarder la démo : la lecture
        // suivante aura la dernière version.
        if (!url.search) {
          const bg = fetch(e.request, { cache: 'no-cache' }).then(r => keep(cache, e.request, r)).catch(() => {});
          try { e.waitUntil(bg); } catch (err) {}
        }
        return hit;
      }
    }
    try {
      const res = await Promise.race([
        fetch(e.request, { cache: 'no-cache' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      keep(cache, e.request, res);
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
