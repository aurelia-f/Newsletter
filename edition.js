// ==========================================================
//  Page : edition.html?id=… · le journal
//  Une page par personne, en vrai newspaper.
//  Le rendu (noir et blanc, une couleur, couleur) est choisi par
//  la première qui le décide, et vaut pour tout le numéro.
// ==========================================================
import { exigerSession, brancherEntete, afficherErreur,
         edition, reponsesPubliees, questionsPosees, membresDuGroupe,
         reactionsDesReponses, enregistrerReaction, editionIlYaUnAn,
         choisirRendu } from './db.js';
import { EMOJIS_REACTION } from './config.js';
import { $, txt, moisEnLettres, messageVide, initiale } from './ui.js';
import { pageJournal, uneDuNumero } from './journal.js';
import { ouvrirEditeur, fermerEditeur } from './editeur.js';

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

  document.title = `${ed.groupe.nom} · ${moisEnLettres(ed.mois)}`;

  const moisDuNumero = Number(String(ed.mois).slice(5, 7));

  // Le pied de page : les prénoms du groupe, toujours les mêmes.
  const pied = membres
    .map(m => m.prenom || m.email?.split('@')[0] || '')
    .filter(Boolean)
    .join(' · ');

  // Une page par personne, chacune avec son gabarit.
  const pages = reponses.length
    ? reponses.map((r, i) => pageJournal(r, ed, i, membres, posees, pied)
        + boutonRanger(r)
        + barreReactions(r, reactions)).join('')
    : messageVide('🕊️', 'Personne n\'a encore répondu');

  vue.innerHTML = `
    <div class="page">
      <a href="groupe.html?id=${encodeURIComponent(ed.groupe.id)}" class="lien-retour no-print">${txt(ed.groupe.nom)}</a>

      ${barreRendu(ed)}

      <div class="journal" id="journal"
           data-rendu="${txt(ed.rendu || 'nb')}"
           style="${ed.couleur ? `--jr-accent:${txt(ed.couleur)};--jr-rotation:${rotation(ed.couleur)}deg` : ''}">
        ${reponses.length ? uneDuNumero(ed, reponses, membres) : ''}
        ${pageAnniversaires(ed, membres, moisDuNumero, pied)}
        ${pages}
        ${pageIlYaUnAn(ed, ilYaUnAn, pied)}
      </div>

      <div class="rangee no-print" style="justify-content:center;margin-top:30px">
        <button class="btn fil" id="btn-pdf">Enregistrer en PDF</button>
      </div>
    </div>`;

  $('#btn-pdf').addEventListener('click', () => window.print());
  brancherRendu(ed);
  brancherRangement();
  brancherReactions();
}

/* ==========================================================
   LE CHOIX DE LA COULEUR
   Tant que personne n'a choisi, tout le monde peut.
   Une fois choisie, elle est annoncée, et seules les
   administratrices peuvent y revenir (verrouillé dans la base).
   ========================================================== */
function barreRendu(ed) {
  const dejaChoisi = Boolean(ed.rendu);
  const actuel = ed.rendu || 'nb';
  const couleur = ed.couleur || '#8c1d2f';

  const bouton = (valeur, libelle) => `
    <button type="button" class="btn petit ${actuel === valeur ? '' : 'fil'}"
            data-rendu="${valeur}">${libelle}</button>`;

  return `<div class="carte no-print" id="barre-rendu" style="margin-bottom:18px">
    <span class="surtitre">La couleur du numéro</span>
    <p class="discret" style="margin:2px 0 10px">
      ${dejaChoisi
        ? 'Elle est déjà choisie pour ce numéro. Tout le groupe a la même.'
        : 'La première qui choisit la fixe pour tout le monde. Sans choix, le numéro sort en noir et blanc.'}
    </p>
    <div class="rangee" style="gap:8px;align-items:center;flex-wrap:wrap">
      ${bouton('nb', 'Noir & blanc')}
      ${bouton('duo', 'Une couleur')}
      ${bouton('couleur', 'Couleur')}
      <input type="color" id="rendu-couleur" value="${txt(couleur)}"
             title="La teinte du numéro"
             style="width:44px;height:34px;padding:2px;border:1px solid var(--rose-pale);border-radius:8px;background:var(--blanc)">
      <span class="discret" id="rendu-etat"></span>
    </div>
  </div>`;
}

