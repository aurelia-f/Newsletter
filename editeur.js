// ==========================================================
//  editeur.js · ranger sa page comme on veut
//  On ne touche qu'à SA page : on déplace les blocs, on change
//  leur largeur, et on enregistre. L'en-tête et le pied ne
//  bougent jamais.
// ==========================================================
import { enregistrerMiseEnPage } from './db.js';

const LARGEURS = [
  { n: 2, libelle: '⅓' },
  { n: 3, libelle: '½' },
  { n: 4, libelle: '⅔' },
  { n: 6, libelle: 'Pleine' },
];

let page = null;      // la feuille en cours d'édition
let choisi = null;    // le bloc sélectionné
let barre = null;     // la barre d'outils flottante
let surFin = null;    // ce qu'on appelle quand on a fini

/**
 * Passe une page en mode édition.
 * @param {HTMLElement} article  la feuille .jr-page de la personne
 * @param {string} reponseId     l'identifiant de sa réponse
 * @param {Function} auRetour    rappelé après « Terminer »
 */
export function ouvrirEditeur(article, reponseId, auRetour) {
  fermerEditeur();
  page = article;
  surFin = auRetour;
  page.classList.add('jr-edition');

  // Le gabarit automatique devient une grille, sinon rien ne bouge.
  const corps = page.querySelector('.jr-corps');
  if (!corps.classList.contains('jr-grille')) enGrille(corps);

  corps.querySelectorAll('.jr-case').forEach(preparer);
  corps.addEventListener('dragover', surVolSurvol);
  page.addEventListener('click', surClicAilleurs);

  barre = construireBarre(reponseId);
  document.body.appendChild(barre);
  page.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function fermerEditeur() {
  if (barre) { barre.remove(); barre = null; }
  if (page) {
    page.classList.remove('jr-edition');
    page.removeEventListener('click', surClicAilleurs);
    page.querySelector('.jr-corps')?.removeEventListener('dragover', surVolSurvol);
    page = null;
  }
  choisi = null;
}

/* ----------------------------------------------------------
   Transformer un gabarit automatique en grille rangeable
   ---------------------------------------------------------- */
function enGrille(corps) {
  const cases = [];

  const envelopper = (el, id, large) => {
    const boite = document.createElement('div');
    boite.className = 'jr-case';
    boite.dataset.bloc = id;
    boite.dataset.large = large;
    boite.style.gridColumn = 'span ' + large;
    boite.appendChild(el);
    cases.push(boite);
  };

  const photo = corps.querySelector(':scope > .jr-photo');
  if (photo) envelopper(photo, 'photo', 3);

  const flot = corps.querySelector(':scope > .jr-flot');
  if (flot) {
    const chapeau = flot.querySelector(':scope > .jr-chapeau');
    if (chapeau) envelopper(chapeau, 'chapeau', 3);
    const citation = flot.querySelector(':scope > .jr-citation');
    if (citation) envelopper(citation, 'citation', 6);
    flot.querySelectorAll(':scope > .jr-bloc').forEach((b, i) =>
      envelopper(b, b.dataset.id || identifiant(b, i), 2));
    flot.remove();
  }

  const galerie = corps.querySelector(':scope > .jr-galerie');
  if (galerie) envelopper(galerie, 'galerie', 6);

  corps.innerHTML = '';
  corps.classList.add('jr-grille');
  cases.forEach(c => corps.appendChild(c));
}

// Les blocs du gabarit n'ont pas d'identifiant dans le HTML : on en
// fabrique un à partir de leur titre, stable d'un mois à l'autre.
function identifiant(bloc, i) {
  const titre = bloc.querySelector('.jr-titre-bloc')?.textContent?.trim() || '';
  return titre
    ? 't_' + titre.toLowerCase().normalize('NFD')
        .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').slice(0, 40)
    : 'bloc_' + i;
}

/* ----------------------------------------------------------
   Sélection et glisser-déposer
   ---------------------------------------------------------- */
function preparer(boite) {
  boite.draggable = true;
  boite.insertAdjacentHTML('afterbegin',
    '<span class="jr-poignee" title="Glisse-moi">⠿</span>');

  boite.addEventListener('click', e => { e.stopPropagation(); selectionner(boite); });
  boite.addEventListener('dragstart', e => {
    boite.classList.add('jr-vol');
    selectionner(boite);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox exige qu'on écrive quelque chose.
    e.dataTransfer.setData('text/plain', boite.dataset.bloc);
  });
  boite.addEventListener('dragend', () => boite.classList.remove('jr-vol'));
}

function surVolSurvol(e) {
  e.preventDefault();
  const corps = e.currentTarget;
  const enVol = corps.querySelector('.jr-vol');
  if (!enVol) return;
  const apres = voisinLePlusProche(corps, e.clientX, e.clientY);
  if (apres == null) corps.appendChild(enVol);
  else if (apres !== enVol) corps.insertBefore(enVol, apres);
}

function voisinLePlusProche(corps, x, y) {
  const autres = [...corps.querySelectorAll('.jr-case:not(.jr-vol)')];
  let meilleur = null, distance = Infinity;
  for (const el of autres) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const d = Math.hypot(x - cx, y - cy);
    if (d < distance) {
      distance = d;
      meilleur = (y < cy || (Math.abs(y - cy) < r.height / 2 && x < cx))
        ? el : el.nextElementSibling;
    }
  }
  return meilleur;
}

