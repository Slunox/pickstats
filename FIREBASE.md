# Comptes et clubs (Firebase)

Avec Firebase, chacun peut créer son compte dans l'appli, puis :
- **créer un club** : il en devient le **responsable** et obtient un **code d'invitation** ;
- ou **rejoindre un club** avec le code que lui donne un responsable : il arrive **bénévole**,
  et le responsable le passe **coach** ou **responsable** si besoin.

| Rôle | Peut faire |
|---|---|
| Responsable | tout, plus le code d'invitation, le logo et les membres |
| Coach | modifier les équipes, les joueurs, les matchs archivés et le nom du club |
| Bénévole | saisir les stats, archiver des matchs, consulter les équipes et les matchs |

Ces limites sont imposées par les règles Firestore, pas seulement par l'appli.

Les **équipes**, leur **composition**, les **matchs archivés** et le nom du club sont partagés
entre les membres du club, sur chaque tablette ou téléphone. Un membre ne voit **que son club**.
Le match en cours reste sur l'appareil qui le saisit et est partagé au moment de son archivage.

Sans compte, l'appli fonctionne comme avant, uniquement sur l'appareil.

Firebase est gratuit pour cet usage (offre « Spark », sans carte bancaire).

## 1. Créer le projet (une seule fois)

1. Va sur https://console.firebase.google.com et connecte-toi avec un compte Google.
2. **Créer un projet**. Google Analytics n'est pas utile : tu peux le désactiver.
3. **Ajouter une appli Web** : sur la page d'accueil du projet, touche l'icône `</>`.
   Donne un surnom, ne coche pas « Firebase Hosting », puis valide.
4. Copie le bloc `firebaseConfig` dans `js/cloud-config.js` (à la place de `null`).
   Ces valeurs ne sont pas secrètes : elles peuvent être publiées sur GitHub.
   La protection vient des comptes et des règles (étape 3).

## 2. Activer les comptes

1. Menu **Authentication** → **Commencer**.
2. Onglet **Sign-in method** : active **E-mail/Mot de passe** (pas le « lien par e-mail »).
3. Onglet **Settings** → **Actions des utilisateurs** : laisse **Activer la création (inscription)**
   cochée, pour que chacun puisse créer son compte depuis l'appli.

## 3. Créer la base de données et la protéger

1. Menu **Firestore Database** → **Créer une base de données**.
   Emplacement : `eur3 (europe-west)` ; mode : **production**.
2. Onglet **Règles** : remplace tout le contenu par celui du fichier `firestore.rules`
   de ce dossier, puis touche **Publier**.
   À refaire à chaque fois que `firestore.rules` change.

## 4. Publier et créer ton club

1. Envoie les modifications sur GitHub (l'appli en ligne se met à jour en 1 à 2 minutes).
2. Dans l'appli : sur l'accueil, touche **Se connecter** → **Créer un compte** (pseudo, e-mail, mot de passe).
   Le pseudo est ce que voient les autres membres et ce qui apparaît sur les matchs archivés ; l'e-mail reste privé.
3. **Créer un club** : la tablette propose d'y ajouter les équipes et matchs qu'elle contient déjà.
   Fais-le d'abord sur la tablette qui a le plus de données.
4. Le **code d'invitation** s'affiche dans **Club et membres** (bouton « Envoyer le code ») : donne-le aux autres coachs.
   Ils créent leur compte, saisissent le code dans « Rejoindre un club » et arrivent bénévoles.
   Passe coach ceux qui doivent gérer les équipes (Club et membres → liste des membres).

## Gérer le club (responsable)

Sur l'accueil, bouton **Club et membres** :
- **Nouveau code** : l'ancien code ne permet plus de rejoindre le club (les membres actuels restent).
  Utile si le code a circulé trop largement.
- **Membres** : choisir le rôle de chacun (responsable, coach, bénévole), ou retirer un membre.
  Un membre retiré n'a plus accès aux données en ligne du club.
- Le club garde toujours au moins un responsable.

## Bon à savoir

- **Sans réseau au gymnase** : tout continue de fonctionner. Les modifications partent
  quand le réseau revient (la carte indique « Hors ligne »).
- **Même élément modifié sur deux appareils en même temps** : la dernière version reçue l'emporte.
- **Équipes en double** : si deux tablettes avaient créé chacune leur « U15 F » avant de rejoindre le club,
  les deux apparaîtront. Supprime celle qui est en trop (ses matchs archivés sont conservés).
- **Se déconnecter** ne supprime rien sur l'appareil.
- **Changer de club sur une tablette** (autre compte, ou après avoir quitté un club) : les équipes et matchs
  de l'ancien club sont retirés de la tablette avant d'afficher ceux du nouveau (ils restent en ligne dans l'ancien club).
- **Restaurer une sauvegarde** quand on est connecté : les équipes et matchs de la sauvegarde
  sont envoyés au club ; ceux qui n'y sont pas restent en ligne et reviennent sur l'appareil.