function brancherRendu(ed) {
  const barre = $('#barre-rendu');
  if (!barre) return;
  const etat = $('#rendu-etat');
  const pioche = $('#rendu-couleur');

  const appliquer = async (rendu) => {
    etat.textContent = 'on enregistre…';
    try {
      const maj = await choisirRendu(ed.id, rendu, pioche.value);
      ed.rendu = maj.rendu;
      ed.couleur = maj.couleur;
      await afficher();
    } catch (err) {
      etat.textContent = err.message;
    }
  };

  barre.querySelectorAll('[data-rendu]').forEach(b =>
    b.addEventListener('click', () => appliquer(b.dataset.rendu)));

  // Changer la teinte bascule aussi en mode « une couleur ».
  pioche.addEventListener('change', () =>
    appliquer(ed.rendu === 'couleur' ? 'couleur' : 'duo'));
}

/** Teinte de la couleur choisie, pour colorer les photos en mode duo. */
function rotation(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return 0;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  // Le filtre sepia part d'un orangé autour de 35°.
  return Math.round((h * 60 + 360) % 360) - 35;
}

/* ==========================================================
   RANGER SA PAGE
   Le bouton n'apparaît que sous sa propre page.
   ========================================================== */
function boutonRanger(r) {
  if (r.profile_id !== moi?.id) return '';
  const range = r.mise_en_page?.libre === true;
  return `<div class="jr-sous-page no-print">
    <button type="button" class="btn fil petit" data-ranger="${txt(r.id)}">
      ${range ? 'Reprendre ma mise en page' : 'Ranger ma page comme je veux'}
    </button>
  </div>`;
}

function brancherRangement() {
  vue.querySelectorAll('[data-ranger]').forEach(b =>
    b.addEventListener('click', () => {
      const article = vue.querySelector(`.jr-page[data-reponse="${CSS.escape(b.dataset.ranger)}"]`);
      if (!article) return;
      fermerEditeur();
      ouvrirEditeur(article, b.dataset.ranger, () => afficher());
    }));
}

/* ==========================================================
   Les réactions, sous la page de chacune (jamais imprimées)
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
    return `<div class="zone-reactions jr-reactions no-print">
      ${deja || '<p class="discret">Pas encore de réaction sur ta page.</p>'}
    </div>`;
  }

  return `<div class="zone-reactions jr-reactions no-print">
    ${deja}
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
   Les pages collectives, au même format journal
   ========================================================== */
function pageCollective(ed, surtitre, corps, pied) {
  return `<article class="jr-page g-lettrine">
    <div class="jr-tete">
      <div class="jr-ligne-haute">
        <span>${txt(moisEnLettres(ed.mois))}</span>
        <span class="jr-marque"><img src="logo-journal.png" alt="">My Newsletter</span>
      </div>
      <div class="jr-filet"></div>
      <h1 class="jr-manchette">${txt(ed.groupe.nom)}</h1>
      <div class="jr-filet jr-double"></div>
      <div class="jr-personne">${txt(surtitre)}</div>
      <div class="jr-filet"></div>
    </div>
    <div class="jr-corps">${corps}</div>
    <div class="jr-pied">
      <span>${txt(pied)}</span>
      <span>Édition numéro ${txt(ed.numero)}</span>
    </div>
  </article>`;
}

function pageAnniversaires(ed, membres, moisDuNumero, pied) {
  const fetes = membres
    .filter(m => m.date_naissance
      && Number(String(m.date_naissance).slice(5, 7)) === moisDuNumero)
    .sort((a, b) => String(a.date_naissance).slice(8).localeCompare(String(b.date_naissance).slice(8)));

  if (!fetes.length) return '';

  const corps = `<div class="jr-portraits">
    ${fetes.map(m => `
      <figure class="jr-portrait">
        ${m.avatar_url
          ? `<img src="${txt(m.avatar_url)}" alt="" loading="lazy">`
          : `<div class="jr-cadre-vide">${txt(initiale(m))}</div>`}
        <figcaption>${txt(m.prenom || m.email.split('@')[0])}
          · le ${txt(Number(String(m.date_naissance).slice(8, 10)))}</figcaption>
      </figure>`).join('')}
  </div>`;

  return pageCollective(ed, 'Les anniversaires du mois', corps, pied);
}

function pageIlYaUnAn(ed, bloc, pied) {
  if (!bloc) return '';

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

  const corps = `
    <p class="jr-chapeau">${txt(moisEnLettres(bloc.edition.mois))}, numéro ${txt(bloc.edition.numero)}.</p>
    <section class="jr-bloc">
      <h3 class="jr-titre-bloc">${txt(choisie.intitule)}</h3>
      <p class="jr-texte">${txt(choisie.texte)}</p>
      <p class="jr-legende">${txt(choisie.nom)}, il y a un an</p>
    </section>
    <p class="no-print" style="text-align:center">
      <a class="discret" href="edition.html?id=${encodeURIComponent(bloc.edition.id)}">
        Relire tout le numéro de l'an dernier →</a>
    </p>`;

  return pageCollective(ed, 'Il y a un an', corps, pied);
}
