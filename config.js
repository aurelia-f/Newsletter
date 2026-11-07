// ==========================================================
//  Réglages — c'est LE seul fichier que tu dois modifier.
// ==========================================================

// 1. Tes clés Supabase (Project Settings > Data API).
//    La clé "anon" est publique par conception : elle peut
//    rester dans le code, la sécurité est assurée par les
//    règles RLS des fichiers schema.sql et migration-*.sql.
export const SUPABASE_URL      = 'https://pwzdgeiewkbuicaoxkfv.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_OQjM5gEsQfHyCPxDMEPw_g_b3y-ryov';

// 2. Le nom de ta newsletter.
export const NOM_DU_SITE = 'Entre Nous';
export const BASELINE = 'Les nouvelles de nos vies, une fois par mois.';

// ==========================================================
//  3. LES RUBRIQUES FIXES — le squelette de chaque numéro
// ==========================================================
//  Types disponibles :
//    'court'   → une ligne
//    'long'    → un paragraphe
//    'mot'     → un seul mot
//    'qcm'     → une seule réponse à cocher
//    'multi'   → plusieurs réponses à cocher
//    'curseur' → une valeur de 0 à 10
//    'note'    → de une à cinq étoiles
//    'emojis'  → jusqu'à trois emojis
//    'musique' → titre + lien Spotify / YouTube
//    'photos'  → photos et vidéos
//
//  `express: true` → la question fait partie du mode « 5 minutes ».
//
//  Les formulations sont volontairement mixtes : le site n'est pas
//  réservé aux filles, donc aucune question ne suppose le genre de
//  la personne qui répond.
export const RUBRIQUES = [
  { id: 'humeur', type: 'qcm', express: true,
    intitule: 'Alors, comment ça va vraiment ?',
    choix: ['Au top', 'Ça va bien', 'Tranquille', 'Je survis', 'Mois difficile', 'Ne me demande pas'] },

  { id: 'resume', type: 'long', express: true,
    intitule: 'Mon mois en trois lignes',
    aide: 'Ce que tu raconterais à quelqu\'un autour d\'un café.' },

  { id: 'energie', type: 'curseur',
    intitule: 'Mon niveau d\'énergie',
    aide: '0 = une loque, 10 = inarrêtable. On comparera dans un an.',
    min: 0, max: 10, basG: 'À plat', basD: 'Inarrêtable' },

  { id: 'mode', type: 'multi',
    intitule: 'Ce mois-ci, j\'étais plutôt en mode',
    aide: 'Coche tout ce qui s\'applique, sans honte.',
    choix: ['Débordé·e', 'Amoureux·se', 'Productif·ve', 'En vrac', 'Sportif·ve',
            'Casanier·ère', 'Fêtard·e', 'Insupportable', 'Zen', 'En pleine réflexion'] },

  { id: 'potin', type: 'long', express: true,
    intitule: 'Le potin du mois',
    aide: 'Une nouvelle, un ragot, une annonce. Tout est permis.' },

  { id: 'victoire', type: 'court',
    intitule: 'Ma petite victoire',
    aide: 'Même minuscule. Surtout si elle est minuscule.' },

  { id: 'rire', type: 'court', intitule: 'Ce qui m\'a fait rire' },

  { id: 'pleurer', type: 'court',
    intitule: 'Ce qui m\'a fait pleurer',
    aide: 'Un film, une news, une fatigue. Ou rien du tout.' },

  { id: 'emojis', type: 'emojis', express: true,
    intitule: 'Mon mois en trois emojis',
    aide: 'Trois, pas plus. C\'est ce qu\'on relira le plus vite dans dix ans.' },

  { id: 'musique', type: 'musique',
    intitule: 'Ma chanson du moment',
    aide: 'Elle rejoindra la playlist commune du mois.' },

  { id: 'ecran', type: 'court', intitule: 'Ce que je regarde ou je lis' },

  { id: 'achat', type: 'court',
    intitule: 'Mon achat du mois',
    aide: 'Assumé ou profondément regretté.' },

  { id: 'note_mois', type: 'note',
    intitule: 'Mon mois, sur cinq étoiles' },

  { id: 'photos', type: 'photos', express: true,
    intitule: 'Mon mois en photos',
    aide: 'Les bébés, les chats, les voyages, le brunch raté.' },

  { id: 'suite', type: 'court', intitule: 'Le mois prochain, j\'ai hâte de…' },
];

