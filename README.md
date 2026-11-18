# Entre Nous, notre newsletter privée

Site statique : aucune compilation, aucun `npm install`.
Tu déposes le dossier, c'est en ligne.

Une page par écran : chacune a son fichier HTML et son fichier JS.
Tous les fichiers sont au même niveau, aucun sous-dossier.

---

## Étape 1 : préparer la base (Supabase, 5 min)

1. Sur [supabase.com](https://supabase.com), ouvre ton projet (ou crée-en un,
   région **Europe (Frankfurt)** pour que ce soit rapide depuis la France).
2. Menu de gauche → **SQL Editor** → **New query**.
3. Ouvre le fichier `schema.sql`, copie **tout** son contenu, colle-le, clique **Run**.
   Tu dois voir `Success. No rows returned`.
   Puis fais la même chose avec `migration-02.sql` (fiche profil,
   co-administratrices), et enfin avec `migration-03.sql` (questions
   posées entre copines, réactions, fêtes célébrées). Les trois fichiers
   sont relançables autant de fois que tu veux, dans cet ordre.
5. Menu de gauche → **Authentication** → **Sign In / Providers** :
   vérifie que **Email** est activé, et que *Confirm email* est activé.
6. Toujours dans Authentication → **URL Configuration** → **Site URL** :
   mets l'adresse de ton site une fois déployé (étape 3), par exemple
   `https://entre-nous.vercel.app`. Ajoute-la aussi dans **Redirect URLs**.
   Pour tester en local, ajoute `http://localhost:8000`.

## Étape 2 : brancher le site sur ta base

1. Dans Supabase : **Project Settings** → **Data API**.
2. Copie **Project URL** et la clé **anon public**.
3. Ouvre `config.js` et remplace les deux valeurs du haut.
   C'est le seul fichier à modifier, et il sert à toutes les pages.

La clé `anon` est publique par conception. Elle peut rester dans le code.
C'est le fichier `schema.sql` (les règles RLS) qui protège les données :
personne ne peut lire un groupe dont elle n'est pas membre.

## Étape 3 : mettre en ligne (Vercel, 2 min)

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

## Étape 4 : le premier mois

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
| Le questionnaire | `repondre.html?mois=…` | `repondre.js` | Le formulaire du mois, commun à tous les groupes |
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
| `migration-04.sql` | Tutoriel d'accueil, à lancer après `migration-03.sql` |
| `migration-05.sql` | Le brouillon mensuel, à lancer après `migration-04.sql` |
| `migration-06.sql` | La banque de questions copiée dans la base |
| `migration-07.sql` | Le 1er du mois automatique, les relances et les mails |
| `migration-08.sql` | Ouverture d'un numéro par tout le monde, cinq questions de profil |
| `dictee.js` | La dictée vocale, partagée par les pages |
| `tuto.js` | Le pop-up de bienvenue, partagé par les pages |

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

### Un seul formulaire pour tous les groupes
C'est le cœur du site. On ne remplit **pas** un questionnaire par
groupe : on remplit une seule fois, depuis l'accueil, puis on coche les
groupes à qui l'envoyer.

Comment ça marche sous le capot. Le brouillon est privé et ne dépend
d'aucun groupe : les réponses y sont rangées sous une clé calculée à
partir du libellé de la question, identique d'un groupe à l'autre. À
l'envoi, chaque réponse est redistribuée vers l'identifiant de question
propre à chaque édition. C'est ce qui permet que deux groupes aient
tiré des questions surprises différentes sans que les réponses se
mélangent.

Conséquences utiles :
- Les rubriques communes n'apparaissent qu'une fois dans le formulaire.
- Une question tirée dans un seul groupe est affichée avec l'étiquette
  « Posée seulement dans : … », pour qu'on comprenne pourquoi elle est là.
- Les questions des copines sont regroupées par groupe, en bas, sous un
  titre « La coloc te demande ».
- On peut laisser un groupe de côté. En revenant, tout est pré-rempli,
  on modifie, on coche ce groupe et on envoie.