function selectionner(boite) {
  page.querySelectorAll('.jr-case.jr-choisi').forEach(b => b.classList.remove('jr-choisi'));
  boite.classList.add('jr-choisi');
  choisi = boite;
  majBarre();
}

function surClicAilleurs(e) {
  if (e.target.closest('.jr-case')) return;
  page.querySelectorAll('.jr-case.jr-choisi').forEach(b => b.classList.remove('jr-choisi'));
  choisi = null;
  majBarre();
}

/* ----------------------------------------------------------
   La barre d'outils, en bas de l'écran
   ---------------------------------------------------------- */
function construireBarre(reponseId) {
  const el = document.createElement('div');
  el.className = 'jr-barre no-print';
  el.innerHTML = `
    <span class="jr-barre-aide">Glisse un bloc pour le déplacer, clique dessus pour le redimensionner.</span>
    <span class="jr-barre-largeurs">
      ${LARGEURS.map(l => `<button type="button" class="btn fil petit" data-large="${l.n}"
                            disabled>${l.libelle}</button>`).join('')}
    </span>
    <button type="button" class="btn doux petit" id="jr-auto">Remettre le gabarit</button>
    <button type="button" class="btn petit" id="jr-garder">Garder cette mise en page</button>
    <span class="jr-barre-etat" id="jr-etat"></span>`;

  el.querySelectorAll('[data-large]').forEach(b =>
    b.addEventListener('click', () => {
      if (!choisi) return;
      choisi.dataset.large = b.dataset.large;
      choisi.style.gridColumn = 'span ' + b.dataset.large;
      majBarre();
    }));

  el.querySelector('#jr-garder').addEventListener('click', () => garder(reponseId, el));
  el.querySelector('#jr-auto').addEventListener('click', () => remettre(reponseId, el));
  return el;
}

function majBarre() {
  if (!barre) return;
  barre.querySelectorAll('[data-large]').forEach(b => {
    b.disabled = !choisi;
    b.classList.toggle('fil', !choisi || choisi.dataset.large !== b.dataset.large);
  });
}

async function garder(reponseId, el) {
  const etat = el.querySelector('#jr-etat');
  const blocs = [...page.querySelectorAll('.jr-case')].map(b => ({
    id: b.dataset.bloc,
    large: Number(b.dataset.large) || 2,
  }));
  etat.textContent = 'on enregistre…';
  try {
    await enregistrerMiseEnPage(reponseId, { libre: true, blocs });
    etat.textContent = 'c\'est gardé';
    fermerEditeur();
    surFin?.();
  } catch (err) {
    etat.textContent = err.message;
  }
}

async function remettre(reponseId, el) {
  const etat = el.querySelector('#jr-etat');
  etat.textContent = 'on remet le gabarit…';
  try {
    await enregistrerMiseEnPage(reponseId, null);
    fermerEditeur();
    surFin?.();
  } catch (err) {
    etat.textContent = err.message;
  }
}
