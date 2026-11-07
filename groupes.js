// ==========================================================
//  Page : groupes.html — la liste de mes groupes
//  Deux onglets : ceux que je gère, ceux où je participe.
// ==========================================================
import { exigerSession, brancherEntete, afficherErreur, exigerPrenom,
         mesGroupes, creerGroupe } from './db.js';
import { $, txt, messageVide, alerte } from './ui.js';

const vue = $('#vue');

if (await exigerSession()) {
  const profil = await brancherEntete();
  // Première connexion : on demande le prénom avant tout le reste.
  if (!exigerPrenom(profil)) {
    try { await afficher(profil); } catch (err) { afficherErreur(err); }
  }
}

async function afficher(profil) {
  const groupes = await mesGroupes();
  const prenom = profil?.prenom || '';

  const adminGroupes  = groupes.filter(g => g.role === 'admin');
  const membreGroupes = groupes.filter(g => g.role !== 'admin');

  // L'onglet n'apparaît que si j'ai au moins un groupe dedans.
  // Si je ne suis que membre, aucun onglet « Admin » ne s'affiche.
  const onglets = [];
  if (adminGroupes.length)  onglets.push('admin');
  if (membreGroupes.length) onglets.push('membre');

  const demande = location.hash.replace('#', '');
  const actif = onglets.includes(demande) ? demande : (onglets[0] ?? null);

  const barre = onglets.length > 1 ? `
    <div class="onglets" role="tablist">
      <button class="onglet ${actif === 'admin' ? 'actif' : ''}" data-onglet="admin" role="tab">
        Je gère <span class="compteur">${adminGroupes.length}</span>
      </button>
      <button class="onglet ${actif === 'membre' ? 'actif' : ''}" data-onglet="membre" role="tab">
        Je participe <span class="compteur">${membreGroupes.length}</span>
      </button>
    </div>` : '';

  const panneauAdmin = `
    <section class="panneau ${actif === 'admin' ? '' : 'cache'}" data-panneau="admin">
      <details class="carte carte-role depliant">
        <summary>
          <span><strong>Tu es administratrice</strong> · ton rôle</span>
          <span class="fleche">▾</span>
        </summary>
        <div class="depliant-corps">
        <p class="discret" style="margin-bottom:14px">
          Dans ces groupes, c'est toi la rédactrice en chef. Concrètement :
        </p>
        <ul class="liste-role">
          <li><strong>Inviter les copines</strong> par e-mail, et les retirer.</li>
          <li><strong>Ouvrir l'édition du mois</strong> — sans ça, personne ne peut répondre.</li>
          <li><strong>Publier</strong> quand tu estimes qu'il y a assez de réponses : tout le groupe peut alors lire.</li>
          <li><strong>Nommer une co-admin</strong> pour t'aider à relancer et publier.</li>
          <li>Et comme tout le monde, <strong>répondre au questionnaire</strong>.</li>
        </ul>
        <p class="discret" style="margin-top:14px">
          Le rythme qui marche : tu ouvres l'édition le 1er, tu relances vers le 20,
          tu publies le 1er du mois suivant.
        </p>
        </div>
      </details>
      ${grille(adminGroupes, 'Tu gères ce groupe')}
    </section>`;

  const panneauMembre = `
    <section class="panneau ${actif === 'membre' ? '' : 'cache'}" data-panneau="membre">
      <details class="carte carte-role depliant">
        <summary>
          <span><strong>Tu es membre</strong> · ton rôle</span>
          <span class="fleche">▾</span>
        </summary>
        <div class="depliant-corps">
          <p class="discret">
            Une copine gère ces groupes. Toi, tu réponds au questionnaire chaque mois
            et tu lis les éditions dès qu'elles sont publiées. Rien d'autre à faire.
          </p>
        </div>
      </details>
      ${grille(membreGroupes, 'Membre')}
    </section>`;

  const contenu = onglets.length
    ? (adminGroupes.length ? panneauAdmin : '') + (membreGroupes.length ? panneauMembre : '')
    : messageVide('🎀', 'Aucun groupe pour l\'instant',
        'Crée ton premier groupe ci-dessous, puis invite tes copines par e-mail.');

  vue.innerHTML = `
    <div class="page">
      <span class="surtitre">Bonjour ${txt(prenom)}</span>
      <h1 style="margin:4px 0 22px">Tes groupes</h1>
      ${barre}
      ${contenu}
      <div class="separateur">· · ·</div>
      <div class="carte">
        <h3>Créer un nouveau groupe</h3>
        <p class="discret" style="margin:6px 0 16px">
          Un groupe par bande de copines. Elles ne voient que le leur.
          Tu en seras l'administratrice.
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

  // Bascule d'onglet, sans recharger la page.
  vue.querySelectorAll('[data-onglet]').forEach(b =>
    b.addEventListener('click', () => {
      const cible = b.dataset.onglet;
      history.replaceState(null, '', '#' + cible);
      vue.querySelectorAll('[data-onglet]').forEach(o =>
        o.classList.toggle('actif', o.dataset.onglet === cible));
      vue.querySelectorAll('[data-panneau]').forEach(p =>
        p.classList.toggle('cache', p.dataset.panneau !== cible));
    }));

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

function grille(groupes, mention) {
  if (!groupes.length) return '';
  return `<div class="grille">${groupes.map(g => `
    <a class="carte carte-groupe cliquable" style="text-decoration:none;display:block"
       href="groupe.html?id=${encodeURIComponent(g.id)}">
      <span class="emoji">${txt(g.emoji || '🎀')}</span>
      <h3>${txt(g.nom)}</h3>
      <p class="discret">${txt(g.jeSuisLaCreatrice ? 'Tu as créé ce groupe' : mention)}</p>
    </a>`).join('')}</div>`;
}
