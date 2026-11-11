# Données de test

`club-test.json` est une sauvegarde Pick&Stats complète, inventée, pour remplir un **club de test** :

- **4 équipes** : Sénior M 1, Sénior F 1, U15 M, U13 F, avec leurs joueurs et numéros ;
- **23 matchs** : 18 validés, 3 publiés « À valider » (par Julie), 2 sauvegardés « Non publié » ;
- **17 feuilles e-Marque** cohérentes (points, tirs, fautes, temps de jeu), donc 17 rapports complets ;
- des cas à tester : une prolongation, des joueurs sortis pour 5 fautes, des absents, un joueur invité
  (hors équipe), une feuille sans le détail par quart-temps, des matchs sans feuille.

Pour recréer le fichier (ou en obtenir un autre en changeant `SEED` dans le script) :

```
perl testdata/genere.pl
```

## Remplir le club de test

> ⚠️ « Restaurer une sauvegarde » **remplace toutes les données de l'appareil**, puis les envoie au club
> auquel tu es connecté. Fais-le dans une **fenêtre de navigation privée** (ou un autre navigateur),
> connecté au **club de test**, jamais à ton vrai club.

1. Fenêtre privée → l'appli → « Se connecter » → crée un compte de test → « Créer un club » (ex. « Club Test »).
2. Réglages → « Restaurer une sauvegarde » → `testdata/club-test.json` → Remplacer.
3. Les équipes et les matchs partent au club (sauf les 2 « Non publié », qui restent sur l'appareil).

## Ajouter des membres (console Firebase)

L'appli ne peut créer que son propre compte. Pour voir une liste de membres, ajoute des fiches à la main
dans Firestore › `clubs/<id du club de test>/members` › « Ajouter un document » :

| ID du document | `name` | `email` | `role` |
|---|---|---|---|
| `test-sophie` | Sophie | sophie@test.fr | `admin` |
| `test-karim` | Karim | karim@test.fr | `coach` |
| `test-julie` | Julie | julie@test.fr | `benevole` |
| `test-hugo` | Hugo | hugo@test.fr | `benevole` |

Tous les champs sont de type *string*. Les matchs « À valider » ont été publiés par `test-julie`.

Ces membres ne peuvent pas se connecter : ils servent à l'affichage, aux rôles et aux validations.
Pour tester **en tant que** bénévole ou coach, crée un vrai compte de test (autre navigateur), rejoins le
club avec le code d'invitation, puis change son rôle depuis ton compte responsable.

## Tout effacer

- Firestore : supprime `clubs/<id du club de test>` (avec ses sous-collections), son code dans `invites`
  (filtre `clubId` == id du club) et les fiches `users` qui pointent vers ce club (même filtre).
- Authentication : supprime les comptes de test.
- Sur l'appareil : « Se déconnecter » retire les données du club ; ferme la fenêtre privée.
