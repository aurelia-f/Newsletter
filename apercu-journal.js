// ==========================================================
//  Aperçu des gabarits, avec de fausses réponses.
//  Rien n'est enregistré : c'est une page de travail.
// ==========================================================
import { pageJournal, uneDuNumero, GABARITS } from './journal.js';

/* Des images factices, dessinées en SVG : aucune vraie photo. */
function faussePhoto(graine, large) {
  const l = large ? 1200 : 800, h = large ? 700 : 1000;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l} ${h}">
    <rect width="${l}" height="${h}" fill="#cfc8bb"/>
    <circle cx="${l * .5}" cy="${h * .38}" r="${h * .17}" fill="#a89f91"/>
    <path d="M0 ${h} L${l * .3} ${h * .55} L${l * .55} ${h} Z" fill="#9b9285"/>
    <path d="M${l * .35} ${h} L${l * .72} ${h * .45} L${l} ${h} Z" fill="#b5ac9e"/>
    <text x="${l / 2}" y="${h - 40}" text-anchor="middle"
          font-family="serif" font-size="34" fill="#6d655a">photo ${graine}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const QUESTIONS = [
  { id: 'humeur',    type: 'qcm',     intitule: 'Alors, comment ça va vraiment ?' },
  { id: 'resume',    type: 'long',    intitule: 'Mon mois en trois lignes' },
  { id: 'energie',   type: 'curseur', intitule: 'Mon niveau d\'énergie', min: 0, max: 10 },
  { id: 'potin',     type: 'long',    intitule: 'Le potin du mois' },
  { id: 'victoire',  type: 'court',   intitule: 'Ma petite victoire' },
  { id: 'rire',      type: 'court',   intitule: 'Ce qui m\'a fait rire' },
  { id: 'emojis',    type: 'emojis',  intitule: 'Mon mois en trois emojis' },
  { id: 'musique',   type: 'musique', intitule: 'Ma chanson du moment' },
  { id: 'note_mois', type: 'note',    intitule: 'Mon mois, sur cinq étoiles' },
  { id: 'c_mot',     type: 'mot',     intitule: 'Mon mois en UN seul mot' },
  { id: 'photos',    type: 'photos',  intitule: 'Mon mois en photos' },
  { id: 'suite',     type: 'court',   intitule: 'Le mois prochain, j\'ai hâte de…' },
];

const TEXTE_LONG = `Le mois est passé beaucoup trop vite, comme d'habitude. J'ai
travaillé, j'ai râlé, j'ai dormi trop tard, et j'ai quand même trouvé le temps de
refaire la peinture du couloir, ce dont je ne me remets toujours pas. Il a fait un
temps magnifique deux week-ends de suite, et j'en ai profité pour marcher beaucoup,
ce qui m'a fait un bien fou. Sinon, rien de spectaculaire : des courses, des soirées,
un rhume, et une envie de vacances qui grandit chaque jour.`;

const PRENOMS = ['Aurélia', 'Jeanne', 'Lou', 'Manon', 'Inès'];

const reponses = PRENOMS.map((prenom, i) => ({
  id: 'r' + i,
  profile_id: 'p' + i,
  auteure: {
    prenom,
    occupation: ['étudiante', 'architecte', 'infirmière', 'libraire', 'prof'][i],
    ville: ['Le Cap', 'Lyon', 'Nantes', 'Paris', 'Bordeaux'][i],
    devise: i % 2 ? 'On verra bien, et c\'est très bien comme ça.' : null,
  },
  medias: [
    { type: 'image', url: faussePhoto(i + 1, i % 2 === 0) },
    { type: 'image', url: faussePhoto(i + 10) },
    { type: 'image', url: faussePhoto(i + 20) },
  ],
  contenu: {
    humeur: ['Au top', 'Ça va bien', 'Je survis', 'Tranquille', 'Mois difficile'][i],
    resume: TEXTE_LONG,
    energie: [8, 5, 3, 7, 6][i],
    potin: 'Quelqu\'un dans cette newsletter a acheté un deuxième chat sans prévenir personne. Je ne donnerai pas de nom.',
    victoire: 'J\'ai enfin rappelé le dentiste.',
    rire: 'Une vidéo de chèvre qui crie, à deux heures du matin.',
    emojis: ['☀️', '📚', '🍷'],
    musique: 'Un morceau que je passe en boucle depuis trois semaines',
    note_mois: [4, 3, 2, 5, 3][i],
    c_mot: ['Vitesse', 'Doux', 'Chaos', 'Lumière', 'Patience'][i],
    suite: 'Partir quelque part sans regarder la météo.',
  },
}));

const ed = {
  id: 'demo',
  numero: 3,
  mois: '2026-11-01',
  questions: QUESTIONS,
  groupe: { id: 'g', nom: 'Les Copines' },
};

const pied = PRENOMS.join(' · ');
const journal = document.getElementById('journal');

journal.innerHTML = uneDuNumero(ed, reponses, [])
  + reponses.map((r, i) => {
      const page = pageJournal(r, ed, i, [], [], pied);
      return `<p class="discret" style="text-align:center;margin:6px 0 -14px">
                gabarit « ${GABARITS[(i + 3) % GABARITS.length]} »
              </p>` + page;
    }).join('');

/* Les trois rendus */
const teinte = document.getElementById('teinte');
document.querySelectorAll('[data-rendu]').forEach(b =>
  b.addEventListener('click', () => {
    document.querySelectorAll('[data-rendu]').forEach(x => x.classList.add('fil'));
    b.classList.remove('fil');
    appliquer(b.dataset.rendu);
  }));
teinte.addEventListener('input', () => appliquer(journal.dataset.rendu));

function appliquer(rendu) {
  journal.dataset.rendu = rendu;
  if (rendu === 'nb') {
    journal.style.removeProperty('--jr-accent');
    journal.style.removeProperty('--jr-rotation');
  } else {
    journal.style.setProperty('--jr-accent', teinte.value);
    journal.style.setProperty('--jr-rotation', rotation(teinte.value) + 'deg');
  }
}

function rotation(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360) - 35;
}
