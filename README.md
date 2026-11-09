# Pick&Stats

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
js/export.js            PDF et sauvegarde
js/statimage.js         Image des stats à partager (dessinée sur un canvas)
js/cloud.js             Données partagées du club (Firebase), voir FIREBASE.md
js/cloud-config.js      Configuration Firebase du club (null = désactivé)
js/logo.js              Logo du club : réduction de l’image choisie
js/awake.js             Écran toujours allumé
js/emarque.js           Lecture du résumé PDF de l’e-Marque (le texte y est dessiné en formes, reconnues par modèles :
                        stats, noms des équipes et des joueurs, catégorie) et de la feuille de marque (score par quart-temps
                        d’après la couleur des numéros) ; sert aussi à créer une équipe depuis un résumé
js/emarque-glyphs.js    Modèles des chiffres, lettres et ponctuation de l’e-Marque (une lettre inconnue donne « ? »)
js/views/report.js      Rapport du match en 7 pages (dans l’appli et en fichier HTML à partager)
js/vendor/              pdf.js 3.11.174 (build « legacy »), chargé seulement à l’import d’une feuille ;
                        mis en cache hors ligne à la première utilisation (volontairement absent de FILES : 1,5 Mo)
js/views/*.js           Un fichier par écran
js/views/account.js     Compte et club : bandeau de l’accueil, fenêtre de connexion, page « Club et membres »
sw.js                   Service worker (mode hors ligne)
demo.html               Démo animée : la vraie appli (index.html?demo) pilotée toute seule, avec sous-titres.
                        En mode démo, l’appli utilise ses propres données (clé « bb-demo ») et jamais le club en ligne.
                        Les données inventées (club, équipes, un match avec sa feuille e-Marque) sont dans la page.
                        À ouvrir par une adresse web (serveur), pas en double-cliquant sur le fichier.
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