- Un groupe qui a **déjà** ta page n'est pas recoché automatiquement.
  Ainsi tes retouches destinées à un autre groupe ne repartent pas chez
  lui sans que tu le veuilles. Coche-le si tu veux le mettre à jour.
- Si tu coches un groupe sans édition ouverte ce mois-ci et que tu
  l'administres, elle s'ouvre automatiquement.

### La dictée vocale
Un bouton micro à droite de chaque champ de texte libre. On clique, on
parle, le texte s'écrit, et il reste modifiable à la main. Rien n'est
enregistré ni stocké : seule la transcription arrive dans le champ.

Ça repose sur la reconnaissance vocale du navigateur, donc ça marche
sur Chrome et Edge, pas sur Firefox. Quand le navigateur ne sait pas le
faire, les micros n'apparaissent pas et un bandeau l'explique.

### Le mode « 5 minutes »
Le bouton ne garde que l'essentiel : comment ça va, le mois en trois
lignes, le potin, les trois emojis, les photos. Plus **toutes** les
questions qu'une copine t'a adressées personnellement, qui passent
toujours.

Le choix ne dépend pas seulement du repère `express: true` de
`config.js`. Il croise ce repère avec la liste `IDS_EXPRESS`, et garde
un filet de sécurité qui prend les premières questions du tronc commun.
Sans ça, les numéros ouverts avant l'ajout de ces repères n'avaient
aucune question marquée, et le mode masquait tout le formulaire.

### Le brouillon et le mode « 5 minutes »
Le formulaire s'enregistre tout seul deux secondes après la dernière
frappe, dans le brouillon du mois : on peut répondre en plusieurs fois,
changer d'appareil, fermer l'onglet. Le bouton **Mode 5 minutes** ne garde que les questions
essentielles, plus celles qui sont adressées personnellement.

### Les réactions
Sous la page de chaque copine, dans une édition publiée : un emoji et,
si on veut, un petit mot. Une réaction par personne et par page.
On modifie la sienne, on n'en empile pas. On ne réagit pas à sa propre page.

### Le tutoriel d'accueil
À sa toute première visite, chacune voit un pop-up en six étapes :
ce qu'est la newsletter, comment répondre, comment poser une question,
comment le magazine arrive, ce que fait une administratrice, et quoi
mettre dans son profil. On navigue aux flèches du clavier, on ferme
avec Échap, et ça ne revient plus jamais. La lecture est mémorisée sur
le profil, pas dans le navigateur, donc le pop-up ne réapparaît pas en
passant du téléphone à l'ordinateur.

Le texte des étapes est en haut de `tuto.js`, dans `ETAPES`.
Chacune peut le revoir quand elle veut depuis sa page profil.

### Rattraper un mois passé
À l'ouverture d'une édition, l'administratrice choisit le mois : le mois
courant, ou l'un des trois précédents s'il n'a pas encore eu son numéro.
Pratique quand on démarre la newsletter début novembre en voulant quand
même faire octobre.

Les numéros restent **chronologiques** quoi qu'il arrive : si tu ouvres
octobre après novembre, octobre devient le numéro 1 et novembre le
numéro 2. Le site renumérote tout seul.

### Le 1er du mois, tout seul
Une tâche planifiée tourne dans la base, pas dans le site. Elle part
donc à l'heure même si personne n'ouvre le site.

| Quand | Ce qui se passe |
|---|---|
| Le 27, 8h17 UTC | Relance de celles qui n'ont pas encore envoyé leur page |
| Le 1er, 2h17 UTC | Publication du mois écoulé, ouverture du nouveau |
| Toutes les 5 min | La file de mails se vide |

Un numéro sans **aucune** réponse n'est pas publié : il reste ouvert, et
le groupe reçoit un message pour se relancer. Évite les trous vides dans
l'archive.

Les numéros restent chronologiques : la tâche renumérote après chaque
passage. Et si elle se déclenche deux fois, rien n'est dupliqué, ni les
éditions ni les mails.

