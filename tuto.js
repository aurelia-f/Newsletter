// ==========================================================
//  Le tutoriel d'accueil : une modale en quelques étapes
//  S'affiche à la première visite, puis plus jamais.
//  Réouvrable depuis la page profil.
// ==========================================================
import { majProfil } from './db.js';
import { NOM_DU_SITE } from './config.js';
import { txt } from './ui.js';

const ETAPES = [
  {
    emoji: '🎀',
    titre: `Bienvenue dans ${NOM_DU_SITE}`,
    corps: `C'est une newsletter privée, entre vous et personne d'autre.
            Une fois par mois, chacun·e raconte son mois : quelques questions,
            des photos, sa chanson du moment. Tout est réuni en un petit
            magazine que vous recevez ensemble.`,
    detail: 'Aucun algorithme, aucune pub, aucun inconnu. Juste vous.',
  },
  {
    emoji: '✍️',
    titre: 'Chaque mois, tu racontes',
    corps: `Tu ouvres le questionnaire du mois et tu réponds à ce qui te parle.
            <strong>Tout est facultatif.</strong> Saute sans hésiter ce qui
            ne t'inspire pas.`,
    detail: `Pas besoin de tout faire d'un coup : ça s'enregistre tout seul,
             tu peux revenir plus tard ou finir sur ton téléphone. Pressé·e ?
             Le bouton « Mode 5 minutes » ne garde que l'essentiel.`,
  },
  {
    emoji: '💬',
    titre: 'Tu peux poser des questions',
    corps: `En bas du questionnaire, tu écris une question et tu choisis :
            <strong>à tout le groupe</strong>, ou <strong>à une seule
            personne</strong>.`,
    detail: `La réponse paraîtra dans le magazine, signée « Question de toi ».
             Et la personne reste libre de ne pas répondre.`,
  },
  {
    emoji: '📬',
    titre: 'Puis le magazine arrive',
    corps: `Quand le numéro est publié, tu lis les pages de tout le monde
            d'un coup. Tant qu'il est en cours, personne ne voit les réponses
            des autres : la surprise est gardée.`,
    detail: `Sous chaque page, tu peux laisser un emoji et un petit mot.
             Et tu peux enregistrer le numéro en PDF pour le garder.`,
  },
  {
    emoji: '👑',
    titre: 'Si tu gères un groupe',
    corps: `Tu es administratrice : tu invites les copines par e-mail, tu
            ouvres le questionnaire du mois, et tu publies quand tu estimes
            qu'il y a assez de réponses.`,
    detail: `Le rythme qui marche : ouvrir le 1er, relancer vers le 20,
             publier le 1er du mois suivant. Tu peux aussi nommer une
             co-administratrice pour t'aider.`,
  },
  {
    emoji: '🫶',
    titre: 'Une dernière chose',
    corps: `Remplis ton profil : ton prénom, ta photo, ton anniversaire, et
            ce que tu célèbres dans l'année.`,
    detail: `Ça permet au site de te poser les bonnes questions. Et à tes
             copines de ne plus jamais oublier ta date.`,
  },
];

let etape = 0;

/**
 * Affiche le tutoriel. `force` = demandé explicitement depuis le profil
 * (on ne touche alors pas au profil en sortant).
 */
export function montrerTuto({ force = false } = {}) {
  etape = 0;

  const fond = document.createElement('div');
  fond.className = 'voile-tuto';
  fond.innerHTML = `
    <div class="modale" role="dialog" aria-modal="true" aria-label="Présentation du site">
      <button class="fermer-modale" id="tuto-fermer" aria-label="Fermer">×</button>
      <div id="tuto-corps"></div>
      <div class="points-tuto" id="tuto-points"></div>
      <div class="rangee espace" style="margin-top:20px">
        <button class="btn fil petit" id="tuto-retour">Retour</button>
        <button class="btn" id="tuto-suite">Suivant</button>
      </div>
    </div>`;
  document.body.appendChild(fond);
  document.body.classList.add('sans-defilement');

  const corps = fond.querySelector('#tuto-corps');
  const points = fond.querySelector('#tuto-points');
  const retour = fond.querySelector('#tuto-retour');
  const suite = fond.querySelector('#tuto-suite');

  function dessiner() {
    const e = ETAPES[etape];
    corps.innerHTML = `
      <span class="emoji-tuto">${e.emoji}</span>
      <span class="surtitre">Étape ${etape + 1} sur ${ETAPES.length}</span>
      <h2 style="margin:4px 0 12px">${txt(e.titre)}</h2>
      <p class="corps-tuto">${e.corps}</p>
      ${e.detail ? `<p class="discret" style="margin-top:12px">${e.detail}</p>` : ''}`;

    points.innerHTML = ETAPES.map((_, i) =>
      `<span class="point ${i === etape ? 'actif' : ''}"></span>`).join('');

    retour.style.visibility = etape === 0 ? 'hidden' : 'visible';
    suite.textContent = etape === ETAPES.length - 1 ? 'C\'est compris' : 'Suivant';
  }

  async function terminer() {
    document.body.classList.remove('sans-defilement');
    fond.remove();
    window.removeEventListener('keydown', auClavier);
    if (!force) {
      try { await majProfil({ tuto_vu: true }); } catch { /* sans gravité */ }
    }
  }

  suite.addEventListener('click', () => {
    if (etape < ETAPES.length - 1) { etape++; dessiner(); } else { terminer(); }
  });
  retour.addEventListener('click', () => { if (etape > 0) { etape--; dessiner(); } });
  fond.querySelector('#tuto-fermer').addEventListener('click', terminer);
  fond.addEventListener('click', e => { if (e.target === fond) terminer(); });

  function auClavier(e) {
    if (e.key === 'Escape') terminer();
    if (e.key === 'ArrowRight' && etape < ETAPES.length - 1) { etape++; dessiner(); }
    if (e.key === 'ArrowLeft' && etape > 0) { etape--; dessiner(); }
  }
  window.addEventListener('keydown', auClavier);

  dessiner();
}

/** À appeler sur la page d'accueil : affiche le tutoriel si jamais vu. */
export function tutoSiPremiereVisite(profil) {
  if (profil && !profil.tuto_vu) montrerTuto();
}
