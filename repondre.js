// ==========================================================
//  Page : repondre.html?id=… — le formulaire du mois
// ==========================================================
import { exigerSession, brancherDeconnexion, afficherErreur,
         edition, maReponse, enregistrerReponse, envoyerMedia } from './db.js';
import { $, txt, moisEnLettres, alerte } from './ui.js';

const vue = $('#vue');
const editionId = new URLSearchParams(location.search).get('id');

if (await exigerSession()) {
  brancherDeconnexion();
  try { await afficher(); } catch (err) { afficherErreur(err); }
}

async function afficher() {
  const ed = await edition(editionId);

  // Une édition publiée se lit, elle ne se remplit plus.
  if (ed.statut === 'publiee') {
    location.replace('edition.html?id=' + encodeURIComponent(editionId));
    return;
  }

  const existante = await maReponse(editionId);
  const contenu = existante?.contenu ?? {};
  let medias = existante?.medias ?? [];

  const champs = ed.questions.map(q => {
    const v = txt(contenu[q.id] ?? '');
    const entete = `<span class="intitule">${txt(q.intitule)}</span>
      ${q.aide ? `<span class="aide">${txt(q.aide)}</span>` : ''}`;

    if (q.type === 'photos') {
      return `<div class="champ">${entete}
        <div class="depot" id="depot">
          <input type="file" id="fichiers" multiple accept="image/*,video/*">
          <strong>Choisir des photos ou des vidéos</strong>
          <p class="discret">ou glisse-les ici</p>
        </div>
        <div class="vignettes" id="vignettes"></div>
      </div>`;
    }
    if (q.type === 'musique') {
      return `<div class="champ">${entete}
        <input type="text" name="${txt(q.id)}" value="${v}" placeholder="Titre — Artiste" style="margin-bottom:8px">
        <input type="url" name="${txt(q.id)}_lien" value="${txt(contenu[q.id + '_lien'] ?? '')}"
               placeholder="Lien Spotify ou YouTube (facultatif)">
      </div>`;
    }
    if (q.type === 'long') {
      return `<label class="champ">${entete}<textarea name="${txt(q.id)}">${v}</textarea></label>`;
    }
    return `<label class="champ">${entete}<input type="text" name="${txt(q.id)}" value="${v}"></label>`;
  }).join('');

  vue.innerHTML = `
    <div class="page etroit">
      <a href="groupe.html?id=${encodeURIComponent(ed.groupe.id)}" class="discret">← ${txt(ed.groupe.nom)}</a>
      <div class="couverture" style="padding:34px 24px">
        <span class="numero">Numéro ${ed.numero}</span>
        <h1>${txt(moisEnLettres(ed.mois))}</h1>
        <p class="mois">À toi de raconter</p>
      </div>
      ${existante?.envoyee ? `<div class="message ok">Ta réponse est enregistrée.
        Tu peux encore la modifier jusqu'à la publication.</div>` : ''}
      <div class="message info">
        Tout est facultatif — réponds à ce qui te parle, saute le reste.
      </div>
      <form id="form-reponse" class="carte">
        ${champs}
        <div class="rangee" style="gap:10px;margin-top:8px">
          <button class="btn" type="submit">Envoyer ma page</button>
          <button class="btn fil" type="button" id="btn-brouillon">Enregistrer sans envoyer</button>
        </div>
      </form>
      <div id="retour"></div>
    </div>`;

  /* ---------- photos et vidéos ---------- */
  const zoneVignettes = $('#vignettes');
  const depot = $('#depot');

  function dessinerVignettes() {
    if (!zoneVignettes) return;
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
        dessinerVignettes();
      }));
  }
  dessinerVignettes();

  async function ajouterFichiers(liste) {
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
      dessinerVignettes();
    }
  }

  if (depot) {
    const input = $('#fichiers');
    depot.addEventListener('click', () => input.click());
    input.addEventListener('change', () => ajouterFichiers([...input.files]));
    ['dragenter', 'dragover'].forEach(ev =>
      depot.addEventListener(ev, e => { e.preventDefault(); depot.classList.add('survol'); }));
    ['dragleave', 'drop'].forEach(ev =>
      depot.addEventListener(ev, e => { e.preventDefault(); depot.classList.remove('survol'); }));
    depot.addEventListener('drop', e => ajouterFichiers([...e.dataTransfer.files]));
  }

  /* ---------- enregistrement ---------- */
  async function enregistrer(envoyee) {
    const donnees = {};
    new FormData($('#form-reponse')).forEach((v, k) => {
      if (String(v).trim()) donnees[k] = String(v).trim();
    });
    await enregistrerReponse(editionId, donnees, medias, envoyee);
  }

  $('#form-reponse').addEventListener('submit', async e => {
    e.preventDefault();
    const b = e.target.querySelector('button[type=submit]');
    b.disabled = true; b.textContent = 'Envoi…';
    try {
      await enregistrer(true);
      location.href = 'groupe.html?id=' + encodeURIComponent(ed.groupe.id);
    } catch (err) {
      alerte($('#retour'), 'erreur', err.message);
      b.disabled = false; b.textContent = 'Envoyer ma page';
    }
  });

  $('#btn-brouillon').addEventListener('click', async () => {
    try {
      await enregistrer(false);
      alerte($('#retour'), 'ok', 'Brouillon enregistré. Reviens quand tu veux.');
    } catch (err) { alerte($('#retour'), 'erreur', err.message); }
  });
}