Pour la déclencher à la main et voir ce qu'elle ferait :
```sql
select newsletter.basculer_le_mois();          -- aujourd'hui
select newsletter.basculer_le_mois('2026-12-01');  -- une date précise
select newsletter.relancer_avant_cloture();
```

### Pourquoi la banque de questions est aussi dans la base
La tâche planifiée tourne dans PostgreSQL, qui ne sait pas lire
`config.js`. Elle a donc besoin de sa propre copie des questions.

**Tu continues à modifier `config.js`, et rien d'autre.** Dès qu'une
administratrice ouvre le site, il compare une empreinte et recopie la
banque dans la base si elle a changé. Tu n'as jamais à toucher à la
table `banque`.

### Les mails
Supabase ne sait pas envoyer de mail tout seul : il faut un service
d'envoi. Tant qu'il n'est pas configuré, les mails s'accumulent dans la
file sans rien casser, et ils partiront dès que tu auras collé ta clé.

Une seule commande à lancer dans le SQL Editor :
```sql
select newsletter.configurer_mail('brevo', 'TA-CLE-API',
       'ton@email.com', 'Entre Nous');
```
`brevo` ou `resend` au choix. Brevo est plus simple au départ : il
suffit de faire vérifier ton adresse d'expéditeur, sans posséder de
domaine.

Pour voir où en est la file :
```sql
select statut, motif, count(*) from newsletter.mails group by 1, 2;
select newsletter.envoyer_mails();   -- vider la file maintenant
```
La clé est rangée sous une entrée `secret_`, que les règles de sécurité
empêchent de lire depuis le site. Elle ne sort jamais de la base.

### Les pages collectives
Montées automatiquement, sans rien à remplir :
- **Les anniversaires du mois**, à partir des dates des profils.
- **« Il y a un an »** : une réponse du même mois l'année dernière,
  remontée dans le numéro courant, avec un lien vers le numéro entier.

### Ouvrir un numéro
N'importe quelle membre du groupe peut ouvrir le questionnaire du mois,
pas seulement l'administratrice. Personne n'attend après personne.
Trois endroits le proposent : la carte du haut de l'accueil quand rien
n'est ouvert, une carte dans le questionnaire juste avant le choix des
groupes, et l'envoi lui-même (cocher un groupe sans numéro l'ouvre).

**Publier** reste réservé aux administratrices, puisque c'est le geste
qui rend les pages visibles de tout le monde. C'est verrouillé dans la
base par un garde-fou, pas seulement dans l'interface : une membre peut
ouvrir et laisser renuméroter, mais ni publier, ni changer le mois, ni
toucher aux questions d'un numéro.

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
photo, anniversaire, ville, ce qu'elle fait, ses enfants, ses animaux,
un truc que peu de gens savent sur elle, sa phrase du moment, et deux
mots libres. Tout est facultatif.

Ce qu'elle fait et sa phrase du moment apparaissent sous son nom dans
le magazine. Les autres informations restent sur sa fiche, consultables
quand on veut. À la toute première
connexion, le site demande simplement le prénom. Sans ça les copines
apparaîtraient sous le début de leur adresse e-mail.

### La confidentialité
- Chaque copine ne voit que les groupes dont elle est membre.
- Tant qu'une édition est **ouverte**, chacune ne voit que sa propre réponse.
  La surprise du jour de publication est préservée.
- Une fois **publiée**, tout le groupe peut la lire, et la relire, pour toujours.

### Le PDF
Sur une édition publiée, le bouton **Enregistrer en PDF** ouvre
l'impression du navigateur : choisis « Enregistrer au format PDF ».
La mise en page est déjà prévue pour l'impression.

---

## Limites gratuites (largement suffisantes)

| | Offre gratuite | Ce que ça représente |
|---|---|---|
| Supabase, base | 500 Mo | des années de textes |
| Supabase, photos | 1 Go | environ 1 000 photos de téléphone |
| Supabase, connexions | 50 000 / mois | aucun risque |
| Vercel | 100 Go de trafic | aucun risque |

Si le stockage des photos devient serré dans deux ans, Supabase passe
à 8 Go pour 25 $/mois. Ou on archive les vieilles éditions.
