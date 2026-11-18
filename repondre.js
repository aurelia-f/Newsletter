// ==========================================================
//  Page : repondre.html · le questionnaire du mois
//
//  On remplit UNE SEULE FOIS, puis on coche les groupes à qui
//  l'envoyer. Le brouillon est privé et sert de source : si on
//  laisse un groupe de côté, on revient plus tard et tout est
//  déjà pré-rempli.
// ==========================================================
import { exigerSession, brancherEntete, afficherErreur, exigerPrenom,
         editionsOuvertes, monBrouillon, enregistrerBrouillon, mesEnvois,
         ouvrirPourGroupe, enregistrerReponse, envoyerMedia, mesGroupes,
         membresDuGroupe, questionsPosees, poserQuestion, retirerQuestion } from './db.js';
import { FETES, PALETTE_EMOJIS, NB_QUESTIONS_EXPRESS, IDS_EXPRESS } from './config.js';
import { brancherDictee, bandeauDictee } from './dictee.js';
import { $, txt, moisEnLettres, moisCourant, alerte } from './ui.js';

const vue = $('#vue');

let profil = null;
let mois = null;              // le mois en cours de remplissage
let moisDisponibles = [];
let editionsDuMois = [];      // les éditions ouvertes de ce mois
let mesGroupesListe = [];

// Le groupe d'où l'on vient, s'il y en a un : le bouton de retour y
// ramène, plutôt que de renvoyer à la liste de tous les groupes.
const venantDe = new URLSearchParams(location.search).get('de');
let questions = [];           // les questions fusionnées, affichées
let medias = [];
let brouillon = null;
let envois = {};              // edition_id → ma réponse déjà envoyée
let express = false;
let minuteur = null;

if (await exigerSession()) {
  profil = await brancherEntete();
  if (!exigerPrenom(profil)) {
    try { await afficher(); } catch (err) { afficherErreur(err); }
  }
}

/* ==========================================================
   Clé stable d'une question
   ----------------------------------------------------------
   Le brouillon est commun à tous les groupes, mais chaque groupe
   a ses propres identifiants de questions. On range donc les
   réponses sous une clé calculée à partir du libellé, identique
   d'un groupe à l'autre, et on les redistribue à l'envoi.
   ========================================================== */
function slug(texte) {
  return String(texte ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '').slice(0, 60);
}

function cleDeQuestion(q) {
  if (String(q.id).startsWith('q_')) return q.id;   // question posée : déjà unique
  return q.type + '__' + slug(q.intitule);
}

/* ==========================================================
   Affichage
   ========================================================== */
async function afficher() {
  const [ouvertes, groupes] = await Promise.all([editionsOuvertes(), mesGroupes()]);
  mesGroupesListe = groupes;

  moisDisponibles = [...new Set(ouvertes.map(e => e.mois))].sort().reverse();
  const demande = new URLSearchParams(location.search).get('mois');
  mois = demande || moisDisponibles[0] || moisCourant();

  editionsDuMois = ouvertes.filter(e => e.mois === mois);

  // Aucun questionnaire ouvert ce mois-là : on propose de l'ouvrir,
  // et n'importe quelle membre peut le faire.
  if (!editionsDuMois.length) {
    return afficherAucuneEdition(groupes);
  }

  const [b, env, posees] = await Promise.all([
    monBrouillon(mois),
    mesEnvois(mois),
    questionsPosees(editionsDuMois.map(e => e.id)),
  ]);
  brouillon = b;
  envois = env;
  medias = b?.medias ?? [];
  const contenu = b?.contenu ?? {};

  questions = fusionner(posees);

  const champs = questions.map(q => champ(q, contenu)).join('');
  const mesPosees = posees.filter(q => q.auteur_id === profil.id);

  vue.innerHTML = `
    <div class="page etroit">
      ${lienRetour(mesGroupesListe)}
      <div class="couverture" style="padding:34px 24px">
        <span class="numero">Le questionnaire du mois</span>
        <h1>${txt(moisEnLettres(mois))}</h1>
        <p class="mois">À toi de raconter, une seule fois</p>
      </div>

      ${selecteurDeMois()}
      ${bandeauDictee()}

      <div class="rangee espace" style="margin-bottom:14px">
        <p class="discret" style="margin:0">
          Tout est facultatif. Réponds à ce qui te parle, saute le reste.
        </p>
        <button class="btn fil petit" id="btn-express">Mode 5 minutes</button>
      </div>
      <p class="discret cache" id="note-express" style="margin:-6px 0 14px"></p>

      <form id="form-reponse" class="carte">
        ${champs}
      </form>

      ${carteOuvrir(mesGroupesListe)}
      ${carteGroupes()}
      ${cartePoserQuestion(mesPosees)}
      <div id="retour"></div>
    </div>`;

  brancherSelecteurMois();
  brancherOuvertures();
  brancherExpress();
  brancherFormats();
  brancherPhotos();
  brancherPortraits();
  brancherEnregistrement();
  brancherEnvoi();
  brancherPoserQuestion();
  appliquerExpress();
}

