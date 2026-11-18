// ==========================================================
//  journal.js · le rendu « vrai journal »
//  Une page par personne. L'en-tête et le pied sont VERROUILLÉS :
//  ils ne changent jamais, quel que soit le gabarit.
//  Ce qui change d'une personne à l'autre, c'est la mise en page
//  du corps : cinq gabarits, tirés des inspirations.
// ==========================================================
import { txt, moisEnLettres, lecteurMusique } from './ui.js';
import { NOM_DU_SITE } from './config.js';

// Les cinq gabarits, dans l'ordre où ils sont distribués.
export const GABARITS = [
  'g-classique', // colonne étroite encadrée + photo dominante
  'g-edit',      // chapeau en petites capitales, deux colonnes, photo à droite
  'g-lettrine',  // grande lettrine, texte pleine largeur, photos en bas
  'g-retro',     // photo verticale à gauche, encadrés à droite
  'g-urbain',    // photo pleine largeur, trois colonnes serrées
];

// Même personne, même numéro → même gabarit (pas de saute d'humeur
// au rechargement). Mais deux personnes voisines n'ont jamais le
// même, et le gabarit tourne d'un mois à l'autre.
export function gabaritPour(index, graine) {
  return GABARITS[(index + graine) % GABARITS.length];
}

function graineDuNumero(ed) {
  return Number(ed.numero) || 0;
}

/* ==========================================================
   LA PAGE D'UNE PERSONNE
   ========================================================== */
export function pageJournal(r, ed, index, membres, posees, pied) {
  const nom = r.auteure?.prenom || r.auteure?.email?.split('@')[0] || 'Une copine';
  const gabarit = gabaritPour(index, graineDuNumero(ed));
  const p = decouper(r, ed, posees, nom);

  return `<article class="jr-page ${gabarit}" data-reponse="${txt(r.id)}">
    ${enTete(ed, nom)}
    <div class="jr-corps">
      ${p.photo}
      <div class="jr-flot">
        ${p.chapeau}
        ${p.citation}
        ${p.blocs}
      </div>
      ${p.galerie}
    </div>
    ${piedDePage(ed, pied)}
  </article>`;
}

/* ==========================================================
   EN-TÊTE VERROUILLÉ — ne jamais modifier la structure
   ========================================================== */
function enTete(ed, nom) {
  return `<div class="jr-tete">
    <div class="jr-ligne-haute">
      <span>${txt(moisEnLettres(ed.mois))}</span>
      <span class="jr-marque"><img src="logo.png" alt="">${txt(NOM_DU_SITE)}</span>
    </div>
    <div class="jr-filet"></div>
    <h1 class="jr-manchette">${txt(ed.groupe.nom)}</h1>
    <div class="jr-filet jr-double"></div>
    <div class="jr-personne">${txt(nom)}</div>
    <div class="jr-filet"></div>
  </div>`;
}

/* ==========================================================
   PIED VERROUILLÉ
   ========================================================== */
function piedDePage(ed, pied) {
  return `<div class="jr-pied">
    <span>${txt(pied)}</span>
    <span>Édition numéro ${txt(ed.numero)}</span>
  </div>`;
}

/* ==========================================================
   On découpe la réponse en morceaux de journal
   ========================================================== */
function decouper(r, ed, posees, nom) {
  const contenu = r.contenu || {};
  const medias = r.medias || [];
  const images = medias.filter(m => m.type !== 'video');

  // 1. La photo du mois : la première image envoyée, sinon l'avatar.
  const principale = images[0]?.url || r.auteure?.avatar_url || null;
  const legende = [r.auteure?.occupation, r.auteure?.ville].filter(Boolean).join(' · ')
                  || `${nom}, ce mois-ci`;

  const photo = principale
    ? `<figure class="jr-photo">
         <img src="${txt(principale)}" alt="" loading="lazy">
         <figcaption>${txt(legende)}</figcaption>
       </figure>`
    : `<figure class="jr-photo jr-photo-vide">
         <div class="jr-cadre-vide">pas de photo ce mois-ci</div>
       </figure>`;

  // 2. Le chapeau : le résumé du mois, mis en avant.
  const resume = contenu.resume;
  const chapeau = resume
    ? `<p class="jr-chapeau">${txt(resume)}</p>`
    : '';

  // 3. La citation : la devise du profil, ou le potin.
  const motFort = r.auteure?.devise || contenu.victoire || null;
  const citation = motFort
    ? `<blockquote class="jr-citation">${txt(motFort)}</blockquote>`
    : '';

  // 4. Les rubriques, sauf celles déjà servies plus haut.
  const servies = new Set(['resume', 'photos']);
  const blocsRubriques = (ed.questions || [])
    .filter(q => !servies.has(q.id))
    .map(q => bloc(q, r))
    .filter(Boolean);

  const blocsQuestions = (posees || []).map(q => {
    const valeur = r.contenu?.['q_' + q.id];
    if (!valeur) return '';
    const deQui = q.auteur?.prenom || 'une copine';
    const signature = q.destinataire_id
      ? `${deQui} lui demande`
      : `${deQui} demande au groupe`;
    return `<section class="jr-bloc jr-bloc-question">
      <h3 class="jr-titre-bloc">${txt(signature)}</h3>
      <p class="jr-question">${txt(q.texte)}</p>
      <p class="jr-texte">${txt(valeur)}</p>
    </section>`;
  }).filter(Boolean);

  // 5. Les photos restantes et les vidéos, en bas de page.
  const reste = medias.slice(principale === images[0]?.url ? 1 : 0);
  const galerie = reste.length
    ? `<div class="jr-galerie">${reste.map(m => m.type === 'video'
        ? `<video src="${txt(m.url)}" controls playsinline></video>`
        : `<img src="${txt(m.url)}" alt="" loading="lazy">`).join('')}</div>`
    : '';

  return {
    photo, chapeau, citation, galerie,
    blocs: blocsRubriques.concat(blocsQuestions).join(''),
  };
}

