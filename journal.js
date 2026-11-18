// ==========================================================
//  journal.js · le rendu « vrai journal »
//  Une page par personne. L'en-tête et le pied sont VERROUILLÉS :
//  ils ne changent jamais, quel que soit le gabarit.
//
//  Deux façons de monter le corps de la page :
//    · le gabarit automatique, différent pour chaque personne ;
//    · la mise en page libre, dès que la personne a déplacé un
//      bloc elle-même (voir editeur.js).
// ==========================================================
import { txt, moisEnLettres, lecteurMusique } from './ui.js';
import { NOM_DU_SITE } from './config.js';

// Les cinq gabarits, dans l'ordre où ils sont distribués.
export const GABARITS = [
  'g-classique', // colonne étroite encadrée + photo dominante
  'g-edit',      // chapeau en italique, deux colonnes, photo à droite
  'g-lettrine',  // grande lettrine, texte pleine largeur, photos en bas
  'g-retro',     // photo verticale à gauche, encadrés à droite
  'g-urbain',    // photo pleine largeur, trois colonnes serrées
];

// Même personne, même numéro → même gabarit. Mais deux personnes
// voisines n'ont jamais le même, et ça tourne d'un mois à l'autre.
export function gabaritPour(index, graine) {
  return GABARITS[(index + graine) % GABARITS.length];
}

/* ==========================================================
   LA PAGE D'UNE PERSONNE
   ========================================================== */
export function pageJournal(r, ed, index, membres, posees, pied) {
  const nom = r.auteure?.prenom || r.auteure?.email?.split('@')[0] || 'Une copine';
  const morceaux = decouper(r, ed, posees, nom);
  const range = r.mise_en_page?.libre === true;

  const corps = range
    ? corpsLibre(morceaux, r.mise_en_page.blocs || [])
    : corpsGabarit(morceaux);

  const classe = range ? 'g-libre' : gabaritPour(index, Number(ed.numero) || 0);

  return `<article class="jr-page ${classe}" data-reponse="${txt(r.id)}"
                   data-auteure="${txt(r.profile_id || '')}">
    <div class="jr-fit">
      ${enTete(ed, nom)}
      ${corps}
      ${piedDePage(ed, pied)}
    </div>
  </article>`;
}

/* ---------- Le corps monté par le gabarit ---------- */
function corpsGabarit(m) {
  const flot = [m.chapeau, m.citation, ...m.blocs.map(b => b.html)]
    .filter(Boolean).join('');
  return `<div class="jr-corps">
    ${m.photo}
    <div class="jr-flot">${flot}</div>
    ${m.galerie}
  </div>`;
}

/* ---------- Le corps rangé à la main ---------- */
function corpsLibre(m, ordre) {
  const parId = new Map();
  if (m.photo)    parId.set('photo',    { html: m.photo,    large: 3 });
  if (m.chapeau)  parId.set('chapeau',  { html: m.chapeau,  large: 3 });
  if (m.citation) parId.set('citation', { html: m.citation, large: 6 });
  for (const b of m.blocs) parId.set(b.id, { html: b.html, large: 2 });
  if (m.galerie)  parId.set('galerie',  { html: m.galerie,  large: 6 });

  const cases = [];
  const vus = new Set();

  // D'abord ce que la personne a rangé, dans son ordre à elle.
  for (const item of ordre) {
    const bloc = parId.get(item.id);
    if (!bloc || vus.has(item.id)) continue;
    vus.add(item.id);
    cases.push(caseLibre(item.id, bloc.html, item.large || bloc.large));
  }
  // Puis ce qui est arrivé depuis : une nouvelle question, par exemple.
  for (const [id, bloc] of parId) {
    if (vus.has(id)) continue;
    cases.push(caseLibre(id, bloc.html, bloc.large));
  }

  return `<div class="jr-corps jr-grille">${cases.join('')}</div>`;
}

function caseLibre(id, html, large) {
  const n = Math.min(6, Math.max(1, Number(large) || 2));
  return `<div class="jr-case" data-bloc="${txt(id)}" data-large="${n}"
               style="grid-column:span ${n}">${html}</div>`;
}

/* ==========================================================
   EN-TÊTE VERROUILLÉ — ne jamais modifier la structure
   ========================================================== */
