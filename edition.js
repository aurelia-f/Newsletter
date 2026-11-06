// ==========================================================
//  Page : edition.html?id=… — le magazine
// ==========================================================
import { exigerSession, brancherDeconnexion, afficherErreur,
         edition, reponsesPubliees } from './db.js';
import { NOM_DU_SITE } from './config.js';
import { $, txt, moisEnLettres, messageVide, lecteurMusique } from './ui.js';

const vue = $('#vue');
const editionId = new URLSearchParams(location.search).get('id');

if (await exigerSession()) {
  brancherDeconnexion();
  try { await afficher(); } catch (err) { afficherErreur(err); }
}

async function afficher() {
  const ed = await edition(editionId);
  const reponses = await reponsesPubliees(editionId);

  document.title = `Entre Nous — ${moisEnLettres(ed.mois)}`;

  const articles = reponses.length
    ? reponses.map(r => {
        const nom = r.auteure?.prenom || r.auteure?.email?.split('@')[0] || 'Une copine';
        const rubriques = ed.questions.map(q => {
          if (q.type === 'photos') {
            if (!r.medias?.length) return '';
            return `<div class="rubrique">
              <div class="intitule">${txt(q.intitule)}</div>
              <div class="galerie">${r.medias.map(m => m.type === 'video'
                ? `<video src="${txt(m.url)}" controls playsinline></video>`
                : `<img src="${txt(m.url)}" alt="" loading="lazy">`).join('')}</div>
            </div>`;
          }
          const v = r.contenu?.[q.id];
          if (!v) return '';
          if (q.type === 'musique') {
            return `<div class="rubrique">
              <div class="intitule">${txt(q.intitule)}</div>
              <p>${txt(v)}</p>
              ${lecteurMusique(r.contenu[q.id + '_lien'])}
            </div>`;
          }
          return `<div class="rubrique">
            <div class="intitule">${txt(q.intitule)}</div>
            <p>${txt(v)}</p>
          </div>`;
        }).join('');

        return `<article class="article">
          <div class="signature">
            <span class="pastille">${txt(nom.charAt(0).toUpperCase())}</span>
            <div><h2 style="font-size:1.4rem">${txt(nom)}</h2></div>
          </div>
          ${rubriques}
        </article>`;
      }).join('<div class="separateur">· · ·</div>')
    : messageVide('🕊️', 'Personne n\'a encore répondu');

  vue.innerHTML = `
    <div class="page">
      <a href="groupe.html?id=${encodeURIComponent(ed.groupe.id)}" class="discret no-print">← ${txt(ed.groupe.nom)}</a>
      <div class="couverture">
        <img class="logo" src="logo.png" alt="">
        <span class="numero">Numéro ${ed.numero} · ${txt(ed.groupe.nom)}</span>
        <h1>${txt(NOM_DU_SITE)}</h1>
        <p class="mois">${txt(moisEnLettres(ed.mois))}</p>
      </div>
      ${articles}
      <div class="rangee no-print" style="justify-content:center;margin-top:30px">
        <button class="btn fil" id="btn-pdf">Enregistrer en PDF</button>
      </div>
    </div>`;

  $('#btn-pdf').addEventListener('click', () => window.print());
}