/* ==========================================================
   Un bloc de rubrique, selon son type
   ========================================================== */
function bloc(q, r) {
  const v = r.contenu?.[q.id];
  const intitule = r.contenu?.[q.id + '_intitule'] || q.intitule;
  const titre = `<h3 class="jr-titre-bloc">${txt(intitule)}</h3>`;

  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '';

  const enveloppe = (corps, classe = '') =>
    `<section class="jr-bloc ${classe}">${titre}${corps}</section>`;

  switch (q.type) {
    case 'musique':
      return enveloppe(`<p class="jr-texte">${txt(v)}</p>
        <div class="no-print">${lecteurMusique(r.contenu[q.id + '_lien'])}</div>`);

    case 'qcm':
      return enveloppe(`<p class="jr-verdict">${txt(v)}</p>`, 'jr-bloc-encadre');

    case 'multi':
      return enveloppe(`<p class="jr-liste-choix">${(Array.isArray(v) ? v : [v])
        .map(c => `<span>${txt(c)}</span>`).join('')}</p>`);

    case 'emojis':
      return enveloppe(`<p class="jr-emojis">${(Array.isArray(v) ? v : [v])
        .map(e => txt(e)).join(' ')}</p>`, 'jr-bloc-encadre');

    case 'mot':
      return enveloppe(`<p class="jr-un-mot">${txt(v)}</p>`, 'jr-bloc-encadre');

    case 'note': {
      const n = Math.max(0, Math.min(5, Number(v) || 0));
      return enveloppe(`<p class="jr-etoiles">${'★'.repeat(n)}<span class="jr-vides">${
        '★'.repeat(5 - n)}</span></p>`, 'jr-bloc-encadre');
    }

    case 'curseur': {
      const min = q.min ?? 0, max = q.max ?? 10;
      const pourcent = Math.round(((Number(v) - min) / (max - min)) * 100);
      return enveloppe(`
        <div class="jr-jauge"><div style="width:${pourcent}%"></div></div>
        <p class="jr-legende">${txt(v)} sur ${max}</p>`, 'jr-bloc-encadre');
    }

    default:
      return enveloppe(`<p class="jr-texte">${txt(v)}</p>`);
  }
}

/* ==========================================================
   LA UNE DU NUMÉRO : la page qui ouvre le journal
   ========================================================== */
export function uneDuNumero(ed, reponses, membres) {
  const portraits = reponses.map(r => {
    const nom = r.auteure?.prenom || 'Une copine';
    const img = (r.medias || []).find(m => m.type !== 'video')?.url
             || r.auteure?.avatar_url;
    return `<figure class="jr-portrait">
      ${img ? `<img src="${txt(img)}" alt="" loading="lazy">`
            : `<div class="jr-cadre-vide">${txt(nom.charAt(0).toUpperCase())}</div>`}
      <figcaption>${txt(nom)}</figcaption>
    </figure>`;
  }).join('');

  const sommaire = reponses
    .map(r => txt(r.auteure?.prenom || 'Une copine'))
    .join(' · ');

  return `<article class="jr-page jr-une">
    <div class="jr-tete">
      <div class="jr-ligne-haute">
        <span>${txt(moisEnLettres(ed.mois))}</span>
        <span class="jr-marque"><img src="logo.png" alt="">${txt(NOM_DU_SITE)}</span>
      </div>
      <div class="jr-filet"></div>
      <h1 class="jr-manchette jr-manchette-une">${txt(ed.groupe.nom)}</h1>
      <div class="jr-filet jr-double"></div>
      <div class="jr-personne">Le numéro du mois</div>
      <div class="jr-filet"></div>
    </div>
    <div class="jr-corps">
      <p class="jr-chapeau jr-chapeau-une">
        ${reponses.length} page${reponses.length > 1 ? 's' : ''} ce mois-ci.
        Une par personne, à lire dans l'ordre ou dans le désordre.
      </p>
      <div class="jr-portraits">${portraits}</div>
      <p class="jr-sommaire">${sommaire}</p>
    </div>
    <div class="jr-pied">
      <span>${txt(sommaire)}</span>
      <span>Édition numéro ${txt(ed.numero)}</span>
    </div>
  </article>`;
}
