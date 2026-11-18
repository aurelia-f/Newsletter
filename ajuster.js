// ==========================================================
//  ajuster.js · forcer le A4
//  Une page = une feuille A4, jamais deux. Si le contenu dépasse,
//  on le réduit jusqu'à ce qu'il rentre, plutôt que de le couper
//  ou de le renvoyer à la page suivante.
//  Ce qu'on voit à l'écran est donc exactement ce qui sort en PDF.
// ==========================================================

// A4 à 96 points par pouce : 210 × 297 mm.
export const A4_LARGE = 794;
export const A4_HAUT  = 1123;

const PLANCHER = 0.45;   // en dessous, ce serait illisible
const MARGE    = 2;      // deux pixels de sécurité

/**
 * Réduit le corps de chaque page jusqu'à ce qu'il tienne.
 * @param {HTMLElement} racine  le conteneur .journal
 */
export function ajusterPages(racine) {
  if (!racine) return;
  racine.querySelectorAll('.jr-page').forEach(ajusterUnePage);
}

function ajusterUnePage(page) {
  const corps = page.querySelector('.jr-corps');
  if (!corps) return;

  // On repart de la taille normale avant de mesurer.
  corps.style.zoom = '';
  corps.style.removeProperty('--jr-reduction');

  const dispo = placeDisponible(page);
  if (dispo <= 0) return;

  let besoin = corps.scrollHeight;
  if (besoin <= dispo + MARGE) return;        // ça rentre déjà

  // Deux passes : la première estime, la seconde corrige ce que
  // le retour à la ligne a changé.
  let facteur = Math.max(PLANCHER, dispo / besoin);
  corps.style.zoom = arrondi(facteur);

  besoin = corps.scrollHeight;
  if (besoin > dispo) {
    facteur = Math.max(PLANCHER, facteur * (dispo / besoin));
    corps.style.zoom = arrondi(facteur);
  }

  // On garde la trace de la réduction : utile pour prévenir la
  // personne quand sa page est vraiment trop chargée.
  page.dataset.reduction = Math.round(facteur * 100);
}

/** La hauteur qu'il reste au corps, une fois l'en-tête et le pied posés. */
function placeDisponible(page) {
  const style = getComputedStyle(page);
  const hauteur = page.clientHeight
    - parseFloat(style.paddingTop)
    - parseFloat(style.paddingBottom);
  const tete = page.querySelector('.jr-tete')?.offsetHeight ?? 0;
  const pied = page.querySelector('.jr-pied')?.offsetHeight ?? 0;
  return hauteur - tete - pied - MARGE;
}

function arrondi(f) {
  return String(Math.floor(f * 1000) / 1000);
}

/**
 * Rebranche l'ajustement sur tout ce qui peut changer la hauteur :
 * les images qui finissent de charger, le redimensionnement de la
 * fenêtre, et le moment où l'on imprime.
 */
export function surveillerPages(racine) {
  if (!racine) return;

  const relancer = () => ajusterPages(racine);
  relancer();

  racine.querySelectorAll('img').forEach(img => {
    if (!img.complete) img.addEventListener('load', relancer, { once: true });
    img.addEventListener('error', relancer, { once: true });
  });

  // Les polices du journal arrivent souvent après le premier calcul.
  document.fonts?.ready.then(relancer);

  let minuteur;
  const auRedimensionnement = () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(relancer, 150);
  };
  window.addEventListener('resize', auRedimensionnement);
  window.addEventListener('beforeprint', relancer);

  return () => {
    window.removeEventListener('resize', auRedimensionnement);
    window.removeEventListener('beforeprint', relancer);
  };
}

/**
 * Sur téléphone, la feuille A4 ne tient pas dans l'écran : on la
 * réduit en entier, cadre compris, pour garder les proportions.
 */
export function adapterALEcran(racine) {
  if (!racine) return;
  const large = racine.clientWidth;
  const facteur = Math.min(1, large / A4_LARGE);
  racine.style.setProperty('--jr-echelle', String(facteur));
  racine.classList.toggle('jr-reduit', facteur < 1);
}
