# Entre Nous — notre newsletter privée

Site statique : aucune compilation, aucun `npm install`.
Tu déposes le dossier, c'est en ligne.

Une page par écran : chacune a son fichier HTML et son fichier JS.
Tous les fichiers sont au même niveau, aucun sous-dossier.

---

## Étape 1 — Préparer la base (Supabase, 5 min)

1. Sur [supabase.com](https://supabase.com), ouvre ton projet (ou crée-en un —
   région **Europe (Frankfurt)** pour que ce soit rapide depuis la France).
2. Menu de gauche → **SQL Editor** → **New query**.
3. Ouvre le fichier `schema.sql`, copie **tout** son contenu, colle-le, clique **Run**.
   Tu dois voir `Success. No rows returned`.
   Puis fais la même chose avec `migration-02.sql` (fiche profil,
   co-administratrices), et enfin avec `migration-03.sql` (questions
   posées entre copines, réactions, fêtes célébrées). Les trois fichiers
   sont relançables autant de fois que tu veux, dans cet ordre.
4. Menu de gauche → **Authentication** → **Sign In / Providers** :
   vérifie que **Email** est activé, et que *Confirm email* est activé.
5. Toujours dans Authentication → **URL Configuration** → **Site URL** :
   mets l'adresse de ton site une fois déployé (étape 3), par exemple
   `https://entre-nous.vercel.app`. Ajoute-la aussi dans **Redirect URLs**.
   Pour tester en local, ajoute `http://localhost:8000`.

## Étape 2 — Brancher le site sur ta base

1. Dans Supabase : **Project Settings** → **Data API**.
2. Copie **Project URL** et la clé **anon public**.
3. Ouvre `config.js` et remplace les deux valeurs du haut.
   C'est le seul fichier à modifier, et il sert à toutes les pages.

La clé `anon` est publique par conception — elle peut rester dans le code.
C'est le fichier `schema.sql` (les règles RLS) qui protège les données :
personne ne peut lire un groupe dont elle n'est pas membre.

## Étape 3 — Mettre en ligne (Vercel, 2 min)

