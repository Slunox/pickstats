# Stats Basket

Appli web (PWA) pour saisir les statistiques d'un match de basket sur tablette.
En ligne : https://slunox.github.io/stats-basket/

## Organisation du code

```
index.html              Structure de la page
css/style.css           Styles
js/main.js              Point d'entrée
js/constants.js         Libellés, actions, catégories, version
js/util.js              Petites fonctions sans dépendance
js/state.js             Données enregistrées (S) et état de l'écran (ui)
js/model.js             Calculs : effectif, stats, équipes
js/dom.js               Notifications et fenêtre de confirmation
js/actions.js           Réactions aux clics et à la saisie
js/render.js            Choix et affichage de l'écran courant
js/export.js            Partage, PDF, CSV, sauvegarde
js/cloud.js             Données partagées du club (Firebase), voir FIREBASE.md
js/cloud-config.js      Configuration Firebase du club (null = désactivé)
js/awake.js             Écran toujours allumé
js/views/*.js           Un fichier par écran
sw.js                   Service worker (mode hors ligne)
```

## Ajouter un fichier

Tout nouveau fichier JS ou CSS doit être ajouté à la liste `FILES` de `sw.js`,
sinon il ne sera pas disponible hors ligne. Toujours utiliser des chemins relatifs
(`./js/...`), car l'appli est servie depuis le sous-dossier `/stats-basket/`.

## Tester en local

Les modules JavaScript ne fonctionnent pas en ouvrant `index.html` directement.
Lancer un petit serveur dans le dossier du projet, puis ouvrir http://localhost:8000 :

```
python -m http.server 8000
```

ou `npx serve`, ou l'extension Live Server de VS Code.
