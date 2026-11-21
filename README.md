# Repère — version web mobile

Suivi de dépenses et de budgets en **Ariary**, pensé pour le téléphone. React 19 + Vite 8 + Tailwind 4 + TypeScript.
Les données sont en **JSON dans le localStorage** du navigateur, avec **export et import** d'un fichier JSON.

```bash
npm install
npm run dev        # http://localhost:5173 — sur téléphone : http://<adresse-du-PC>:5173 (même Wi-Fi)
npm test           # 105 tests
npm run build      # produit dist/ (site statique)
npm run preview    # sert dist/ pour l'essayer comme en production
```

Pour essayer tout de suite : **Réglages → Importer (JSON) → Ajouter**, et choisir `examples/exemple-septembre-2026.json`
(les 176 transactions de septembre, issues de l'application de bureau).

## Les écrans (barre d'onglets en bas, au pouce)

| Onglet | Contenu |
|---|---|
| **Accueil** | Solde total ; **camembert des soldes restants par budget** (les catégories en déficit sont signalées à part) ; **courbes des entrées et sorties par jour avec filtre entre deux dates** (Du / Au + raccourcis 7 j, 30 j, Tout) |
| **Saisie** | Dépense ou dépôt (montant en gros, clavier numérique), catégorie, libellé, date ; liste du jour avec solde et suppression confirmée |
| **Budgets** | *Catégories* (ajouter, renommer, budget par jour, **solde de départ**, supprimer) · *Planifier* (suggestion = budget/jour × jours − solde, montant retenu ajustable, création des dépôts, garde-fou contre le doublon) · *Analyser* (moyenne, écart-type, niveaux serré / équilibré / confortable, graphique) |
| **Rapport** | Entre deux dates : soldes de début et de fin, dépôts, dépenses, net, part de chaque catégorie, plus grosses dépenses |
| **Réglages** | Solde initial, **portefeuilles** (banque, caisse… : créer, renommer, ouvrir, supprimer), **export / import JSON**, tout effacer |

## Les données

Tout reste **sur l'appareil** (clé `repere.workspace.v1` du localStorage). Aucun serveur, aucun compte.

### Format JSON (sauvegarde exportée = contenu du stockage)

```json
{
  "format": "repere",
  "version": 1,
  "exportedAt": "2026-10-05T08:00:00",
  "activeWalletId": "w1",
  "wallets": [
    {
      "id": "w1",
      "name": "Principal",
      "initialBalance": 16600,
      "categories": [{ "name": "bazar", "dailyBudget": 3700, "initialBalance": 20000 }],
      "transactions": [
        { "id": "t1", "date": "2026-09-01", "category": "bazar", "kind": "expense", "label": "tomates", "amount": 500 }
      ]
    }
  ]
}
```

- `kind` : `expense` (dépense) ou `deposit` (dépôt). `amount` : entier > 0, en Ariary. `date` : `AAAA-MM-JJ`.
- `initialBalance` d'une catégorie = son **solde de départ** (entier ≥ 0, facultatif : absent = 0). Il compte dans le solde de la catégorie et **s'ajoute**
  à `initialBalance` du portefeuille : solde de départ total = celui du portefeuille + celui de toutes ses catégories.
- **Lecture tolérante** (fichiers édités à la main ou produits par un autre outil) : identifiants manquants générés, catégories
  absentes de la liste ajoutées, catégories données comme simples textes, types `dépense` / `dépôt`, noms de portefeuilles en double renommés.
- **Lecture stricte** sur ce qui fausserait les comptes : date impossible (30 février), montant nul ou négatif, type inconnu, fichier d'une
  version plus récente. Le message dit où : *« Portefeuille « Principal », transaction n°2 : date invalide »*. **Un fichier refusé ne modifie rien.**
- **Importer** : *Ajouter* conserve vos portefeuilles (les noms en double deviennent « (2) ») ; *Remplacer* efface les données actuelles. Un aperçu s'affiche avant.

### Depuis l'application de bureau (Excel)

Dans le projet Python `suivi_hexagonal` : `python export_json.py` (ou `--sqlite`) crée un fichier à importer ici. Vérifié de bout en bout :
`src/application/fixtures.test.ts` relit l'export des 176 transactions et retrouve les mêmes soldes que l'application de bureau.

## Synchronisation avec un serveur distant

**Réglages → Données → Synchroniser avec un serveur** ouvre l'écran de synchronisation (pas d'onglet dédié). On s'y connecte en **scannant le QR code**
du serveur ou en **saisissant son adresse** (`http://192.168.1.20:8000/?token=zLhJ-QcsSdyX2bOC3o6SjA`), puis :
- **Envoyer mes données** : les données de l'appareil sont d'abord **vérifiées** (même contrôle strict que l'import), puis une fenêtre de **validation** résume ce qui va partir ; rien n'est envoyé sans confirmation, et un message « Opération réussie » s'affiche ensuite (et à l'accusé de réception du serveur) ;
- **Récupérer les données** (éventuellement *à partir du* une date) : le serveur répond, les données sont **validées** et résumées dans une fenêtre *Valider les données reçues*. Rien n'est enregistré dans le `localStorage` tant qu'on n'a pas choisi *Ajouter* ou *Remplacer*, puis un message « Opération réussie » détaille ce qui a été enregistré ;
- **Le serveur demande vos données** : même validation et même confirmation ; en cas de refus (ou de données invalides), le serveur reçoit un message d'erreur.