// ==========================================================
//  4. LES QUESTIONS SURPRISES — à rédiger
// ==========================================================
//  Le site en tire quelques-unes au hasard à chaque édition.
//  Formulations mixtes, rien qui suppose un genre.
export const QUESTIONS_TOURNANTES = [
  'Ton pire rendez-vous galant, raconte.',
  'Si tu déménageais demain, ce serait où ?',
  'Qu\'est-ce que tu dirais à la personne que tu étais il y a dix ans ?',
  'La dépense la plus honteuse de ce mois-ci ?',
  'Quelle habitude tu essaies d\'arrêter sans y arriver ?',
  'Le compliment qui t\'a le plus touché·e récemment ?',
  'Qu\'est-ce que tu as appris ce mois-ci, même de complètement inutile ?',
  'Ton dimanche parfait, heure par heure.',
  'La chose la plus spontanée que tu aies faite ce mois-ci ?',
  'Qu\'est-ce qui te manque le plus de nos années ensemble ?',
  'Si on partait tous en week-end demain, tu nous emmènes où ?',
  'Ton plus gros projet secret du moment ?',
  'Le message que tu as hésité à envoyer et que tu n\'as pas envoyé ?',
  'Qu\'est-ce qui t\'a énervé·e bien plus que ça ne le méritait ?',
  'Un truc que tout le monde adore et que tu ne supportes pas ?',
  'La dernière fois que tu as ri jusqu\'aux larmes, c\'était pourquoi ?',
  'Qu\'est-ce que tu remets à plus tard depuis trop longtemps ?',
  'Le meilleur conseil qu\'on t\'a donné ce mois-ci ?',
  'Un endroit de ta ville que tu nous recommanderais les yeux fermés ?',
  'Si ton mois avait un titre de film, ce serait quoi ?',
  'Quelle chanson te remet d\'aplomb à chaque fois ?',
  'Qu\'est-ce que tu as mangé de meilleur ce mois-ci ?',
  'Une petite chose qui t\'a rendu·e inexplicablement heureux·se ?',
  'Qu\'est-ce que tu ferais ce week-end si personne ne jugeait ?',
  'À qui tu penses souvent sans jamais lui écrire ?',
  'La dernière photo de ta galerie, c\'est quoi ?',
  'Qu\'est-ce que tu veux absolument avoir fait avant la fin de l\'année ?',
  'Le pire achat de ta vie, toutes catégories ?',
  'Qu\'est-ce qui a changé chez toi cette année, en vrai ?',
  'Une question que tu aimerais qu\'on te pose plus souvent ?',
];

