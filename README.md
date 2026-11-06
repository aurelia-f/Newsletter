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
| Mes groupes | `groupes.html` | `groupes.js` | La liste, et la création d'un groupe |
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

Chaque page privée commence par `exigerSession()` : si personne n'est
connectée, elle renvoie vers `index.html`. Les pages communiquent entre
elles par de vraies adresses (`groupe.html?id=…`), donc le bouton
« retour » du téléphone fonctionne et chaque numéro a son propre lien
partageable.

### Changer les questions
Tout est dans `config.js` : `RUBRIQUES` pour le squelette fixe,
`QUESTIONS_TOURNANTES` pour les questions surprises (le site en tire
deux au hasard à l'ouverture de chaque édition).
Les éditions déjà ouvertes gardent leurs questions d'origine.

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