function afficherAucuneEdition(groupes) {
  vue.innerHTML = `
    <div class="page etroit">
      ${lienRetour(groupes)}
      <div class="couverture" style="padding:34px 24px">
        <span class="numero">Le questionnaire du mois</span>
        <h1>${txt(moisEnLettres(mois))}</h1>
        <p class="mois">Pas encore ouvert</p>
      </div>
      ${carteOuvrir(groupes, true)}
      <div id="retour"></div>
    </div>`;
  brancherOuvertures();
}

/**
 * La carte qui propose d'ouvrir le questionnaire du mois pour les
 * groupes qui ne l'ont pas encore. Tout le monde peut le faire.
 */
function carteOuvrir(groupes, seule = false) {
  const sans = groupes.filter(g => !editionsDuMois.some(e => e.groupe_id === g.id));
  if (!sans.length) return '';

  return `
    ${seule ? '' : '<div class="separateur">· · ·</div>'}
    <div class="carte carte-ouvrir">
      <span class="surtitre">Il manque un groupe</span>
      <h3 style="margin:2px 0 6px">
        ${sans.length > 1 ? 'Ces groupes n\'ont' : 'Ce groupe n\'a'}
        pas encore de numéro pour ${txt(moisEnLettres(mois))}
      </h3>
      <p class="discret" style="margin-bottom:16px">
        N'importe qui peut l'ouvrir, pas seulement l'administratrice.
        Ça ne publie rien : ça ouvre simplement le questionnaire pour
        que tout le monde puisse répondre.
      </p>
      <div class="pile" style="gap:8px">
        ${sans.map(g => `
          <div class="rangee espace ligne-groupe">
            <div class="rangee" style="gap:12px;min-width:0">
              <span class="emoji-groupe">${txt(g.emoji || '🎀')}</span>
              <strong>${txt(g.nom)}</strong>
            </div>
            <button class="btn doux petit" data-ouvrir="${txt(g.id)}">
              Ouvrir ${txt(moisEnLettres(mois).split(' ')[0])}
            </button>
          </div>`).join('')}
      </div>
    </div>`;
}

function brancherOuvertures() {
  vue.querySelectorAll('[data-ouvrir]').forEach(b =>
    b.addEventListener('click', async () => {
      b.disabled = true;
      b.textContent = 'Ouverture…';
      try {
        await ouvrirPourGroupe(b.dataset.ouvrir, mois);
        await afficher();
        alerte($('#retour'), 'ok', 'Le questionnaire est ouvert. À toi de raconter.');
      } catch (err) {
        b.disabled = false;
        alerte($('#retour'), 'erreur', err.message);
      }
    }));
}

/* ==========================================================
   Fusion des questions de tous les groupes
   ========================================================== */
