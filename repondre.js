// ==========================================================
//  Page : repondre.html?id=… — le formulaire du mois
// ==========================================================
import { exigerSession, brancherEntete, afficherErreur, exigerPrenom,
         edition, maReponse, enregistrerReponse, envoyerMedia,
         membresDuGroupe, mesQuestionsARepondre, questionsPosees,
         poserQuestion, retirerQuestion } from './db.js';
import { FETES, PALETTE_EMOJIS, NB_QUESTIONS_EXPRESS } from './config.js';
import { $, txt, moisEnLettres, alerte } from './ui.js';

const vue = $('#vue');
const editionId = new URLSearchParams(location.search).get('id');

let ed, profil, medias = [], existante = null;
let questions = [];          // les questions affichées, dans l'ordre
let express = false;         // mode « 5 minutes »
let minuteur = null;         // enregistrement automatique

if (await exigerSession()) {
  profil = await brancherEntete();
  if (!exigerPrenom(profil)) {
    try { await afficher(); } catch (err) { afficherErreur(err); }
  }
}

async function afficher() {
  ed = await edition(editionId);

  // Une édition publiée se lit, elle ne se remplit plus.
  if (ed.statut === 'publiee') {
    location.replace('edition.html?id=' + encodeURIComponent(editionId));
    return;
  }

  const [rep, aRepondre, toutesLesQuestions, membres] = await Promise.all([
    maReponse(editionId),
    mesQuestionsARepondre(editionId),   // celles qui me concernent
    questionsPosees(editionId),         // toutes, pour retrouver les miennes
    membresDuGroupe(ed.groupe.id),
  ]);

  existante = rep;
  const contenu = existante?.contenu ?? {};
  medias = existante?.medias ?? [];

  // Les questions du numéro, plus celles posées par les copines.
  questions = [
    ...ed.questions.map(q => personnaliser(q)),
    ...aRepondre.map(q => ({
      id: 'q_' + q.id,
      type: 'long',
      // Une question qui m'est adressée personnellement fait partie
      // du mode « 5 minutes » : c'est la plus importante de toutes.
      express: !!q.destinataire_id,
      intitule: q.texte,
      aide: q.destinataire_id
        ? `${q.auteur?.prenom || 'Une copine'} te pose cette question à toi.`
        : `Question de ${q.auteur?.prenom || 'une copine'} à tout le groupe.`,
      posee: q,
    })),
  ];

  // Des questions sont-elles arrivées après que j'ai envoyé ma page ?
  const nouvelles = existante?.envoyee
    ? aRepondre.filter(q => new Date(q.cree_le) > new Date(existante.maj_le)).length
    : 0;

  const champs = questions.map(q => champ(q, contenu)).join('');
  const dejaPosees = toutesLesQuestions.filter(q => q.auteur_id === profil.id);

  vue.innerHTML = `
    <div class="page etroit">
      <a href="groupe.html?id=${encodeURIComponent(ed.groupe.id)}" class="discret">← ${txt(ed.groupe.nom)}</a>
      <div class="couverture" style="padding:34px 24px">
        <span class="numero">Numéro ${ed.numero}</span>
        <h1>${txt(moisEnLettres(ed.mois))}</h1>
        <p class="mois">À toi de raconter</p>
      </div>

      ${nouvelles ? `<div class="message info">
        <strong>${nouvelles} nouvelle${nouvelles > 1 ? 's' : ''} question${nouvelles > 1 ? 's' : ''}</strong>
        ${nouvelles > 1 ? 'sont arrivées' : 'est arrivée'} depuis que tu as envoyé ta page.
        Tu peux y répondre, c'est tout en bas.
      </div>` : ''}

      ${existante?.envoyee ? `<div class="message ok">Ta page est envoyée.
        Tu peux encore la modifier jusqu'à la publication.</div>` : ''}

      <div class="rangee espace" style="margin-bottom:14px">
        <p class="discret" style="margin:0">
          Tout est facultatif — réponds à ce qui te parle, saute le reste.
        </p>
        <button class="btn fil petit" id="btn-express">${express ? 'Tout afficher' : 'Mode 5 minutes'}</button>
      </div>

      <form id="form-reponse" class="carte">
        ${champs}
        <div class="rangee" style="gap:10px;margin-top:8px">
          <button class="btn" type="submit">${existante?.envoyee ? 'Mettre à jour ma page' : 'Envoyer ma page'}</button>
          <span class="discret" id="etat-brouillon"></span>
        </div>
      </form>

      ${cartePoserQuestion(membres, dejaPosees)}
      <div id="retour"></div>
    </div>`;

  brancherExpress();
  brancherFormats();
  brancherPhotos();
  brancherEnregistrement();
  brancherPoserQuestion();
  appliquerExpress();
}

/* ==========================================================
   La question des fêtes, personnalisée selon le profil
   ========================================================== */
function personnaliser(q) {
  if (!q.fete) return q;

  const moisDuNumero = Number(String(ed.mois).slice(5, 7));
  const mesFetes = profil?.fetes ?? [];

  // Mon anniversaire tombe-t-il ce mois-ci ?
  const moisAnniversaire = profil?.date_naissance
    ? Number(String(profil.date_naissance).slice(5, 7))
    : null;

  for (const idFete of mesFetes) {
    const fete = FETES.find(f => f.id === idFete);
    if (!fete) continue;
    const concernee = fete.id === 'anniversaire_perso'
      ? moisAnniversaire === moisDuNumero
      : fete.mois.includes(moisDuNumero);
    if (concernee) {
      return { ...q, intitule: fete.question, aide: null, feteChoisie: fete.nom };
    }
  }
  return q;
}

/* ==========================================================
   Un champ, selon son type
   ========================================================== */
function champ(q, contenu) {
  const v = contenu[q.id];
  const entete = `<span class="intitule">${txt(q.intitule)}</span>
    ${q.aide ? `<span class="aide">${txt(q.aide)}</span>` : ''}`;
  const bloc = (corps, etiquette = 'div') =>
    `<${etiquette} class="champ" data-question="${txt(q.id)}"
       ${q.express ? 'data-express="1"' : ''}>${entete}${corps}</${etiquette}>`;

  switch (q.type) {

    case 'photos':
      return bloc(`
        <div class="depot" id="depot">
          <input type="file" id="fichiers" multiple accept="image/*,video/*">
          <strong>Choisir des photos ou des vidéos</strong>
          <p class="discret">ou glisse-les ici</p>
        </div>
        <div class="vignettes" id="vignettes"></div>`);

    case 'musique':
      return bloc(`
        <input type="text" name="${txt(q.id)}" value="${txt(v ?? '')}"
               placeholder="Titre — Artiste" style="margin-bottom:8px">
        <input type="url" name="${txt(q.id)}_lien" value="${txt(contenu[q.id + '_lien'] ?? '')}"
               placeholder="Lien Spotify ou YouTube (facultatif)">`);

    case 'qcm':
      return bloc(`<div class="pastilles">${q.choix.map((c, i) => `
        <label class="pastille-choix">
          <input type="radio" name="${txt(q.id)}" value="${txt(c)}"
                 ${v === c ? 'checked' : ''}>
          <span>${txt(c)}</span>
        </label>`).join('')}</div>
        <button type="button" class="lien-effacer" data-effacer="${txt(q.id)}"
                style="${v ? '' : 'display:none'}">Effacer ma réponse</button>`);

    case 'multi': {
      const choisis = Array.isArray(v) ? v : [];
      return bloc(`<div class="pastilles">${q.choix.map(c => `
        <label class="pastille-choix">
          <input type="checkbox" name="${txt(q.id)}" value="${txt(c)}"
                 ${choisis.includes(c) ? 'checked' : ''}>
          <span>${txt(c)}</span>
        </label>`).join('')}</div>`);
    }

    case 'curseur': {
      const min = q.min ?? 0, max = q.max ?? 10;
      const valeur = v ?? Math.round((min + max) / 2);
      return bloc(`
        <div class="curseur" data-touche="${v != null ? '1' : '0'}">
          <input type="range" name="${txt(q.id)}" min="${min}" max="${max}" step="1" value="${valeur}">
          <div class="rangee espace" style="margin-top:2px">
            <span class="discret">${txt(q.basG ?? min)}</span>
            <strong class="valeur-curseur">${v != null ? txt(v) : '—'}</strong>
            <span class="discret">${txt(q.basD ?? max)}</span>
          </div>
        </div>`);
    }

    case 'note': {
      const n = Number(v ?? 0);
      return bloc(`<div class="etoiles" data-valeur="${n || ''}">
        ${[1, 2, 3, 4, 5].map(i => `
          <button type="button" class="etoile ${i <= n ? 'pleine' : ''}" data-note="${i}"
                  aria-label="${i} sur 5">★</button>`).join('')}
        <button type="button" class="lien-effacer" data-effacer-note="1"
                style="${n ? '' : 'display:none'}">effacer</button>
      </div>`);
    }

    case 'emojis': {
      const choisis = Array.isArray(v) ? v : [];
      return bloc(`
        <div class="palette-emojis" data-emojis-pour="${txt(q.id)}">
          ${PALETTE_EMOJIS.map(e => `
            <button type="button" class="bouton-emoji ${choisis.includes(e) ? 'actif' : ''}"
                    data-emoji="${txt(e)}">${e}</button>`).join('')}
        </div>
        <p class="discret compteur-emojis">${choisis.length} / 3</p>`);
    }

    case 'mot':
      return bloc(`<input type="text" name="${txt(q.id)}" value="${txt(v ?? '')}"
                     maxlength="24" placeholder="Un seul mot">`);

    case 'long':
      return bloc(`<textarea name="${txt(q.id)}">${txt(v ?? '')}</textarea>`, 'label');

    default:
      return bloc(`<input type="text" name="${txt(q.id)}" value="${txt(v ?? '')}">`, 'label');
  }
}

/* ==========================================================
   Lire le formulaire
   ========================================================== */
function lireFormulaire() {
  const donnees = {};
  const form = $('#form-reponse');

  for (const q of questions) {
    const zone = form.querySelector(`[data-question="${cssEchappe(q.id)}"]`);
    if (!zone) continue;

    switch (q.type) {
      case 'photos':
        break;

      case 'musique': {
        const titre = zone.querySelector(`[name="${cssEchappe(q.id)}"]`)?.value.trim();
        const lien = zone.querySelector(`[name="${cssEchappe(q.id)}_lien"]`)?.value.trim();
        if (titre) donnees[q.id] = titre;
        if (lien) donnees[q.id + '_lien'] = lien;
        break;
      }

      case 'qcm': {
        const coche = zone.querySelector('input[type=radio]:checked');
        if (coche) donnees[q.id] = coche.value;
        break;
      }

      case 'multi': {
        const coches = [...zone.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
        if (coches.length) donnees[q.id] = coches;
        break;
      }

      case 'curseur': {
        const porteur = zone.querySelector('.curseur');
        if (porteur?.dataset.touche === '1') {
          donnees[q.id] = Number(zone.querySelector('input[type=range]').value);
        }
        break;
      }

      case 'note': {
        const n = Number(zone.querySelector('.etoiles')?.dataset.valeur || 0);
        if (n) donnees[q.id] = n;
        break;
      }

      case 'emojis': {
        const choisis = [...zone.querySelectorAll('.bouton-emoji.actif')].map(b => b.dataset.emoji);
        if (choisis.length) donnees[q.id] = choisis;
        break;
      }

      default: {
        const val = zone.querySelector(`[name="${cssEchappe(q.id)}"]`)?.value.trim();
        if (val) donnees[q.id] = val;
      }
    }

    // On garde la formulation vue par la personne : la question des
    // fêtes n'est pas la même pour tout le monde.
    if (q.feteChoisie && donnees[q.id]) {
      donnees[q.id + '_intitule'] = q.intitule;
    }
  }
  return donnees;
}

function cssEchappe(s) {
  return String(s).replace(/["\\]/g, '\\$&');
}

/* ==========================================================
   Les comportements de chaque format
   ========================================================== */
function brancherFormats() {
  const form = $('#form-reponse');

  // Curseurs
  form.querySelectorAll('.curseur').forEach(c => {
    const glissiere = c.querySelector('input[type=range]');
    const valeur = c.querySelector('.valeur-curseur');
    glissiere.addEventListener('input', () => {
      c.dataset.touche = '1';
      valeur.textContent = glissiere.value;
      planifierEnregistrement();
    });
  });

  // Étoiles
  form.querySelectorAll('.etoiles').forEach(zone => {
    const dessiner = () => {
      const n = Number(zone.dataset.valeur || 0);
      zone.querySelectorAll('.etoile').forEach(e =>
        e.classList.toggle('pleine', Number(e.dataset.note) <= n));
      zone.querySelector('[data-effacer-note]').style.display = n ? '' : 'none';
    };
    zone.querySelectorAll('.etoile').forEach(e =>
      e.addEventListener('click', () => {
        zone.dataset.valeur = e.dataset.note;
        dessiner();
        planifierEnregistrement();
      }));
    zone.querySelector('[data-effacer-note]').addEventListener('click', () => {
      zone.dataset.valeur = '';
      dessiner();
      planifierEnregistrement();
    });
  });

  // Emojis — trois au maximum
  form.querySelectorAll('[data-emojis-pour]').forEach(palette => {
    const compteur = palette.parentElement.querySelector('.compteur-emojis');
    palette.querySelectorAll('.bouton-emoji').forEach(b =>
      b.addEventListener('click', () => {
        const actifs = palette.querySelectorAll('.bouton-emoji.actif').length;
        if (!b.classList.contains('actif') && actifs >= 3) {
          alerte($('#retour'), 'info', 'Trois emojis maximum — retires-en un d\'abord.');
          return;
        }
        b.classList.toggle('actif');
        compteur.textContent = palette.querySelectorAll('.bouton-emoji.actif').length + ' / 3';
        planifierEnregistrement();
      }));
  });

  // Effacer une réponse à choix unique
  form.querySelectorAll('[data-effacer]').forEach(b => {
    const zone = b.closest('[data-question]');
    zone.querySelectorAll('input[type=radio]').forEach(r =>
      r.addEventListener('change', () => { b.style.display = ''; }));
    b.addEventListener('click', () => {
      zone.querySelectorAll('input[type=radio]').forEach(r => { r.checked = false; });
      b.style.display = 'none';
      planifierEnregistrement();
    });
  });
}

/* ==========================================================
   Mode « 5 minutes »
   ========================================================== */
function brancherExpress() {
  $('#btn-express').addEventListener('click', () => {
    express = !express;
    $('#btn-express').textContent = express ? 'Tout afficher' : 'Mode 5 minutes';
    appliquerExpress();
  });
}

function appliquerExpress() {
  const form = $('#form-reponse');
  let montres = 0;
  form.querySelectorAll('[data-question]').forEach(zone => {
    const garde = !express
      || (zone.dataset.express === '1' && montres < NB_QUESTIONS_EXPRESS);
    if (garde && express) montres++;
    zone.classList.toggle('cache', !garde);
  });
}

/* ==========================================================
   Photos et vidéos
   ========================================================== */
function brancherPhotos() {
  const zoneVignettes = $('#vignettes');
  const depot = $('#depot');
  if (!depot) return;

  function dessiner() {
    zoneVignettes.innerHTML = medias.map((m, i) => `
      <div class="vignette">
        ${m.type === 'video'
          ? `<video src="${txt(m.url)}" muted></video>`
          : `<img src="${txt(m.url)}" alt="">`}
        <button type="button" data-suppr="${i}" title="Retirer">×</button>
      </div>`).join('');
    zoneVignettes.querySelectorAll('[data-suppr]').forEach(b =>
      b.addEventListener('click', () => {
        medias.splice(Number(b.dataset.suppr), 1);
        dessiner();
        planifierEnregistrement();
      }));
  }
  dessiner();

  async function ajouter(liste) {
    for (const f of liste) {
      if (f.size > 50 * 1024 * 1024) {
        alerte($('#retour'), 'erreur', `${f.name} dépasse 50 Mo.`);
        continue;
      }
      zoneVignettes.insertAdjacentHTML('beforeend',
        '<div class="vignette" data-attente><div class="tourne" style="margin:28px auto"></div></div>');
      try {
        medias.push(await envoyerMedia(f));
      } catch (err) {
        alerte($('#retour'), 'erreur', 'Envoi impossible : ' + err.message);
      }
      zoneVignettes.querySelector('[data-attente]')?.remove();
      dessiner();
      planifierEnregistrement();
    }
  }

  const input = $('#fichiers');
  depot.addEventListener('click', () => input.click());
  input.addEventListener('change', () => ajouter([...input.files]));
  ['dragenter', 'dragover'].forEach(ev =>
    depot.addEventListener(ev, e => { e.preventDefault(); depot.classList.add('survol'); }));
  ['dragleave', 'drop'].forEach(ev =>
    depot.addEventListener(ev, e => { e.preventDefault(); depot.classList.remove('survol'); }));
  depot.addEventListener('drop', e => ajouter([...e.dataTransfer.files]));
}

/* ==========================================================
   Enregistrement : brouillon automatique + envoi
   ========================================================== */
function planifierEnregistrement() {
  const etat = $('#etat-brouillon');
  if (etat) etat.textContent = 'Modifications en cours…';
  clearTimeout(minuteur);
  minuteur = setTimeout(() => enregistrer(existante?.envoyee ?? false, true), 2000);
}

async function enregistrer(envoyee, silencieux = false) {
  const etat = $('#etat-brouillon');
  try {
    await enregistrerReponse(editionId, lireFormulaire(), medias, envoyee);
    if (etat && silencieux) {
      const h = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      etat.textContent = `Enregistré à ${h}`;
    }
  } catch (err) {
    if (etat) etat.textContent = '';
    if (!silencieux) throw err;
    alerte($('#retour'), 'erreur', 'Enregistrement impossible : ' + err.message);
  }
}

function brancherEnregistrement() {
  const form = $('#form-reponse');

  // Toute saisie déclenche un enregistrement deux secondes plus tard.
  form.addEventListener('input', e => {
    if (e.target.type === 'file') return;
    planifierEnregistrement();
  });
  form.addEventListener('change', e => {
    if (e.target.type === 'file') return;
    planifierEnregistrement();
  });

  // On n'abandonne pas un brouillon en fermant l'onglet.
  window.addEventListener('beforeunload', () => {
    if (minuteur) {
      clearTimeout(minuteur);
      enregistrer(existante?.envoyee ?? false, true);
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearTimeout(minuteur);
    const b = e.target.querySelector('button[type=submit]');
    const texte = b.textContent;
    b.disabled = true;
    b.textContent = 'Envoi…';
    try {
      await enregistrer(true);
      location.href = 'groupe.html?id=' + encodeURIComponent(ed.groupe.id);
    } catch (err) {
      alerte($('#retour'), 'erreur', err.message);
      b.disabled = false;
      b.textContent = texte;
    }
  });
}

/* ==========================================================
   Poser une question ce mois-ci
   ========================================================== */
function cartePoserQuestion(membres, dejaPosees) {
  const autres = membres.filter(m => m.profile_id && m.profile_id !== profil.id);

  return `
    <div class="separateur">· · ·</div>
    <div class="carte">
      <h3>Pose une question ce mois-ci</h3>
      <p class="discret" style="margin:6px 0 16px">
        Elle s'ajoutera au questionnaire de ce numéro. La réponse paraîtra
        dans l'édition — et la personne reste libre de passer.
      </p>

      ${dejaPosees.length ? `
      <div class="pile" style="gap:8px;margin-bottom:18px">
        ${dejaPosees.map(q => `
          <div class="rangee espace ligne-membre">
            <div>
              <strong>${txt(q.texte)}</strong>
              <p class="discret" style="margin:0">
                ${q.destinataire_id
                  ? '→ ' + txt(q.destinataire?.prenom || 'une copine')
                  : '→ tout le groupe'}
              </p>
            </div>
            <button class="btn fil petit" data-retirer-question="${txt(q.id)}">Retirer</button>
          </div>`).join('')}
      </div>` : ''}

      <form id="form-question">
        <label class="champ">
          <span class="intitule">Ta question</span>
          <textarea name="texte" maxlength="300" required
                    placeholder="Par exemple : qu'est-ce que tu as fait de ton samedi ?"></textarea>
        </label>
        <label class="champ">
          <span class="intitule">Tu la poses à qui ?</span>
          <select name="destinataire">
            <option value="">Tout le groupe</option>
            ${autres.map(m => `
              <option value="${txt(m.profile_id)}">${txt(m.prenom || m.email)}</option>`).join('')}
          </select>
        </label>
        <button class="btn doux" type="submit">Poser la question</button>
      </form>
    </div>`;
}

function brancherPoserQuestion() {
  $('#form-question')?.addEventListener('submit', async e => {
    e.preventDefault();
    const b = e.target.querySelector('button');
    b.disabled = true;
    try {
      await poserQuestion(editionId, e.target.texte.value, e.target.destinataire.value);
      await afficher();
      alerte($('#retour'), 'ok', 'Ta question est posée.');
    } catch (err) {
      alerte($('#retour'), 'erreur', err.message);
      b.disabled = false;
    }
  });

  vue.querySelectorAll('[data-retirer-question]').forEach(b =>
    b.addEventListener('click', async () => {
      if (!confirm('Retirer ta question ?')) return;
      try { await retirerQuestion(b.dataset.retirerQuestion); await afficher(); }
      catch (err) { alerte($('#retour'), 'erreur', err.message); }
    }));
}
