// ==========================================================
//  Page : groupe.html?id=… — éditions, membres, administration
// ==========================================================
import { exigerSession, brancherDeconnexion, afficherErreur,
         mesGroupes, editionsDuGroupe, membresDuGroupe, compterReponses,
         ouvrirEdition, publierEdition, inviter, retirerMembre } from './db.js';
import { $, txt, moisEnLettres, moisCourant, initiale, messageVide, alerte } from './ui.js';

const vue = $('#vue');
const groupeId = new URLSearchParams(location.search).get('id');

if (await exigerSession()) {
  brancherDeconnexion();
  try { await afficher(); } catch (err) { afficherErreur(err); }
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
            <span class="etiquette ${publiee ? 'publiee' : 'ouverte'}">
              ${publiee ? 'Publiée' : 'En cours'}
            </span>
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
        ${membres.map(m => `
          <div class="rangee espace" style="background:var(--creme);padding:10px 14px;border-radius:var(--r-m)">
            <div class="rangee" style="gap:10px">
              <span class="pastille" style="width:32px;height:32px;font-size:.9rem">${txt(initiale(m))}</span>
              <div>
                <strong>${txt(m.prenom || m.email.split('@')[0])}</strong>
                <span class="discret"> · ${txt(m.email)}</span>
                ${m.profile_id ? '' : '<span class="etiquette" style="margin-left:6px">en attente</span>'}
              </div>
            </div>
            ${m.role === 'admin' ? '<span class="discret">admin</span>'
              : `<button class="btn fil petit" data-retirer="${txt(m.id)}">Retirer</button>`}
          </div>`).join('')}
      </div>

      <form id="form-invit" class="rangee" style="margin-top:16px">
        <input type="text" name="prenom" placeholder="Prénom" style="width:130px">
        <input type="email" name="email" required placeholder="son@email.com" style="flex:1;min-width:190px">
        <button class="btn doux" type="submit">Inviter</button>
      </form>
      <p class="discret" style="margin-top:8px">
        Elle n'a rien à créer : elle se connecte avec cette adresse et
        tombe directement dans le groupe.
      </p>
    </div>` : '';

  vue.innerHTML = `
    <div class="page">
      <a href="groupes.html" class="discret">← Tous mes groupes</a>
      <h1 style="margin:10px 0 24px">${txt(groupe.emoji)} ${txt(groupe.nom)}</h1>
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

  $('#form-invit')?.addEventListener('submit', async e => {
    e.preventDefault();
    try { await inviter(groupeId, e.target.email.value, e.target.prenom.value); await afficher(); }
    catch (err) {
      alerte(vue.querySelector('.page'), 'erreur',
        err.code === '23505' ? 'Cette adresse est déjà dans le groupe.' : err.message);
    }
  });
}