Protocole : WebSocket sur `ws(s)://<hôte>/ws?token=<jeton>` (le jeton est celui de l'adresse du QR code), messages JSON, identiques à ceux de `test_synchronisation.html` :

| Sens | Message |
|---|---|
| appareil → serveur | `{ "type": "data", "payload": <sauvegarde repere> }` (envoi, ou réponse à une demande du serveur) |
| appareil → serveur | `{ "type": "request" }` ou `{ "type": "request", "start": "AAAA-MM-JJ" }` (demande des données du serveur) |
| appareil → serveur | `{ "type": "error", "message": "…" }` (l'utilisateur refuse de répondre à une demande du serveur) |
| serveur → appareil | `{ "type": "data", "payload": <sauvegarde repere> }` (réponse à la demande, ou envoi spontané) |
| serveur → appareil | `{ "type": "request" }` (le serveur demande les données de l'appareil) |
| serveur → appareil | `{ "type": "ack", "message": "…" }` (accusé de réception d'un envoi) · `{ "type": "error", "message": "…" }` |

Limites : la caméra exige **HTTPS** (ou `localhost`) ; une page servie en **HTTPS** ne peut pas ouvrir une connexion `ws://` (contenu mixte) : utiliser `wss://`
ou ouvrir l'application depuis le serveur local en `http://`. « Opération réussie » après un envoi signifie que le message est parti ; la confirmation du serveur (`ack`) affiche un second message.
La bibliothèque de lecture de QR code (`html5-qrcode`) n'est chargée qu'à l'ouverture du scanner ; elle est mise en cache pour le mode hors ligne.

## Installer sur le téléphone et hors ligne

L'application est une **PWA** : `manifest.webmanifest`, icônes, service worker (`public/sw.js`).
- **Android (Chrome)** : menu ⋮ → *Installer l'application* / *Ajouter à l'écran d'accueil*.
- **iPhone (Safari)** : Partager → *Sur l'écran d'accueil*.
- Dès la première visite, elle fonctionne **sans connexion** : au build, `vite.config.ts` écrit dans `sw.js` la liste de tous les fichiers de `dist/`, mis en cache à l'installation. Chaque déploiement renouvelle ce cache. Le service worker exige **HTTPS** (sauf `localhost`).
- Déploiement : `npm run build`, puis copier `dist/` sur n'importe quel hébergement statique (GitHub Pages, Netlify, Render « static site »…).
  Les chemins sont relatifs (`base: './'`) : fonctionne à la racine comme dans un sous-dossier.

## À savoir (limites)

- **Les données ne se synchronisent pas** entre appareils : une sauvegarde JSON se transfère à la main. Exportez régulièrement.
- Elles sont **propres à un navigateur et à une adresse** : changer de navigateur ou de domaine donne un espace vide ; « effacer les données du site » les supprime.
- **iPhone** : Safari peut vider le stockage d'un site non installé resté 7 jours sans visite. Installer l'application sur l'écran d'accueil et exporter régulièrement.
- Le localStorage offre environ **5 Mo** (plusieurs dizaines de milliers de transactions). S'il est plein, l'application l'annonce et **ne perd rien** : elle refuse l'ajout.
- Si le stockage est inaccessible (navigation privée stricte), l'application reste utilisable **sans conserver les données** et l'indique en haut de l'écran.
- Pas de comptes ni de mot de passe : quiconque a accès au téléphone déverrouillé voit les données.

## Architecture (hexagonale, comme la version Python)

```
src/
  domain/        règles métier et calculs, TypeScript pur (ni React, ni navigateur, ni stockage)
    ledger.ts workspace.ts dates.ts period.ts model.ts   services/ balances dashboard reports budget spending
  application/   cas d'usage + ports
    workspaceService.ts   chaque commande : règle pure → enregistrement → notification ; échec = état inchangé
    ports.ts              WorkspaceRepository, Clock, IdGenerator, BackupFiles (les « prises »)
    backup.ts             format JSON : sérialisation et validation
  adapters/      branchent une technologie sur un port
    localStorageRepository.ts  memoryRepository.ts  browserFiles.ts  system.ts
  ui/            React + Tailwind (n'utilise que domaine et application)
  bootstrap.ts   racine de composition : le seul endroit qui assemble les adaptateurs
```

Règle : **les dépendances ne vont que vers l'intérieur** (ui, adapters → application → domain).
`src/architecture.test.ts` la vérifie automatiquement (vérifié en y glissant volontairement trois violations).

**Changer de stockage** (IndexedDB, API distante…) : écrire une classe qui implémente `WorkspaceRepository` et la brancher dans `bootstrap.ts`.
Ni les règles métier, ni les écrans, ni les tests de parcours ne changent.

## Les tests (105)

| Fichiers | Ce qu'ils vérifient |
|---|---|
| `domain/*.test.ts` | Règles et calculs : catégories, transactions, portefeuilles, soldes, tableau de bord, rapport, budget (exemple 7 × 500 − 1 000 = 2 500), analyse |
| `application/*.test.ts` | Service : enregistrer d'abord puis adopter, échec d'écriture sans perte, import/export, plusieurs onglets ; format JSON tolérant et strict ; pont avec l'export Python |
| `adapters/*.test.ts` | localStorage réel (jsdom) : données conservées entre deux lancements, données corrompues mises de côté, espace plein, autre onglet |
| `ui/App.test.tsx` | Parcours utilisateur dans la vraie interface : de la première catégorie au camembert, filtre de dates, planification, analyse, portefeuilles, import/export, erreurs |
| `ui/charts`, `ui/format`, `ui/periods` | Camembert, courbes, barres, formats français, périodes par défaut |
| `architecture.test.ts` | Règle de dépendance des couches |