// ==========================================================
//  5. LES QUESTIONS À COCHER — rapides, drôles, comparables
// ==========================================================
//  Le site en tire quelques-unes au hasard à chaque édition.
//  Ce sont elles qui alimentent les pages de résultats.
export const QUESTIONS_CHOIX = [
  { id: 'c_sommeil', type: 'qcm', intitule: 'Ce mois-ci, mon sommeil',
    choix: ['De bébé', 'Correct', 'Chaotique', 'Inexistant'] },

  { id: 'c_social', type: 'qcm', intitule: 'Ma vie sociale ce mois-ci',
    choix: ['En feu', 'Équilibrée', 'Au ralenti', 'Je vis sous un rocher'] },

  { id: 'c_argent', type: 'qcm', intitule: 'Mon rapport à l\'argent ce mois-ci',
    choix: ['Sage comme une image', 'Ça va', 'J\'ai craqué une fois', 'Ne regardons pas le relevé'] },

  { id: 'c_sport', type: 'qcm', intitule: 'Le sport et moi, ce mois-ci',
    choix: ['Assidu·e', 'De temps en temps', 'J\'y ai pensé', 'Le sport est mort'] },

  { id: 'c_cuisine', type: 'qcm', intitule: 'Ce mois-ci, j\'ai surtout mangé',
    choix: ['Fait maison', 'Un peu des deux', 'Des livraisons', 'Du pain et de l\'espoir'] },

  { id: 'c_telephone', type: 'qcm', intitule: 'Mon temps d\'écran',
    choix: ['Maîtrisé', 'Raisonnable', 'Préoccupant', 'Je refuse de répondre'] },

  { id: 'c_decouvertes', type: 'multi', intitule: 'Ce mois-ci, j\'ai découvert',
    choix: ['Une série', 'Un album', 'Un resto', 'Un livre', 'Un sport',
            'Une recette', 'Un endroit', 'Une personne', 'Rien du tout'] },

  { id: 'c_fierte', type: 'curseur', intitule: 'Ma fierté du mois, sur dix',
    min: 0, max: 10, basG: 'Bof', basD: 'Très fier·ère' },

  { id: 'c_stress', type: 'curseur', intitule: 'Mon niveau de stress',
    min: 0, max: 10, basG: 'Serein·e', basD: 'Au bord' },

  { id: 'c_mot', type: 'mot', intitule: 'Mon mois en UN seul mot',
    aide: 'Un seul. On en fera un nuage de mots du groupe.' },

  { id: 'c_prochain', type: 'qcm', intitule: 'Le mois prochain, je sens que ça va être',
    choix: ['Génial', 'Chargé', 'Calme', 'Aucune idée'] },

  { id: 'c_besoin', type: 'multi', intitule: 'Ce dont j\'aurais besoin là, maintenant',
    choix: ['Des vacances', 'Du sommeil', 'Un câlin', 'De l\'argent',
            'Du silence', 'Voir du monde', 'Un projet', 'Rien, ça va'] },
];

// ==========================================================
//  6. LES QUESTIONS DE SAISON — selon le mois
// ==========================================================
//  Posées à tout le monde, quelles que soient les croyances.
export const QUESTIONS_SAISON = {
  1:  { id: 's_janvier',   type: 'long', intitule: 'Ta résolution de janvier, et ton pronostic honnête sur sa survie ?' },
  2:  { id: 's_fevrier',   type: 'long', intitule: 'Février, mois de l\'amour : raconte-nous une histoire d\'amour — la tienne, celle d\'un·e ami·e, ou celle de tes grands-parents.' },
  3:  { id: 's_mars',      type: 'long', intitule: 'Qu\'est-ce que tu recommences, ou qu\'est-ce que tu arrêtes, ce trimestre ?' },
  4:  { id: 's_avril',     type: 'long', intitule: 'La dernière fois que tu t\'es fait avoir, ou que tu as bien eu quelqu\'un ?' },
  5:  { id: 's_mai',       type: 'long', intitule: 'Ton prochain jour de congé, tu en fais quoi ?' },
  6:  { id: 's_juin',      type: 'long', intitule: 'La moitié de l\'année est passée : qu\'est-ce que tu gardes, qu\'est-ce que tu jettes ?' },
  7:  { id: 's_juillet',   type: 'long', intitule: 'Ton plan de l\'été, même modeste, même inavouable ?' },
  8:  { id: 's_aout',      type: 'long', intitule: 'Le meilleur souvenir d\'été de ta vie, toutes années confondues ?' },
  9:  { id: 's_septembre', type: 'long', intitule: 'Ta rentrée en un mot et en une photo — à quoi ressemble ta vie en ce moment ?' },
  10: { id: 's_octobre',   type: 'long', intitule: 'De quoi tu as eu peur cette année, et est-ce que ça s\'est réalisé ?' },
  11: { id: 's_novembre',  type: 'long', intitule: 'Trois choses pour lesquelles tu es sincèrement reconnaissant·e en ce moment ?' },
  12: { id: 's_decembre',  type: 'long', intitule: 'Ton bilan de l\'année en trois lignes : le meilleur, le pire, la surprise.' },
};

