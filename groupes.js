// ==========================================================
//  Page : groupes.html — la liste de mes groupes
// ==========================================================
import { exigerSession, brancherDeconnexion, afficherErreur,
         monProfil, mesGroupes, creerGroupe } from './db.js';
import { $, txt, messageVide, alerte } from './ui.js';

const vue = $('#vue');

if (await exigerSession()) {
  brancherDeconnexion();
  try { await afficher(); } catch (err) { afficherErreur(err); }
}

async function afficher() {
  const [profil, groupes] = await Promise.all([monProfil(), mesGroupes()]);
  const prenom = profil?.prenom || '';

  const cartes = groupes.length
    ? `<div class="grille">${groupes.map(g => `
        <a class="carte carte-groupe cliquable" style="text-decoration:none;display:block"
           href="groupe.html?id=${encodeURIComponent(g.id)}">
          <span class="emoji">${txt(g.emoji || '🎀')}</span>
          <h3>${txt(g.nom)}</h3>
          <p class="discret">${g.role === 'admin' ? 'Tu gères ce groupe' : 'Membre'}</p>
        </a>`).join('')}</div>`
    : messageVide('🎀', 'Aucun groupe pour l\'instant',
        'Crée ton premier groupe, puis invite tes copines par e-mail.');

  vue.innerHTML = `
    <div class="page">
      <span class="surtitre">Bonjour ${txt(prenom)}</span>
      <h1 style="margin:4px 0 28px">Tes groupes</h1>
      ${cartes}
      <div class="separateur">· · ·</div>
      <div class="carte">
        <h3>Créer un nouveau groupe</h3>
        <p class="discret" style="margin:6px 0 16px">
          Un groupe par bande de copines. Elles ne voient que le leur.
        </p>
        <form id="form-groupe" class="rangee">
          <input type="text" name="emoji" value="🎀" maxlength="4"
                 style="width:70px;text-align:center" aria-label="Emoji">
          <input type="text" name="nom" required placeholder="Les copines du lycée"
                 style="flex:1;min-width:200px">
          <button class="btn" type="submit">Créer</button>
        </form>
      </div>
    </div>`;

  $('#form-groupe').addEventListener('submit', async e => {
    e.preventDefault();
    const b = e.target.querySelector('button');
    b.disabled = true;
    try {
      const g = await creerGroupe(e.target.nom.value, e.target.emoji.value);
      location.href = 'groupe.html?id=' + encodeURIComponent(g.id);
    } catch (err) {
      alerte(vue.querySelector('.page'), 'erreur', err.message);
      b.disabled = false;
    }
  });
}