function fusionner(posees) {
  const plusieursGroupes = editionsDuMois.length > 1;

  // 1. On compte dans combien de groupes chaque question apparaît.
  const compte = new Map();
  for (const ed of editionsDuMois) {
    for (const q of ed.questions ?? []) {
      const cle = cleDeQuestion(q);
      if (!compte.has(cle)) compte.set(cle, { nb: 0, groupes: [] });
      compte.get(cle).nb++;
      compte.get(cle).groupes.push(ed.groupe.nom);
    }
  }

  // 2. Les questions présentes dans TOUS les groupes vont en haut,
  //    une seule fois, sans titre : c'est le tronc commun.
  const communes = [];
  const vues = new Set();
  for (const ed of editionsDuMois) {
    for (const q of ed.questions ?? []) {
      const cle = cleDeQuestion(q);
      if (compte.get(cle).nb !== editionsDuMois.length) continue;
      if (vues.has(cle)) continue;
      vues.add(cle);
      communes.push({ ...personnaliser(q), cle });
    }
  }

  // 3. Puis une section par groupe, avec ce qui lui est propre :
  //    ses questions tirées au hasard, et les questions de ses copines.
  const sections = [];
  for (const ed of editionsDuMois) {
    const propres = [];

    for (const q of ed.questions ?? []) {
      const cle = cleDeQuestion(q);
      if (compte.get(cle).nb === editionsDuMois.length) continue;  // déjà en haut
      if (vues.has(cle)) continue;                                  // déjà sous un autre groupe
      vues.add(cle);

      // Une question partagée par certains groupes mais pas tous est
      // rangée sous le premier, en signalant les autres.
      const autres = compte.get(cle).groupes.filter(n => n !== ed.groupe.nom);
      propres.push({
        ...personnaliser(q),
        cle,
        note: autres.length ? 'Aussi posée dans : ' + autres.join(', ') : null,
      });
    }

    const siennes = posees.filter(q => q.edition_id === ed.id).filter(q =>
      q.destinataire_id ? q.destinataire_id === profil.id : q.auteur_id !== profil.id);

    for (const q of siennes) {
      propres.push({
        id: 'q_' + q.id,
        cle: 'q_' + q.id,
        type: 'long',
        express: !!q.destinataire_id,
        intitule: q.texte,
        aide: q.destinataire_id
          ? `${q.auteur?.prenom || 'Une copine'} te pose cette question à toi.`
          : `Question de ${q.auteur?.prenom || 'une copine'} à tout le groupe.`,
        editionId: ed.id,
      });
    }

    if (!propres.length) continue;

    sections.push({
      titreSection: `${ed.groupe.emoji || '🎀'} ${ed.groupe.nom}`,
      sousTitre: propres.length === 1
        ? 'Une question rien que pour ce groupe'
        : `${propres.length} questions rien que pour ce groupe`,
    });
    sections.push(...propres);
  }

  // Avec un seul groupe, pas de titre de section : tout est commun.
  if (!plusieursGroupes && sections.length) {
    return [...communes, ...sections.filter(q => !q.titreSection)];
  }

  if (sections.length) {
    return [
      { titreSection: 'Pour tout le monde', sousTitre: 'Ces questions partent dans tous tes groupes' },
      ...communes,
      ...sections,
    ];
  }
  return communes;
}

/** La question des fêtes, adaptée à ce que j'ai renseigné. */
function personnaliser(q) {
  if (!q.fete) return q;

  const moisDuNumero = Number(String(mois).slice(5, 7));
  const moisAnniversaire = profil?.date_naissance
    ? Number(String(profil.date_naissance).slice(5, 7)) : null;

  for (const idFete of profil?.fetes ?? []) {
    const fete = FETES.find(f => f.id === idFete);
    if (!fete) continue;
    const concernee = fete.id === 'anniversaire_perso'
      ? moisAnniversaire === moisDuNumero
      : fete.mois.includes(moisDuNumero);
    if (concernee) return { ...q, intitule: fete.question, aide: null, feteChoisie: fete.nom };
  }
  return q;
}

function selecteurDeMois() {
  if (moisDisponibles.length < 2) return '';
  return `
    <div class="rangee" style="margin-bottom:18px">
      <label class="discret" for="choix-mois-form">Mois à remplir</label>
      <select id="choix-mois-form" style="flex:1;min-width:160px">
        ${moisDisponibles.map(m => `
          <option value="${txt(m)}" ${m === mois ? 'selected' : ''}>
            ${txt(moisEnLettres(m))}
          </option>`).join('')}
      </select>
    </div>`;
}

function brancherSelecteurMois() {
  $('#choix-mois-form')?.addEventListener('change', e => {
    location.href = 'repondre.html?mois=' + encodeURIComponent(e.target.value)
      + (venantDe ? '&de=' + encodeURIComponent(venantDe) : '');
  });
}

/**
 * Le bouton de retour. Si on est arrivée depuis un groupe, il y
 * ramène, et pas à la liste de tous les groupes.
 */
function lienRetour(groupes) {
  const g = venantDe && (groupes || []).find(x => (x.id || x.groupe_id) === venantDe);
  if (!g) return '<a href="groupes.html" class="lien-retour">Mes groupes</a>';
  const nom = g.nom || g.groupe?.nom || 'mon groupe';
  return `<a href="groupe.html?id=${encodeURIComponent(venantDe)}" class="lien-retour">${txt(nom)}</a>`;
}

