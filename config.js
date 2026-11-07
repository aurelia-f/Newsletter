// ==========================================================
//  Réglages — c'est LE seul fichier que tu dois modifier.
// ==========================================================

// 1. Tes clés Supabase (Project Settings > Data API).
//    La clé "anon" est publique par conception : elle peut
//    rester dans le code, la sécurité est assurée par les
//    règles RLS du fichier schema.sql.
export const SUPABASE_URL      = 'https://pwzdgeiewkbuicaoxkfv.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_OQjM5gEsQfHyCPxDMEPw_g_b3y-ryov';

// 2. Le nom de ta newsletter.
export const NOM_DU_SITE = 'Entre Nous';
export const BASELINE = 'Les nouvelles de nos vies, une fois par mois.';

// 3. Les rubriques d'une édition.
//    Tu peux en ajouter, en retirer, en réécrire : le site
//    s'adapte tout seul. Types possibles :
//      'court'   → une ligne
//      'long'    → un paragraphe
//      'musique' → titre + lien Spotify/YouTube
//      'photos'  → photos et vidéos
export const RUBRIQUES = [
  { id: 'resume',   type: 'long',    intitule: 'Mon mois en trois lignes',
    aide: 'Ce que tu raconterais à une copine autour d\'un café.' },

  { id: 'potin',    type: 'long',    intitule: 'Le potin du mois',
    aide: 'Une nouvelle, un ragot, une annonce. Tout est permis.' },

  { id: 'victoire', type: 'court',   intitule: 'Ma petite victoire',
    aide: 'Même minuscule. Surtout si elle est minuscule.' },

  { id: 'rire',     type: 'court',   intitule: 'Ce qui m\'a fait rire' },

  { id: 'pleurer',  type: 'court',   intitule: 'Ce qui m\'a fait pleurer',
    aide: 'Un film, une news, une fatigue. Ou rien du tout.' },

  { id: 'musique',  type: 'musique', intitule: 'Ma chanson du moment',
    aide: 'Elle rejoindra la playlist commune du mois.' },

  { id: 'ecran',    type: 'court',   intitule: 'Ce que je regarde ou je lis' },

  { id: 'achat',    type: 'court',   intitule: 'Mon achat du mois',
    aide: 'Assumé ou profondément regretté.' },

  { id: 'photos',   type: 'photos',  intitule: 'Mon mois en photos',
    aide: 'Les bébés, les chats, les voyages, le brunch raté.' },

  { id: 'suite',    type: 'court',   intitule: 'Le mois prochain, j\'ai hâte de…' },
];

// 4. Les questions qui changent chaque mois.
//    Le site en tire deux au hasard à la création d'une édition.
export const QUESTIONS_TOURNANTES = [
  'Ton pire date, raconte.',
  'Si tu déménageais demain, ce serait où ?',
  'Qu\'est-ce que tu dirais à la toi d\'il y a dix ans ?',
  'La dépense la plus honteuse de ce mois-ci ?',
  'Quelle habitude tu essaies d\'arrêter sans y arriver ?',
  'Le compliment qui t\'a le plus touchée récemment ?',
  'Qu\'est-ce que tu as appris ce mois-ci, même de nul ?',
  'Ton dimanche parfait, heure par heure.',
  'La chose la plus spontanée que tu aies faite ce mois-ci ?',
  'Qu\'est-ce qui te manque le plus de nos années ensemble ?',
  'Si on partait toutes en week-end demain, tu nous emmènes où ?',
  'Quel est ton plus gros projet secret du moment ?',
];