function enTete(ed, nom) {
  return `<div class="jr-tete">
    <div class="jr-ligne-haute">
      <span>${txt(moisEnLettres(ed.mois))}</span>
      <span class="jr-marque"><img src="logo-journal.png" alt="">${txt(NOM_DU_SITE)}</span>
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

  // La photo de la page : la première photo du mois. La photo de
  // profil sert à la une, pour que les deux soient différentes.
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

  const resume = contenu.resume;
  const chapeau = resume ? `<p class="jr-chapeau">${txt(resume)}</p>` : '';

  const motFort = r.auteure?.devise || contenu.victoire || null;
  const citation = motFort ? `<blockquote class="jr-citation">${txt(motFort)}</blockquote>` : '';

  // Les rubriques, sauf celles déjà servies plus haut.
  const servies = new Set(['resume', 'photos', 'photo_garde']);
  const blocs = (ed.questions || [])
    .filter(q => !servies.has(q.id))
    .map(q => ({ id: q.id, html: bloc(q, r) }))
    .filter(b => b.html);

  // Les questions posées par les copines.
  for (const q of posees || []) {
    const valeur = r.contenu?.['q_' + q.id];
    if (!valeur) continue;
    const deQui = q.auteur?.prenom || 'une copine';
    const signature = q.destinataire_id ? `${deQui} lui demande` : `${deQui} demande au groupe`;
    blocs.push({
      id: 'q_' + q.id,
      html: `<section class="jr-bloc jr-bloc-question" data-id="q_${txt(q.id)}">
        <h3 class="jr-titre-bloc">${txt(signature)}</h3>
        <p class="jr-question">${txt(q.texte)}</p>
        <p class="jr-texte">${txt(valeur)}</p>
      </section>`,
    });
  }

  // Les photos restantes et les vidéos, en bas de page.
  const reste = medias.slice(images.length && principale === images[0].url ? 1 : 0);
  const galerie = reste.length
    ? `<div class="jr-galerie">${reste.map(m => m.type === 'video'
        ? `<video src="${txt(m.url)}" controls playsinline></video>`
        : `<img src="${txt(m.url)}" alt="" loading="lazy">`).join('')}</div>`
    : '';

  return { photo, chapeau, citation, galerie, blocs };
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
    `<section class="jr-bloc ${classe}" data-id="${txt(q.id)}">${titre}${corps}</section>`;

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
    // Sur la une : la photo de couverture si elle en a choisi une,
    // sinon sa photo de profil. La photo du mois, elle, garde sa
    // surprise pour sa page à elle.
    const img = r.contenu?.photo_garde
             || r.auteure?.avatar_url
             || (r.medias || []).find(m => m.type !== 'video')?.url;
    return `<figure class="jr-portrait">
      ${img ? `<img src="${txt(img)}" alt="" loading="lazy">`
            : `<div class="jr-cadre-vide">${txt(nom.charAt(0).toUpperCase())}</div>`}
      <figcaption>${txt(nom)}</figcaption>
    </figure>`;
  }).join('');

  const sommaire = reponses.map(r => txt(r.auteure?.prenom || 'Une copine')).join(' · ');

  return `<article class="jr-page jr-une">
    <div class="jr-fit">
    <div class="jr-tete">
      <div class="jr-ligne-haute">
        <span>${txt(moisEnLettres(ed.mois))}</span>
        <span class="jr-marque"><img src="logo-journal.png" alt="">${txt(NOM_DU_SITE)}</span>
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
    </div>
  </article>`;
}

/* ==========================================================
   TENIR SUR UNE SEULE FEUILLE
   La feuille fait exactement un A4. Si le contenu dépasse, on le
   réduit jusqu'à ce qu'il rentre — jamais de page coupée en deux.
   ========================================================== */
export function ajusterPages(racine = document) {
  for (const page of racine.querySelectorAll('.jr-page')) {
    const fit = page.querySelector(':scope > .jr-fit');
    if (!fit) continue;

    // On remet à l'échelle 1 pour mesurer la hauteur réelle.
    fit.style.transform = 'none';
    fit.style.width = '100%';

    const dispo = page.clientHeight;
    const haut  = fit.scrollHeight;
    if (!dispo || !haut) continue;

    // 0.55 : en dessous, le texte serait illisible ; mieux vaut
    // alors laisser déborder que rendre la page inutilisable.
    const k = Math.min(1, Math.max(0.55, dispo / haut));
    if (k >= 0.999) { fit.style.removeProperty('transform'); return; }

    fit.style.transform = `scale(${k})`;
    fit.style.width = (100 / k) + '%';
  }
}

/** Les photos faussent la mesure tant qu'elles ne sont pas chargées. */
export async function ajusterQuandPret(racine = document) {
  ajusterPages(racine);
  const images = [...racine.querySelectorAll('.jr-page img')];
  await Promise.all(images.map(img => img.complete
    ? Promise.resolve()
    : new Promise(ok => { img.addEventListener('load', ok, { once: true });
                          img.addEventListener('error', ok, { once: true }); })));
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch {} }
  ajusterPages(racine);
}