/* ==========================================================
   Un champ, selon son type
   ========================================================== */
function champ(q, contenu) {
  if (q.titreSection) {
    return `<div class="titre-section" data-question="section_${slug(q.titreSection)}">
      <div class="separateur">· · ·</div>
      <h3>${txt(q.titreSection)}</h3>
      ${q.sousTitre ? `<p class="discret">${txt(q.sousTitre)}</p>` : ''}
    </div>`;
  }

  const v = contenu[q.cle];
  const entete = `<span class="intitule">${txt(q.intitule)}</span>
    ${q.aide ? `<span class="aide">${txt(q.aide)}</span>` : ''}
    ${q.note ? `<span class="aide note-groupe">${txt(q.note)}</span>` : ''}`;
  const bloc = (corps, etiquette = 'div') =>
    `<${etiquette} class="champ" data-question="${txt(q.cle)}"
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

    case 'portrait':
      return bloc(`
        <input type="hidden" name="${txt(q.cle)}" value="${txt(v ?? '')}">
        <div class="depot depot-portrait" data-portrait="${txt(q.cle)}">
          <input type="file" accept="image/*" hidden>
          <strong>Choisir ma photo de couverture</strong>
          <p class="discret">une seule, de préférence en portrait</p>
        </div>
        <div class="vignettes" data-apercu="${txt(q.cle)}">${v ? `
          <div class="vignette"><img src="${txt(v)}" alt="">
            <button type="button" data-oter="${txt(q.cle)}" title="Retirer">×</button>
          </div>` : ''}</div>`);

    case 'musique':
      return bloc(`
        <input type="text" name="${txt(q.cle)}" value="${txt(v ?? '')}"
               data-dictee="1" placeholder="Titre / Artiste" style="margin-bottom:8px">
        <input type="url" name="${txt(q.cle)}_lien" value="${txt(contenu[q.cle + '_lien'] ?? '')}"
               placeholder="Lien Spotify ou YouTube (facultatif)">`);

    case 'qcm':
      return bloc(`<div class="pastilles">${q.choix.map(c => `
        <label class="pastille-choix">
          <input type="radio" name="${txt(q.cle)}" value="${txt(c)}" ${v === c ? 'checked' : ''}>
          <span>${txt(c)}</span>
        </label>`).join('')}</div>
        <button type="button" class="lien-effacer" data-effacer="${txt(q.cle)}"
                style="${v ? '' : 'display:none'}">Effacer ma réponse</button>`);

    case 'multi': {
      const choisis = Array.isArray(v) ? v : [];
      return bloc(`<div class="pastilles">${q.choix.map(c => `
        <label class="pastille-choix">
          <input type="checkbox" name="${txt(q.cle)}" value="${txt(c)}"
                 ${choisis.includes(c) ? 'checked' : ''}>
          <span>${txt(c)}</span>
        </label>`).join('')}</div>`);
    }

    case 'curseur': {
      const min = q.min ?? 0, max = q.max ?? 10;
      const valeur = v ?? Math.round((min + max) / 2);
      return bloc(`
        <div class="curseur" data-touche="${v != null ? '1' : '0'}">
          <input type="range" name="${txt(q.cle)}" min="${min}" max="${max}" step="1" value="${valeur}">
          <div class="rangee espace" style="margin-top:2px">
            <span class="discret">${txt(q.basG ?? min)}</span>
            <strong class="valeur-curseur">${v != null ? txt(v) : '·'}</strong>
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
        <div class="palette-emojis" data-emojis-pour="${txt(q.cle)}">
          ${PALETTE_EMOJIS.map(e => `
            <button type="button" class="bouton-emoji ${choisis.includes(e) ? 'actif' : ''}"
                    data-emoji="${txt(e)}">${e}</button>`).join('')}
        </div>
        <p class="discret compteur-emojis">${choisis.length} / 3</p>`);
    }

    case 'mot':
      return bloc(`<input type="text" name="${txt(q.cle)}" value="${txt(v ?? '')}"
                     maxlength="24" placeholder="Un seul mot">`);

    case 'long':
      return bloc(`<textarea name="${txt(q.cle)}" data-dictee="1">${txt(v ?? '')}</textarea>`, 'label');

    default:
      return bloc(`<input type="text" name="${txt(q.cle)}" value="${txt(v ?? '')}"
                     data-dictee="1">`, 'label');
  }
}

/* ==========================================================
   Lire le formulaire
   ========================================================== */
function cssEchappe(s) { return String(s).replace(/["\\]/g, '\\$&'); }

function lireFormulaire() {
  const donnees = {};
  const form = $('#form-reponse');

  for (const q of questions) {
    if (q.titreSection) continue;
    const zone = form.querySelector(`[data-question="${cssEchappe(q.cle)}"]`);
    if (!zone) continue;

    switch (q.type) {
      case 'photos': break;

      case 'musique': {
        const titre = zone.querySelector(`[name="${cssEchappe(q.cle)}"]`)?.value.trim();
        const lien = zone.querySelector(`[name="${cssEchappe(q.cle)}_lien"]`)?.value.trim();
        if (titre) donnees[q.cle] = titre;
        if (lien) donnees[q.cle + '_lien'] = lien;
        break;
      }

      case 'qcm': {
        const coche = zone.querySelector('input[type=radio]:checked');
        if (coche) donnees[q.cle] = coche.value;
        break;
      }

      case 'multi': {
        const coches = [...zone.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
        if (coches.length) donnees[q.cle] = coches;
        break;
      }

      case 'curseur': {
        const porteur = zone.querySelector('.curseur');
        if (porteur?.dataset.touche === '1') {
          donnees[q.cle] = Number(zone.querySelector('input[type=range]').value);
        }
        break;
      }

      case 'note': {
        const n = Number(zone.querySelector('.etoiles')?.dataset.valeur || 0);
        if (n) donnees[q.cle] = n;
        break;
      }

      case 'emojis': {
        const choisis = [...zone.querySelectorAll('.bouton-emoji.actif')].map(b => b.dataset.emoji);
        if (choisis.length) donnees[q.cle] = choisis;
        break;
      }

      default: {
        const val = zone.querySelector(`[name="${cssEchappe(q.cle)}"]`)?.value.trim();
        if (val) donnees[q.cle] = val;
      }
    }

    // La question des fêtes n'a pas la même formulation pour tout le
    // monde : on garde celle que j'ai réellement vue.
    if (q.feteChoisie && donnees[q.cle]) donnees[q.cle + '_intitule'] = q.intitule;
  }
  return donnees;
}

/**
 * Traduit mes réponses vers les identifiants de questions d'une
 * édition donnée. C'est ce qui permet qu'un seul formulaire
 * alimente plusieurs groupes aux questions différentes.
 */
function contenuPourEdition(edition, mesReponses, posees) {
  const contenu = {};

  for (const q of edition.questions ?? []) {
    const cle = cleDeQuestion(q);
    if (cle in mesReponses) contenu[q.id] = mesReponses[cle];
    if ((cle + '_lien') in mesReponses) contenu[q.id + '_lien'] = mesReponses[cle + '_lien'];
    if ((cle + '_intitule') in mesReponses) contenu[q.id + '_intitule'] = mesReponses[cle + '_intitule'];
  }

  // Les questions posées dans CE groupe seulement.
  for (const q of posees) {
    if (q.edition_id !== edition.id) continue;
    const cle = 'q_' + q.id;
    if (cle in mesReponses) contenu[cle] = mesReponses[cle];
  }
  return contenu;
}

/* ==========================================================
   Le choix des groupes
   ========================================================== */
function carteGroupes() {
  const lignes = mesGroupesListe.map(g => {
    const ed = editionsDuMois.find(e => e.groupe_id === g.id);
    const dejaEnvoye = ed && envois[ed.id]?.envoyee;
    const peutRecevoir = true;   // ouvrir un numéro n'est plus réservé aux admins

    let etat = '';
    if (dejaEnvoye) etat = 'Déjà envoyée. Coche pour la remplacer par cette version.';
    else if (ed) etat = 'En attente de ta page.';
    else etat = `Le questionnaire de ${moisEnLettres(mois)} sera ouvert pour ce groupe.`;

    // On ne recoche pas un groupe déjà servi : en revenant pour un
    // autre groupe, on modifie souvent sa page, et cette version ne
    // doit pas repartir chez ceux qui ont déjà la leur.
    const coche = peutRecevoir && !dejaEnvoye;

    return `<label class="ligne-groupe ${peutRecevoir ? '' : 'inactive'} ${dejaEnvoye ? 'servie' : ''}">
      <input type="checkbox" name="groupe" value="${txt(g.id)}"
             ${coche ? 'checked' : ''} ${peutRecevoir ? '' : 'disabled'}>
      <span class="emoji-groupe">${txt(g.emoji || '🎀')}</span>
      <span class="texte-groupe">
        <strong>${txt(g.nom)}</strong>
        <span class="discret">${txt(etat)}</span>
      </span>
    </label>`;
  }).join('');

  return `
    <div class="separateur">· · ·</div>
    <div class="carte carte-envoi">
      <span class="surtitre">Dernière étape</span>
      <h3 style="margin:2px 0 6px">À qui tu l'envoies ?</h3>
      <p class="discret" style="margin-bottom:16px">
        La même page part dans tous les groupes cochés. Tu peux en laisser
        un de côté : en revenant ici, tout sera déjà pré-rempli et tu
        pourras modifier avant de l'envoyer. Les groupes qui ont déjà ta
        page ne sont pas recochés, pour que tes retouches ne repartent pas
        chez eux sans que tu le veuilles.
      </p>
      <div class="pile" style="gap:8px">${lignes}</div>
      <div class="rangee" style="gap:10px;margin-top:20px">
        <button class="btn large" type="button" id="btn-envoyer">Envoyer ma page</button>
      </div>
      <p class="discret" id="etat-brouillon" style="margin-top:10px;text-align:center"></p>
    </div>`;
}

function brancherEnvoi() {
  $('#btn-envoyer').addEventListener('click', async () => {
    const bouton = $('#btn-envoyer');
    const choisis = [...vue.querySelectorAll('input[name=groupe]:checked')].map(c => c.value);

    if (!choisis.length) {
      alerte($('#retour'), 'info', 'Coche au moins un groupe avant d\'envoyer.');
      return;
    }

    clearTimeout(minuteur);
    bouton.disabled = true;
    bouton.textContent = 'Envoi…';

    const mesReponses = lireFormulaire();
    const envoyes = [];
    const rates = [];

    try {
      await enregistrerBrouillon(mois, mesReponses, medias);

      const posees = await questionsPosees(editionsDuMois.map(e => e.id));

      for (const groupeId of choisis) {
        const groupe = mesGroupesListe.find(g => g.id === groupeId);
        let ed = editionsDuMois.find(e => e.groupe_id === groupeId);

        // Pas encore de numéro ce mois-ci : on l'ouvre. Toute membre
        // du groupe en a le droit.
        if (!ed) {
          ed = await ouvrirPourGroupe(groupeId, mois);
          if (!ed) { rates.push(groupe?.nom ?? 'un groupe'); continue; }
        }

        await enregistrerReponse(ed.id, contenuPourEdition(ed, mesReponses, posees), medias, true);
        envoyes.push(groupe?.nom ?? 'un groupe');
      }
    } catch (err) {
      bouton.disabled = false;
      bouton.textContent = 'Envoyer ma page';
      alerte($('#retour'), 'erreur', err.message);
      return;
    }

    await afficher();
    if (envoyes.length) {
      alerte($('#retour'), 'ok',
        'Ta page est partie dans : ' + envoyes.join(', ') + '.');
    }
    if (rates.length) {
      alerte($('#retour'), 'erreur',
        'Impossible d\'ouvrir le questionnaire dans : ' + rates.join(', ') + '.');
    }
  });
}

/* ==========================================================
   Les comportements de chaque format
   ========================================================== */
function brancherFormats() {
  const form = $('#form-reponse');

  form.querySelectorAll('.curseur').forEach(c => {
    const glissiere = c.querySelector('input[type=range]');
    const valeur = c.querySelector('.valeur-curseur');
    glissiere.addEventListener('input', () => {
      c.dataset.touche = '1';
      valeur.textContent = glissiere.value;
      planifierEnregistrement();
    });
  });

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

  form.querySelectorAll('[data-emojis-pour]').forEach(palette => {
    const compteur = palette.parentElement.querySelector('.compteur-emojis');
    palette.querySelectorAll('.bouton-emoji').forEach(b =>
      b.addEventListener('click', () => {
        const actifs = palette.querySelectorAll('.bouton-emoji.actif').length;
        if (!b.classList.contains('actif') && actifs >= 3) {
          alerte($('#retour'), 'info', 'Trois emojis maximum. Retires-en un d\'abord.');
          return;
        }
        b.classList.toggle('actif');
        compteur.textContent = palette.querySelectorAll('.bouton-emoji.actif').length + ' / 3';
        planifierEnregistrement();
      }));
  });

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

  // La dictée, sur tous les champs de texte libre.
  form.querySelectorAll('[data-dictee]').forEach(c =>
    brancherDictee(c, planifierEnregistrement));
}

/* ==========================================================
   Mode « 5 minutes »
   ========================================================== */
/**
 * Les questions gardées par le mode « 5 minutes ».
 *
 * On ne se fie pas au seul repère `express` enregistré dans le
 * numéro : les numéros ouverts avant son ajout ne l'ont pas, et le
 * mode masquait alors TOUT le formulaire. On croise donc trois
 * sources, et on garde un filet de sécurité.
 */
function clesExpress() {
  const vraies = questions.filter(q => !q.titreSection);
  const estPosee = q => String(q.cle).startsWith('q_');

  // Une question qu'une copine m'adresse personnellement passe
  // toujours : c'est la plus importante de toutes.
  const perso = vraies.filter(q => estPosee(q) && q.express);

  let base = vraies.filter(q =>
    !estPosee(q) && (q.express === true || IDS_EXPRESS.includes(q.id)));

  // Filet de sécurité : si le numéro ne porte aucun repère, on prend
  // simplement les premières questions du tronc commun.
  if (base.length < 3) {
    base = vraies.filter(q => !estPosee(q)).slice(0, NB_QUESTIONS_EXPRESS);
  }

  const cles = new Set(base.slice(0, NB_QUESTIONS_EXPRESS).map(q => q.cle));
  for (const q of perso) cles.add(q.cle);
  return cles;
}

function brancherExpress() {
  $('#btn-express').addEventListener('click', () => {
    express = !express;
    appliquerExpress();
  });
}

function appliquerExpress() {
  const form = $('#form-reponse');
  const gardees = express ? clesExpress() : null;
  let visibles = 0;
  let total = 0;

  form.querySelectorAll('[data-question]').forEach(zone => {
    if (zone.classList.contains('titre-section')) {
      // En mode court, les titres de section n'ont plus de sens.
      zone.classList.toggle('cache', express);
      return;
    }
    total++;
    const garde = !express || gardees.has(zone.dataset.question);
    if (garde) visibles++;
    zone.classList.toggle('cache', !garde);
  });

  const bouton = $('#btn-express');
  if (bouton) {
    bouton.textContent = express
      ? `Tout afficher (${total} questions)`
      : 'Mode 5 minutes';
  }
  const note = $('#note-express');
  if (note) {
    note.textContent = express
      ? `${visibles} question${visibles > 1 ? 's' : ''} sur ${total}. L'essentiel, et ce qu'une copine t'a demandé.`
      : '';
    note.classList.toggle('cache', !express);
  }
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
   La photo de couverture : une seule, à part des autres
   ========================================================== */
