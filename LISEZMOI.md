# Le QG : l'appli de révisions reliée à Pronote

Le QG est une application web installable. Un robot GitHub lit Pronote toutes les 30 minutes, de 6h à 23h (lecture seule : il ne coche rien et n'envoie aucun message). Il met l'appli à jour et envoie les notifications.

## Comment ça marche

- **site/** : l'appli (coque publique, sans aucune donnée personnelle).
- **site/data/** : les données, toutes chiffrées (AES-256) avec le code secret `QG_KEY`. Sans ce code, elles sont illisibles, même si le dépôt est public.
- **sync/** : le robot. Il utilise la bibliothèque libre *pawnote*, une connexion par QR code Pronote, et ne garde aucun mot de passe.
- **tools/state.sh** : garde l'état chiffré du robot (jeton Pronote, abonnements) dans la branche `state`.
- **.github/workflows/qg.yml** : le planning du robot.

L'appli et le robot échangent des messages chiffrés via ntfy.sh : abonnement aux notifications, sauvegarde des progrès et demande de connexion par QR code.

## Installation (une seule fois, environ 15 minutes)

1. **Créer un compte gratuit sur github.com.**
2. **Créer le dépôt.** Cliquer sur « + », puis « New repository ».
   - Nom : `qg`.
   - Visibilité : **Public**. C'est obligatoire pour l'hébergement gratuit, et tout est chiffré.
   - Cocher « Add a README file », puis cliquer sur « Create repository ».
3. **Ajouter le code secret.** Aller dans Settings > Secrets and variables > Actions > « New repository secret ».
   - Name : `QG_KEY`.
   - Secret : le code de 43 caractères.
4. **Activer l'hébergement.** Aller dans Settings > Pages > Build and deployment > Source, et choisir **GitHub Actions**.
5. **Déposer l'appli.** Dans l'onglet Code, cliquer sur « Add file », puis « Upload files ». Glisser `qg-app.zip`, puis cliquer sur « Commit changes ».
6. **Créer le robot.** Cliquer sur « Add file », puis « Create new file ».
   - Nom du fichier : `.github/workflows/qg.yml`.
   - Coller le contenu du fichier `qg.yml` fourni, puis cliquer sur « Commit changes ».

   Le robot démarre tout seul : voir l'onglet Actions, environ 3 minutes.
7. **Ouvrir le QG.** L'adresse est `https://NOM-DU-COMPTE.github.io/qg/#k=CODE`.
8. **Relier Pronote.** Aller dans Réglages > « Connecter Pronote avec un QR code ».
   - Suivre les étapes : QR code Pronote, code à 4 chiffres, « Envoyer au robot ».
   - Cliquer ensuite sur « Lancer la synchro maintenant », puis sur « Run workflow ».
9. **Sur l'ordinateur de Lehna.**
   - Ouvrir le lien.
   - Réglages > « Installer le QG ».
   - Réglages > « Activer les notifications ».
10. **Sur l'ordinateur d'un parent.**
    - Ouvrir le « lien parent » (Réglages > Copier le lien parent).
    - Activer les notifications.

## Ensuite

- Tout est automatique. Si Pronote refuse un jour le jeton (mot de passe changé, longue coupure), le parent reçoit une notification et il suffit de refaire l'étape 8.
- Pour installer une nouvelle version de l'appli, déposer le nouveau `qg-app.zip` (étape 5). Le robot l'installe tout seul.
- Le bouton « Run workflow » de l'onglet Actions lance une synchro immédiate.
