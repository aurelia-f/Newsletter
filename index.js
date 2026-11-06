// ==========================================================
//  Page : index.html — connexion par lien magique
// ==========================================================
import { sb, configOk, sessionActuelle, envoyerLienMagique } from './db.js';
import { NOM_DU_SITE, BASELINE } from './config.js';
import { $, txt, alerte } from './ui.js';

const vue = $('#vue');

if (!configOk()) {
  vue.innerHTML = `<div class="page etroit"><div class="carte">
    <h2>Presque prêt</h2>
    <p style="margin-top:10px">Ouvre le fichier <code>config.js</code> et colle
    l'adresse de ton projet Supabase et ta clé « anon ». Le site démarrera tout seul.</p>
  </div></div>`;
} else {
  demarrer();
}

async function demarrer() {
  // Déjà connectée ? On file directement aux groupes.
  if (await sessionActuelle()) { location.replace('groupes.html'); return; }

  // Le lien magique dépose la session au chargement : on attend l'événement.
  sb.auth.onAuthStateChange((evenement) => {
    if (evenement === 'SIGNED_IN') location.replace('groupes.html');
  });

  afficher();
}

function afficher() {
  vue.innerHTML = `
    <div class="page etroit">
      <div class="couverture">
        <img class="logo" src="logo.png" alt="">
        <span class="numero">Newsletter privée</span>
        <h1>${txt(NOM_DU_SITE)}</h1>
        <p class="mois">${txt(BASELINE)}</p>
      </div>

      <div class="carte">
        <h2>Connexion</h2>
        <p class="discret" style="margin:8px 0 20px">
          Pas de mot de passe à retenir. Tu tapes ton adresse, tu reçois
          un lien, tu cliques. C'est tout.
        </p>
        <form id="form-connexion">
          <label class="champ">
            <span class="intitule">Ton adresse e-mail</span>
            <input type="email" name="email" required placeholder="toi@exemple.com"
                   autocomplete="email">
          </label>
          <button class="btn large" type="submit">Recevoir mon lien de connexion</button>
        </form>
        <div id="retour"></div>
      </div>
    </div>`;

  $('#form-connexion').addEventListener('submit', async e => {
    e.preventDefault();
    const bouton = e.target.querySelector('button');
    const email = e.target.email.value;
    bouton.disabled = true;
    bouton.textContent = 'Envoi…';
    try {
      await envoyerLienMagique(email);
      $('#retour').innerHTML = `
        <div class="message ok" style="margin-top:16px">
          C'est parti ! Un lien vient de partir vers ${txt(email)}.
          Ouvre ta boîte mail et clique dessus — pense à regarder dans les spams.
        </div>`;
      e.target.classList.add('cache');
    } catch (err) {
      alerte($('#retour'), 'erreur', err.message || 'Envoi impossible.');
      bouton.disabled = false;
      bouton.textContent = 'Recevoir mon lien de connexion';
    }
  });
}