function brancherPortraits() {
  vue.querySelectorAll('[data-portrait]').forEach(depot => {
    const cle = depot.dataset.portrait;
    const fichier = depot.querySelector('input[type=file]');
    const cache = vue.querySelector(`input[type=hidden][name="${cssEchappe(cle)}"]`);
    const apercu = vue.querySelector(`[data-apercu="${cssEchappe(cle)}"]`);

    const dessiner = url => {
      apercu.innerHTML = url
        ? `<div class="vignette"><img src="${txt(url)}" alt="">
             <button type="button" data-oter="${txt(cle)}" title="Retirer">×</button>
           </div>`
        : '';
      apercu.querySelector('[data-oter]')?.addEventListener('click', () => {
        cache.value = '';
        dessiner('');
        planifierEnregistrement();
      });
    };
    dessiner(cache.value);

    depot.addEventListener('click', e => {
      if (e.target.closest('[data-oter]')) return;
      fichier.click();
    });

    fichier.addEventListener('change', async () => {
      const f = fichier.files[0];
      if (!f) return;
      if (f.size > 50 * 1024 * 1024) {
        return alerte($('#retour'), 'erreur', `${f.name} dépasse 50 Mo.`);
      }
      apercu.innerHTML = '<div class="vignette"><div class="tourne" style="margin:28px auto"></div></div>';
      try {
        const media = await envoyerMedia(f);
        cache.value = media.url;
        dessiner(media.url);
        planifierEnregistrement();
      } catch (err) {
        dessiner(cache.value);
        alerte($('#retour'), 'erreur', 'Envoi impossible : ' + err.message);
      }
    });
  });
}