**Le plus simple :**
1. Va sur [vercel.com/new](https://vercel.com/new), crée un compte (gratuit, sans carte).
2. Glisse-dépose le dossier `entre-nous` entier (tous les fichiers ensemble) sur la page.
3. Vercel te rend une adresse du type `entre-nous.vercel.app`. C'est en ligne.

**Si tu préfères passer par GitHub** (plus pratique pour les mises à jour) :
pousse le dossier dans un dépôt, puis « Import Project » sur Vercel.
Chaque modification envoyée sur GitHub se met en ligne toute seule.

⚠️ N'oublie pas de revenir à l'étape 1.5 coller l'adresse finale dans
**Site URL** et **Redirect URLs** de Supabase, sinon les liens de
connexion renverront au mauvais endroit.

## Étape 4 — Le premier mois

1. Connecte-toi avec ton adresse.
2. Crée un groupe (un par bande de copines).
3. Invite chaque copine : prénom + e-mail. Elle n'a rien à créer.
4. Ouvre l'édition du mois.
5. Envoie le lien du site à tes copines.
6. Le 1er du mois suivant, clique sur **Publier** : tout le monde peut lire.

---

## Comment ça marche

Une page = un fichier HTML + un fichier JS. Une seule feuille de style
pour tout le site.

| Page | Son HTML | Son JS | Ce qu'elle fait |
|---|---|---|---|
| Connexion | `index.html` | `index.js` | Le lien magique par e-mail |
| Mes groupes | `groupes.html` | `groupes.js` | Deux onglets (je gère / je participe), et la création d'un groupe |
| Mon profil | `profil.html` | `profil.js` | Prénom, photo, anniversaire, ville, bio |
| Un groupe | `groupe.html?id=…` | `groupe.js` | Les numéros, les copines, l'administration |
| Répondre | `repondre.html?id=…` | `repondre.js` | Le formulaire du mois |
| Le magazine | `edition.html?id=…` | `edition.js` | Le numéro publié, et le PDF |

Partagé par toutes les pages :

| Fichier | Rôle |
|---|---|
| `style.css` | **La seule feuille de style**, reprise des couleurs du logo |
| `config.js` | **Le seul fichier à modifier** : clés, nom, rubriques |
| `db.js` | Les échanges avec Supabase, et le garde-fou de connexion |
| `ui.js` | Petits utilitaires d'affichage |
| `logo.png` | Ton logo |
| `schema.sql` | Les tables et la sécurité, à lancer une seule fois |
| `migration-02.sql` | Fiche profil et co-administratrices, à lancer après `schema.sql` |
| `migration-03.sql` | Questions entre copines, réactions, fêtes, à lancer après `migration-02.sql` |

Chaque page privée commence par `exigerSession()` : si personne n'est
connectée, elle renvoie vers `index.html`. Les pages communiquent entre
elles par de vraies adresses (`groupe.html?id=…`), donc le bouton
« retour » du téléphone fonctionne et chaque numéro a son propre lien
partageable.

### Changer les questions
Tout est dans `config.js`, et rien d'autre à toucher :

| Réglage | À quoi ça sert |
|---|---|
| `RUBRIQUES` | Le squelette fixe, présent chaque mois |
| `QUESTIONS_TOURNANTES` | Les questions surprises, tirées au hasard |
| `QUESTIONS_CHOIX` | Les questions à cocher, tirées au hasard |
| `QUESTIONS_SAISON` | Une question par mois de l'année |
| `FETES` | Les fêtes, avec la question propre à chacune |
| `NB_QUESTIONS_*` | Combien de questions sont tirées à chaque numéro |
| `PALETTE_EMOJIS`, `EMOJIS_REACTION` | Les emojis proposés |

Les éditions déjà ouvertes gardent leurs questions d'origine.
Les formulations sont volontairement mixtes : aucune question ne suppose
le genre de la personne qui répond.

### Les formats de questions
`type` accepte : `court` (une ligne), `long` (un paragraphe),
`mot` (un seul mot), `qcm` (une seule réponse à cocher),
`multi` (plusieurs réponses), `curseur` (0 à 10), `note` (cinq étoiles),
`emojis` (jusqu'à trois), `musique` (titre + lien), `photos`.
`express: true` fait entrer la question dans le mode « 5 minutes ».

### Les questions de saison et les fêtes
Chaque mois a sa question dans `QUESTIONS_SAISON`. S'y ajoute une
question de fête, **personnalisée pour chacune** : dans le même numéro,
l'une raconte son Noël, une autre son Aïd, une troisième sa fin d'année.
Chacune coche ce qu'elle célèbre dans son profil ; sans réponse, la
question reste neutre, et elle est de toute façon facultative.
La formulation réellement vue est enregistrée avec la réponse, donc le
magazine affiche la bonne, même des années plus tard.

### Les questions entre copines
Depuis le formulaire, chacune peut poser une question **à tout le
groupe** ou **à une seule personne**. Elle s'ajoute immédiatement au
questionnaire du mois, et la réponse paraît dans l'édition, signée
« Question de Léa au groupe ».

Celles qui avaient déjà envoyé leur page voient un badge
« 2 nouvelles questions » sur le groupe et en haut du formulaire.
⚠️ Ce rappel est **dans l'appli seulement** : envoyer un vrai mail
demande un bout de serveur (fonction Supabase + service d'envoi),
qui n'est pas encore branché.

### Le brouillon et le mode « 5 minutes »
Le formulaire s'enregistre tout seul deux secondes après la dernière
frappe : on peut répondre en plusieurs fois, changer d'appareil, fermer
l'onglet. Le bouton **Mode 5 minutes** ne garde que les questions
essentielles, plus celles qui sont adressées personnellement.

### Les réactions
Sous la page de chaque copine, dans une édition publiée : un emoji et,
si on veut, un petit mot. Une réaction par personne et par page — on
modifie la sienne, on n'en empile pas. On ne réagit pas à sa propre page.

### Les pages collectives
Montées automatiquement, sans rien à remplir :
- **Les anniversaires du mois**, à partir des dates des profils.
- **« Il y a un an »** : une réponse du même mois l'année dernière,
  remontée dans le numéro courant, avec un lien vers le numéro entier.

### Qui peut quoi
| | Créatrice | Co-admin | Membre |
|---|---|---|---|
| Répondre et lire les éditions publiées | ✅ | ✅ | ✅ |
| Inviter et retirer des copines | ✅ | ✅ | ❌ |
| Ouvrir et publier l'édition du mois | ✅ | ✅ | ❌ |
| Nommer une co-admin | ✅ | ✅ | ❌ |
| Être retirée du groupe | jamais | possible | possible |
| Supprimer le groupe | ✅ | ❌ | ❌ |

La créatrice est protégée par la base elle-même, pas seulement par
l'interface : même en trafiquant les requêtes, on ne peut ni la retirer
ni lui enlever son rôle.

### Mon profil
Chacune remplit sa fiche depuis sa photo en haut à droite : prénom,
photo, anniversaire, ville, deux mots sur elle. À la toute première
connexion, le site demande simplement le prénom — sans ça les copines
apparaîtraient sous le début de leur adresse e-mail.

### La confidentialité
- Chaque copine ne voit que les groupes dont elle est membre.
- Tant qu'une édition est **ouverte**, chacune ne voit que sa propre réponse.
  La surprise du jour de publication est préservée.
- Une fois **publiée**, tout le groupe peut la lire — et la relire, pour toujours.

### Le PDF
Sur une édition publiée, le bouton **Enregistrer en PDF** ouvre
l'impression du navigateur : choisis « Enregistrer au format PDF ».
La mise en page est déjà prévue pour l'impression.

---

## Limites gratuites (largement suffisantes)

| | Offre gratuite | Ce que ça représente |
|---|---|---|
| Supabase — base | 500 Mo | des années de textes |
| Supabase — photos | 1 Go | environ 1 000 photos de téléphone |
| Supabase — connexions | 50 000 / mois | aucun risque |
| Vercel | 100 Go de trafic | aucun risque |

Si le stockage des photos devient serré dans deux ans, Supabase passe
à 8 Go pour 25 $/mois — ou on archive les vieilles éditions.
