// ==========================================================
//  Page : edition.html?id=… — le magazine
// ==========================================================
import { exigerSession, brancherEntete, afficherErreur,
         edition, reponsesPubliees, questionsPosees, membresDuGroupe,
         reactionsDesReponses, enregistrerReaction, editionIlYaUnAn } from './db.js';
import { NOM_DU_SITE, EMOJIS_REACTION } from './config.js';
import { $, txt, moisEnLettres, messageVide, lecteurMusique, initiale } from './ui.js';

const vue = $('#vue');
const editionId = new URLSearchParams(location.search).get('id');

let moi = null;

if (await exigerSession()) {
  moi = await brancherEntete();
  try { await afficher(); } catch (err) { afficherErreur(err); }
}

async function afficher() {
  const ed = await edition(editionId);
  const reponses = await reponsesPubliees(editionId);

  const [posees, membres, reactions, ilYaUnAn] = await Promise.all([
    questionsPosees(editionId),
    membresDuGroupe(ed.groupe.id),
    reactionsDesReponses(reponses.map(r => r.id)),
    editionIlYaUnAn(ed.groupe.id, ed.mois),
  ]);

  document.title = `Entre Nous — ${moisEnLettres(ed.mois)}`;

  const moisDuNumero = Number(String(ed.mois).slice(5, 7));

  const articles = reponses.length
    ? reponses.map(r => article(r, ed, posees, reactions)).join('<div class="separateur">· · ·</div>')
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

      ${pageAnniversaires(membres, moisDuNumero)}
      ${articles}
      ${pageIlYaUnAn(ilYaUnAn)}

      <div class="rangee no-print" style="justify-content:center;margin-top:30px">
        <button class="btn fil" id="btn-pdf">Enregistrer en PDF</button>
      </div>
    </div>`;

  $('#btn-pdf').addEventListener('click', () => window.print());
  brancherReactions();
}

/* ==========================================================
   La page de chaque copine
   ========================================================== */
function article(r, ed, posees, reactions) {
  const nom = r.auteure?.prenom || r.auteure?.email?.split('@')[0] || 'Une copine';
  const vignette = r.auteure?.avatar_url
    ? `<img src="${txt(r.auteure.avatar_url)}" alt="">`
    : `<span>${txt(nom.charAt(0).toUpperCase())}</span>`;

  // Les rubriques du numéro.
  const rubriques = ed.questions.map(q => rubrique(q, r)).join('');

  // Les questions posées par les copines, auxquelles elle a répondu.
  const questionsRepondues = posees.map(q => {
    const valeur = r.contenu?.['q_' + q.id];
    if (!valeur) return '';
    const deQui = q.auteur?.prenom || 'une copine';
    const signature = q.destinataire_id
      ? `Question de ${deQui}, posée à ${q.destinataire?.prenom || nom}`
      : `Question de ${deQui} au groupe`;
    return `<div class="rubrique rubrique-question">
      <div class="intitule">${txt(signature)}</div>
      <p class="question-posee">${txt(q.texte)}</p>
      <p>${txt(valeur)}</p>
    </div>`;
  }).join('');

  return `<article class="article" data-reponse="${txt(r.id)}">
    <div class="signature">
      <span class="pastille">${vignette}</span>
      <div>
        <h2 style="font-size:1.4rem">${txt(nom)}</h2>
        ${r.auteure?.ville ? `<p class="discret" style="margin:0">${txt(r.auteure.ville)}</p>` : ''}
      </div>
    </div>
    ${rubriques}
    ${questionsRepondues}
    ${barreReactions(r, reactions)}
  </article>`;
}

/* ==========================================================
   Une rubrique, selon son type
   ========================================================== */
function rubrique(q, r) {
  const v = r.contenu?.[q.id];

  // La question des fêtes n'a pas la même formulation pour tout le
  // monde : on réaffiche celle que la personne a réellement vue.
  const intitule = r.contenu?.[q.id + '_intitule'] || q.intitule;
  const entete = `<div class="intitule">${txt(intitule)}</div>`;

  if (q.type === 'photos') {
    if (!r.medias?.length) return '';
    return `<div class="rubrique">${entete}
      <div class="galerie">${r.medias.map(m => m.type === 'video'
        ? `<video src="${txt(m.url)}" controls playsinline></video>`
        : `<img src="${txt(m.url)}" alt="" loading="lazy">`).join('')}</div>
    </div>`;
  }

  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '';

  switch (q.type) {
    case 'musique':
      return `<div class="rubrique">${entete}
        <p>${txt(v)}</p>
        ${lecteurMusique(r.contenu[q.id + '_lien'])}
      </div>`;

    case 'qcm':
      return `<div class="rubrique">${entete}
        <p><span class="reponse-choix">${txt(v)}</span></p>
      </div>`;

    case 'multi':
      return `<div class="rubrique">${entete}
        <p>${(Array.isArray(v) ? v : [v]).map(c =>
          `<span class="reponse-choix">${txt(c)}</span>`).join(' ')}</p>
      </div>`;

    case 'emojis':
      return `<div class="rubrique">${entete}
        <p class="grands-emojis">${(Array.isArray(v) ? v : [v]).map(e => txt(e)).join(' ')}</p>
      </div>`;

    case 'mot':
      return `<div class="rubrique">${entete}
        <p class="un-mot">${txt(v)}</p>
      </div>`;

    case 'note': {
      const n = Number(v);
      return `<div class="rubrique">${entete}
        <p class="etoiles-lecture">${'★'.repeat(n)}<span class="vides">${'★'.repeat(5 - n)}</span></p>
      </div>`;
    }

    case 'curseur': {
      const min = q.min ?? 0, max = q.max ?? 10;
      const pourcent = Math.round(((Number(v) - min) / (max - min)) * 100);
      return `<div class="rubrique">${entete}
        <div class="jauge"><div class="jauge-remplie" style="width:${pourcent}%"></div></div>
        <p class="discret" style="margin-top:3px">${txt(v)} sur ${max}</p>
      </div>`;
    }

    default:
      return `<div class="rubrique">${entete}<p>${txt(v)}</p></div>`;
  }
}

/* ==========================================================
   Les réactions
   ========================================================== */
function barreReactions(r, reactions) {
  const siennes = reactions.filter(x => x.reponse_id === r.id);
  const mienne = siennes.find(x => x.profile_id === moi?.id);
  const cestMoi = r.profile_id === moi?.id;

  const deja = siennes.filter(x => x.emoji || x.mot).map(x => `
    <div class="reaction">
      <span class="reaction-emoji">${txt(x.emoji || '💬')}</span>
      <span class="discret"><strong>${txt(x.auteure?.prenom || 'Une copine')}</strong>${
        x.mot ? ' · ' + txt(x.mot) : ''}</span>
    </div>`).join('');

  if (cestMoi) {
    return `<div class="zone-reactions">
      ${deja || '<p class="discret">Pas encore de réaction sur ta page.</p>'}
    </div>`;
  }

  return `<div class="zone-reactions">
    ${deja}
    <div class="no-print">
      <div class="choix-reactions">
        ${EMOJIS_REACTION.map(e => `
          <button type="button" class="bouton-emoji ${mienne?.emoji === e ? 'actif' : ''}"
                  data-reagir="${txt(r.id)}" data-emoji="${txt(e)}">${e}</button>`).join('')}
      </div>
      <form class="rangee form-mot" data-mot-pour="${txt(r.id)}" style="margin-top:8px">
        <input type="text" name="mot" maxlength="140" style="flex:1;min-width:180px"
               value="${txt(mienne?.mot ?? '')}" placeholder="Un petit mot pour ${txt(r.auteure?.prenom || 'elle')}…">
        <button class="btn doux petit" type="submit">Envoyer</button>
      </form>
    </div>
  </div>`;
}

function brancherReactions() {
  vue.querySelectorAll('[data-reagir]').forEach(b =>
    b.addEventListener('click', async () => {
      const zone = b.closest('.zone-reactions');
      const dejaActif = b.classList.contains('actif');
      const motActuel = zone.querySelector('[name=mot]')?.value ?? '';
      b.disabled = true;
      try {
        await enregistrerReaction(b.dataset.reagir, dejaActif ? null : b.dataset.emoji, motActuel);
        await afficher();
      } catch (err) {
        b.disabled = false;
        alert(err.message);
      }
    }));

  vue.querySelectorAll('[data-mot-pour]').forEach(f =>
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const zone = f.closest('.zone-reactions');
      const emoji = zone.querySelector('.bouton-emoji.actif')?.dataset.emoji ?? null;
      const b = f.querySelector('button');
      b.disabled = true;
      try {
        await enregistrerReaction(f.dataset.motPour, emoji, f.mot.value);
        await afficher();
      } catch (err) {
        b.disabled = false;
        alert(err.message);
      }
    }));
}

/* ==========================================================
   Les pages collectives
   ========================================================== */
function pageAnniversaires(membres, moisDuNumero) {
  const fetes = membres
    .filter(m => m.date_naissance
      && Number(String(m.date_naissance).slice(5, 7)) === moisDuNumero)
    .sort((a, b) => String(a.date_naissance).slice(8) .localeCompare(String(b.date_naissance).slice(8)));

  if (!fetes.length) return '';

  return `<div class="carte carte-collective">
    <span class="surtitre">Page collective</span>
    <h2 style="margin:2px 0 16px">Les anniversaires du mois</h2>
    <div class="rangee" style="gap:18px">
      ${fetes.map(m => `
        <div class="anniversaire">
          <span class="pastille">${m.avatar_url
            ? `<img src="${txt(m.avatar_url)}" alt="">`
            : `<span>${txt(initiale(m))}</span>`}</span>
          <strong>${txt(m.prenom || m.email.split('@')[0])}</strong>
          <span class="discret">le ${txt(Number(String(m.date_naissance).slice(8, 10)))}</span>
        </div>`).join('')}
    </div>
  </div>`;
}

function pageIlYaUnAn(bloc) {
  if (!bloc) return '';

  // Une réponse au hasard, parmi celles qui ont du texte.
  const candidates = [];
  for (const r of bloc.reponses) {
    for (const q of bloc.edition.questions ?? []) {
      const v = r.contenu?.[q.id];
      if (typeof v === 'string' && v.trim().length > 30) {
        candidates.push({ nom: r.auteure?.prenom || 'Une copine', intitule: q.intitule, texte: v });
      }
    }
  }
  if (!candidates.length) return '';
  const choisie = candidates[Math.floor(Math.random() * candidates.length)];

  return `
    <div class="separateur">· · ·</div>
    <div class="carte carte-collective">
      <span class="surtitre">Il y a un an</span>
      <h2 style="margin:2px 0 6px">${txt(moisEnLettres(bloc.edition.mois))}</h2>
      <p class="discret" style="margin-bottom:14px">Numéro ${bloc.edition.numero}</p>
      <div class="rubrique">
        <div class="intitule">${txt(choisie.intitule)}</div>
        <p class="citation">${txt(choisie.texte)}</p>
        <p class="discret" style="margin-top:6px">— ${txt(choisie.nom)}, il y a un an</p>
      </div>
      <a class="discret no-print" href="edition.html?id=${encodeURIComponent(bloc.edition.id)}">
        Relire tout le numéro de l'an dernier →
      </a>
    </div>`;
}