// ==========================================================
//  7. LES FÊTES — pour que la question de saison soit juste
// ==========================================================
//  Chacune indique dans son profil ce qu'elle célèbre, et reçoit
//  SA version de la question. Dans le même numéro, l'une raconte
//  son Noël, l'autre son Aïd, une troisième sa fin d'année.
//  `mois` = les mois où la fête peut tomber (certaines se décalent
//  d'une année sur l'autre, d'où plusieurs mois possibles).
export const FETES = [
  { id: 'noel',        nom: 'Noël',               mois: [12],
    question: 'Ton Noël : avec qui, où, et le détail qu\'on ne devinerait pas ?' },
  { id: 'nouvel_an',   nom: 'Le Nouvel An',       mois: [12, 1],
    question: 'Ton passage à la nouvelle année : raconte la soirée, ou l\'absence de soirée.' },
  { id: 'aid',         nom: 'L\'Aïd',             mois: [3, 4, 5, 6],
    question: 'Ton Aïd : avec qui, ce que vous avez mangé, le moment que tu retiens ?' },
  { id: 'ramadan',     nom: 'Le Ramadan',         mois: [2, 3, 4, 5],
    question: 'Ton Ramadan cette année : comment tu le vis, et ton meilleur ftour ?' },
  { id: 'paques',      nom: 'Pâques',             mois: [3, 4],
    question: 'Ton week-end de Pâques, entre le sérieux et le chocolat ?' },
  { id: 'hanoucca',    nom: 'Hanoucca',           mois: [11, 12],
    question: 'Ton Hanoucca : les soirs, les gens, les beignets ?' },
  { id: 'roch_hachana',nom: 'Roch Hachana',       mois: [9, 10],
    question: 'Ta nouvelle année : ce que tu laisses derrière, ce que tu espères ?' },
  { id: 'diwali',      nom: 'Diwali',             mois: [10, 11],
    question: 'Ton Diwali : les lumières, les gens, ce qui t\'a le plus plu ?' },
  { id: 'nouvel_an_cn',nom: 'Le Nouvel An chinois', mois: [1, 2],
    question: 'Ton Nouvel An : le repas, la famille, l\'ambiance ?' },
  { id: 'thanksgiving',nom: 'Thanksgiving',       mois: [11],
    question: 'Ton Thanksgiving : la table, les gens, le plat qu\'on s\'est disputé ?' },
  { id: 'anniversaire_perso', nom: 'Mon anniversaire', mois: [],
    question: 'C\'est ton anniversaire ce mois-ci : comment tu l\'as passé, et ton vœu ?' },
];

// Posée à celles et ceux dont aucune fête ne tombe ce mois-ci.
// Toujours facultative, comme toutes les questions.
export const QUESTION_FETE_NEUTRE = {
  id: 'fete',
  type: 'long',
  intitule: 'Une fête, une tradition, une occasion ce mois-ci ?',
  aide: 'Même minuscule, même inventée. Ou rien du tout, c\'est très bien aussi.',
};

// ==========================================================
//  8. RÉGLAGES FINS
// ==========================================================
export const NB_QUESTIONS_TOURNANTES = 2;  // questions surprises par édition
export const NB_QUESTIONS_CHOIX      = 2;  // questions à cocher par édition
export const NB_QUESTIONS_EXPRESS    = 5;  // taille du mode « 5 minutes »

// La palette proposée pour « mon mois en trois emojis ».
export const PALETTE_EMOJIS = [
  '😍','🥳','😭','😤','🥱','🤩','😮‍💨','🫠','🥰','😎',
  '✈️','🏡','💼','📚','🏋️','🍜','☕','🎂','💅','🎧',
  '🌞','🌧️','🌊','⛰️','🐱','🐶','💖','💸','🔥','✨',
];

// Les réactions possibles sous la page d'une copine.
export const EMOJIS_REACTION = ['❤️','😂','😮','🥹','👏','🔥','🫶'];
