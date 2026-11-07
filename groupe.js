// ==========================================================
//  Page : groupe.html?id=… — éditions, membres, administration
// ==========================================================
import { exigerSession, brancherEntete, afficherErreur, exigerPrenom,
         mesGroupes, editionsDuGroupe, membresDuGroupe, compterReponses,
         ouvrirEdition, publierEdition, inviter, retirerMembre,
         changerRole, mesQuestionsARepondre, maReponse } from './db.js';
import { $, txt, moisEnLettres, moisCourant, initiale, messageVide, alerte } from './ui.js';

const vue = $('#vue');
const groupeId = new URLSearchParams(location.search).get('id');

if (await exigerSession()) {
  const profil = await brancherEntete();
  if (!exigerPrenom(profil)) {
    try { await afficher(); } catch (err) { afficherErreur(err); }
  }
}

async function afficher() {
  const groupe = (await mesGroupes()).find(g => g.id === groupeId);
  if (!groupe) {
    vue.innerHTML = `<div class="page">${messageVide('🔒', 'Groupe introuvable',
      'Il a peut-être été supprimé, ou tu n\'en fais plus partie.')}
      <div class="rangee" style="justify-content:center">
        <a class="btn doux" href="groupes.html">Mes groupes</a></div></div>`;
    return;
  }

  const estAdmin = groupe.role === 'admin';
  const [editions, membres] = await Promise.all([
    editionsDuGroupe(groupeId),
    membresDuGroupe(groupeId),
  ]);

  const compte = {};
  await Promise.all(editions.map(async ed => { compte[ed.id] = await compterReponses(ed.id); }));

  // Pour les éditions encore ouvertes : où j'en suis, et si des questions
  // sont arrivées depuis que j'ai envoyé ma page. C'est la relance, à
  // l'intérieur de l'appli — les vrais mails viendront plus tard.
  const monEtat = {};
  await Promise.all(editions
    .filter(e => e.statut === 'ouverte')
    .map(async e => {
      const [aRepondre, ma] = await Promise.all([
        mesQuestionsARepondre(e.id),
        maReponse(e.id),
      ]);
      monEtat[e.id] = {
        envoyee: !!ma?.envoyee,
        brouillon: !!ma && !ma.envoyee,
        nouvelles: ma?.envoyee
          ? aRepondre.filter(q => new Date(q.cree_le) > new Date(ma.maj_le)).length
          : 0,
      };
    }));

  const listeEditions = editions.length
    ? editions.map(ed => {
        const publiee = ed.statut === 'publiee';
        const lien = publiee
          ? 'edition.html?id=' + encodeURIComponent(ed.id)
          : 'repondre.html?id=' + encodeURIComponent(ed.id);
        return `<a class="carte cliquable" href="${lien}"
                   style="text-decoration:none;display:block;margin-bottom:14px">
          <div class="rangee espace">
            <div>
              <span class="surtitre">Numéro ${ed.numero}</span>
              <h3 style="margin:2px 0">${txt(moisEnLettres(ed.mois))}</h3>
              <p class="discret">${compte[ed.id]} réponse${compte[ed.id] > 1 ? 's' : ''} sur ${membres.length}</p>
            </div>
            <div class="pile" style="gap:6px;align-items:flex-end">
              <span class="etiquette ${publiee ? 'publiee' : 'ouverte'}">
                ${publiee ? 'Publiée' : 'En cours'}
              </span>
              ${etiquetteEtat(monEtat[ed.id])}
            </div>
          </div>
        </a>`;
      }).join('')
    : messageVide('📬', 'Aucune édition', estAdmin
        ? 'Ouvre la première ci-dessous.' : 'Patience, ça arrive.');

  const dejaCeMois = editions.some(e => e.mois === moisCourant());

  const blocAdmin = estAdmin ? `
    <div class="separateur">· · ·</div>
    <div class="carte">
      <h3>Administration</h3>

      ${dejaCeMois ? '' : `
      <p class="discret" style="margin:10px 0 14px">
        Ouvre l'édition de ${txt(moisEnLettres(moisCourant()))} pour que tout
        le monde puisse commencer à répondre.
      </p>
      <button class="btn" id="btn-ouvrir">Ouvrir l'édition de ${txt(moisEnLettres(moisCourant()))}</button>`}

      ${editions.filter(e => e.statut === 'ouverte').map(e => `
        <div class="rangee espace" style="margin-top:18px;padding-top:16px;border-top:1px solid var(--creme-fonce)">
          <span>Numéro ${e.numero} — ${txt(moisEnLettres(e.mois))}</span>
          <button class="btn petit" data-publier="${txt(e.id)}">Publier maintenant</button>
        </div>`).join('')}

      <h3 style="margin:26px 0 10px">Les copines (${membres.length})</h3>
      <div class="pile" style="gap:8px">
        ${membres.map(m => ligneMembre(m, groupe)).join('')}
      </div>
      <p class="discret" style="margin-top:10px">
        Une co-administratrice peut inviter, retirer, ouvrir et publier —
        tout comme toi. Elle ne peut ni supprimer le groupe, ni te retirer.
      </p>

      <form id="form-invit" class="rangee" style="margin-top:16px">
        <input type="text" name="prenom" placeholder="Prénom" style="width:130px">
        <input type="email" name="email" required placeholder="son@email.com" style="flex:1;min-width:190px">
        <button class="btn doux" type="submit">Inviter</button>
      </form>
      <p class="discret" style="margin-top:8px">
        Elle n'a rien à créer : elle se connecte avec cette adresse et
        tombe directement dans le groupe.
      </p>
    </div>` : `
    <div class="separateur">· · ·</div>
    <div class="carte">
      <h3>Les copines (${membres.length})</h3>
      <div class="pile" style="gap:8px;margin-top:12px">
        ${membres.map(m => ligneMembre(m, groupe, false)).join('')}
      </div>
    </div>`;

  vue.innerHTML = `
    <div class="page">
      <a href="groupes.html" class="discret">← Tous mes groupes</a>
      <h1 style="margin:10px 0 8px">${txt(groupe.emoji)} ${txt(groupe.nom)}</h1>
      <p class="discret" style="margin-bottom:24px">
        ${estAdmin
          ? (groupe.jeSuisLaCreatrice
              ? 'Tu as créé ce groupe, tu en es administratrice.'
              : 'Tu es co-administratrice de ce groupe.')
          : 'Tu es membre de ce groupe.'}
      </p>
      ${listeEditions}
      ${blocAdmin}
    </div>`;

  $('#btn-ouvrir')?.addEventListener('click', async e => {
    e.target.disabled = true;
    try { await ouvrirEdition(groupeId, moisCourant()); await afficher(); }
    catch (err) { alerte(vue.querySelector('.page'), 'erreur', err.message); }
  });

  vue.querySelectorAll('[data-publier]').forEach(b =>
    b.addEventListener('click', async () => {
      if (!confirm('Publier cette édition ? Toutes les copines pourront la lire.')) return;
      try { await publierEdition(b.dataset.publier); await afficher(); }
      catch (err) { alerte(vue.querySelector('.page'), 'erreur', err.message); }
    }));

  vue.querySelectorAll('[data-retirer]').forEach(b =>
    b.addEventListener('click', async () => {
      if (!confirm('Retirer cette copine du groupe ?')) return;
      try { await retirerMembre(b.dataset.retirer); await afficher(); }
      catch (err) { alerte(vue.querySelector('.page'), 'erreur', err.message); }
    }));

  vue.querySelectorAll('[data-promouvoir]').forEach(b =>
    b.addEventListener('click', async () => {
      if (!confirm('La nommer co-administratrice ? Elle pourra inviter, retirer, ouvrir et publier.')) return;
      try { await changerRole(b.dataset.promouvoir, 'admin'); await afficher(); }
      catch (err) { alerte(vue.querySelector('.page'), 'erreur', err.message); }
    }));

  vue.querySelectorAll('[data-retrograder]').forEach(b =>
    b.addEventListener('click', async () => {
      if (!confirm('Lui retirer le rôle d\'administratrice ? Elle restera membre du groupe.')) return;
      try { await changerRole(b.dataset.retrograder, 'membre'); await afficher(); }
      catch (err) { alerte(vue.querySelector('.page'), 'erreur', err.message); }
    }));

  $('#form-invit')?.addEventListener('submit', async e => {
    e.preventDefault();
    try { await inviter(groupeId, e.target.email.value, e.target.prenom.value); await afficher(); }
    catch (err) {
      alerte(vue.querySelector('.page'), 'erreur',
        err.code === '23505' ? 'Cette adresse est déjà dans le groupe.' : err.message);
    }
  });
}

/** Où j'en suis sur une édition ouverte : à remplir, brouillon, nouvelles questions. */
function etiquetteEtat(etat) {
  if (!etat) return '';
  if (etat.nouvelles) {
    return `<span class="etiquette nouveau">${etat.nouvelles} nouvelle${
      etat.nouvelles > 1 ? 's' : ''} question${etat.nouvelles > 1 ? 's' : ''}</span>`;
  }
  if (etat.envoyee)   return '<span class="etiquette faite">Ta page est envoyée</span>';
  if (etat.brouillon) return '<span class="etiquette ouverte">Brouillon en cours</span>';
  return '<span class="etiquette">À remplir</span>';
}

/** Une ligne de la liste des copines. `actions` = je suis admin. */
function ligneMembre(m, groupe, actions = true) {
  const estCreatrice = m.profile_id && m.profile_id === groupe.cree_par;
  const vignette = m.avatar_url
    ? `<img src="${txt(m.avatar_url)}" alt="">`
    : `<span>${txt(initiale(m))}</span>`;

  let droite = '';
  if (estCreatrice) {
    droite = '<span class="etiquette">Créatrice</span>';
  } else if (actions) {
    droite = m.role === 'admin'
      ? `<div class="rangee" style="gap:6px">
           <span class="etiquette">Co-admin</span>
           <button class="btn fil petit" data-retrograder="${txt(m.id)}">Retirer le rôle</button>
           <button class="btn fil petit" data-retirer="${txt(m.id)}">Retirer</button>
         </div>`
      : `<div class="rangee" style="gap:6px">
           <button class="btn doux petit" data-promouvoir="${txt(m.id)}">Nommer co-admin</button>
           <button class="btn fil petit" data-retirer="${txt(m.id)}">Retirer</button>
         </div>`;
  } else if (m.role === 'admin') {
    droite = '<span class="etiquette">Co-admin</span>';
  }

  return `<div class="rangee espace ligne-membre">
    <div class="rangee" style="gap:10px">
      <span class="pastille petite">${vignette}</span>
      <div>
        <strong>${txt(m.prenom || m.email.split('@')[0])}</strong>
        <span class="discret"> · ${txt(m.email)}</span>
        ${m.profile_id ? '' : '<span class="etiquette" style="margin-left:6px">En attente</span>'}
      </div>
    </div>
    ${droite}
  </div>`;
}