/* ==========================================================
   Le brouillon, enregistré tout seul
   ========================================================== */
function planifierEnregistrement() {
  const etat = $('#etat-brouillon');
  if (etat) etat.textContent = 'Modifications en cours…';
  clearTimeout(minuteur);
  minuteur = setTimeout(sauver, 2000);
}

async function sauver() {
  const etat = $('#etat-brouillon');
  try {
    await enregistrerBrouillon(mois, lireFormulaire(), medias);
    if (etat) {
      const h = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      etat.textContent = `Brouillon enregistré à ${h}`;
    }
  } catch (err) {
    if (etat) etat.textContent = '';
    alerte($('#retour'), 'erreur', 'Enregistrement impossible : ' + err.message);
  }
}

function brancherEnregistrement() {
  const form = $('#form-reponse');
  const surSaisie = e => { if (e.target.type !== 'file') planifierEnregistrement(); };
  form.addEventListener('input', surSaisie);
  form.addEventListener('change', surSaisie);

  window.addEventListener('beforeunload', () => {
    if (minuteur) { clearTimeout(minuteur); sauver(); }
  });
}

/* ==========================================================
   Poser une question ce mois-ci
   ========================================================== */
function cartePoserQuestion(mesPosees) {
  if (!editionsDuMois.length) return '';

  return `
    <div class="separateur">· · ·</div>
    <div class="carte">
      <h3>Pose une question ce mois-ci</h3>
      <p class="discret" style="margin:6px 0 16px">
        Elle s'ajoutera au questionnaire de ce numéro. La réponse paraîtra
        dans l'édition. Et la personne reste libre de passer.
      </p>

      ${mesPosees.length ? `
      <div class="pile" style="gap:8px;margin-bottom:18px">
        ${mesPosees.map(q => {
          const ed = editionsDuMois.find(e => e.id === q.edition_id);
          return `<div class="rangee espace ligne-membre">
            <div>
              <strong>${txt(q.texte)}</strong>
              <p class="discret" style="margin:0">
                ${txt(ed?.groupe.nom ?? 'un groupe')} ·
                ${q.destinataire_id
                  ? txt(q.destinataire?.prenom || 'une copine')
                  : 'tout le groupe'}
              </p>
            </div>
            <button class="btn fil petit" data-retirer-question="${txt(q.id)}">Retirer</button>
          </div>`;
        }).join('')}
      </div>` : ''}

      <form id="form-question">
        <label class="champ">
          <span class="intitule">Ta question</span>
          <textarea name="texte" maxlength="300" required data-dictee-question="1"
                    placeholder="Par exemple : qu'est-ce que tu as fait de ton samedi ?"></textarea>
        </label>
        <label class="champ">
          <span class="intitule">Dans quel groupe ?</span>
          <select name="edition" id="choix-edition-question">
            ${editionsDuMois.map(e => `
              <option value="${txt(e.id)}">${txt(e.groupe.emoji)} ${txt(e.groupe.nom)}</option>`).join('')}
          </select>
        </label>
        <label class="champ">
          <span class="intitule">Tu la poses à qui ?</span>
          <select name="destinataire" id="choix-destinataire">
            <option value="">Tout le groupe</option>
          </select>
        </label>
        <button class="btn doux" type="submit">Poser la question</button>
      </form>
    </div>`;
}

function brancherPoserQuestion() {
  const form = $('#form-question');
  if (!form) return;

  const champTexte = form.querySelector('[data-dictee-question]');
  if (champTexte) brancherDictee(champTexte);

  // La liste des destinataires suit le groupe choisi.
  async function majDestinataires() {
    const ed = editionsDuMois.find(e => e.id === $('#choix-edition-question').value);
    const select = $('#choix-destinataire');
    select.innerHTML = '<option value="">Tout le groupe</option>';
    if (!ed) return;
    const membres = await membresDuGroupe(ed.groupe_id);
    for (const m of membres) {
      if (!m.profile_id || m.profile_id === profil.id) continue;
      const o = document.createElement('option');
      o.value = m.profile_id;
      o.textContent = m.prenom || m.email;
      select.appendChild(o);
    }
  }
  $('#choix-edition-question').addEventListener('change', majDestinataires);
  majDestinataires();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const b = e.target.querySelector('button');
    b.disabled = true;
    try {
      await poserQuestion(e.target.edition.value, e.target.texte.value, e.target.destinataire.value);
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
