// ==========================================================
//  Page : groupes.html · la liste de mes groupes
//  Deux onglets : ceux que je gère, ceux où je participe.
// ==========================================================
import { exigerSession, brancherEntete, afficherErreur, exigerPrenom,
         mesGroupes, creerGroupe, editionsOuvertes, mesEnvois,
         synchroniserBanque } from './db.js';
import { PALETTE_EMOJIS_GROUPE } from './config.js';
import { tutoSiPremiereVisite } from './tuto.js';
import { $, txt, moisEnLettres, moisCourant, messageVide, alerte } from './ui.js';

const vue = $('#vue');

if (await exigerSession()) {
  const profil = await brancherEntete();
  // Première connexion : on demande le prénom avant tout le reste.
  if (!exigerPrenom(profil)) {
    try { await afficher(profil); } catch (err) { afficherErreur(err); }
    // Première visite : on explique le site avant tout le reste.
    tutoSiPremiereVisite(profil);

    // En arrière-plan, et sans bloquer l'affichage : si config.js a
    // changé, on recopie la banque de questions dans la base, pour que
    // l'ouverture automatique du 1er du mois utilise bien tes questions.
    synchroniserBanque().catch(() => { /* sans conséquence */ });
  }
}

async function afficher(profil) {
  const [groupes, ouvertes] = await Promise.all([mesGroupes(), editionsOuvertes()]);
  const prenom = profil?.prenom || '';

  // Le questionnaire se remplit une seule fois, ici, pour tous les
  // groupes à la fois. On met en avant le mois le plus récent.
  const moisOuverts = [...new Set(ouvertes.map(e => e.mois))].sort().reverse();
  const moisEnCours = moisOuverts[0] ?? null;
  const envois = moisEnCours ? await mesEnvois(moisEnCours) : {};

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
          <li><strong>Ouvrir l'édition du mois.</strong> Sans ça, personne ne peut répondre.</li>
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
      ${carteQuestionnaire(moisEnCours, ouvertes, envois)}
      ${barre}
      ${contenu}
      <div class="separateur">· · ·</div>
      <div class="carte">
        <h3>Créer un nouveau groupe</h3>
        <p class="discret" style="margin:6px 0 16px">
          Un groupe par bande de copines. Elles ne voient que le leur.
          Tu en seras l'administratrice.
        </p>
        <form id="form-groupe">
          <label class="champ">
            <span class="intitule">Son nom</span>
            <input type="text" name="nom" required placeholder="Les copines du lycée">
          </label>
          <div class="champ">
            <span class="intitule">Son emoji</span>
            <span class="aide">C'est ce qu'on verra partout à côté du nom.</span>
            <div class="palette-emojis" id="palette-groupe">
              ${PALETTE_EMOJIS_GROUPE.map((e, i) => `
                <button type="button" class="bouton-emoji ${i === 0 ? 'actif' : ''}"
                        data-emoji="${txt(e)}">${e}</button>`).join('')}
            </div>
            <input type="text" name="emoji" value="🎀" maxlength="4" id="emoji-choisi"
                   style="width:84px;text-align:center;margin-top:10px"
                   aria-label="Emoji choisi, modifiable">
            <span class="aide">Tu peux aussi en coller un autre ici.</span>
          </div>
          <button class="btn" type="submit">Créer le groupe</button>
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

  // La palette coche l'emoji, et le champ reste modifiable à la main.
  const champEmoji = $('#emoji-choisi');
  $('#palette-groupe')?.querySelectorAll('.bouton-emoji').forEach(b =>
    b.addEventListener('click', () => {
      $('#palette-groupe').querySelectorAll('.bouton-emoji')
        .forEach(o => o.classList.remove('actif'));
      b.classList.add('actif');
      champEmoji.value = b.dataset.emoji;
    }));
  champEmoji?.addEventListener('input', () => {
    $('#palette-groupe').querySelectorAll('.bouton-emoji').forEach(o =>
      o.classList.toggle('actif', o.dataset.emoji === champEmoji.value));
  });

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

/**
 * La carte du haut : un seul questionnaire pour tous les groupes.
 * C'est le point d'entrée du mois.
 */
function carteQuestionnaire(moisEnCours, ouvertes, envois) {
  // Rien d'ouvert : on invite à ouvrir le mois en cours. Depuis cette
  // version, n'importe quelle membre peut le faire.
  if (!moisEnCours) {
    return `
      <div class="carte carte-questionnaire">
        <div class="rangee espace" style="gap:18px">
          <div style="min-width:0">
            <span class="surtitre">Le questionnaire du mois</span>
            <h2 style="margin:2px 0 6px;font-size:1.6rem">${txt(moisEnLettres(moisCourant()))}</h2>
            <p class="discret" style="margin:0">
              Pas encore ouvert. Tu peux l'ouvrir pour tes groupes, même ceux
              que tu ne gères pas.
            </p>
          </div>
          <a class="btn" href="repondre.html?mois=${encodeURIComponent(moisCourant())}">Ouvrir</a>
        </div>
      </div>`;
  }

  const duMois = ouvertes.filter(e => e.mois === moisEnCours);
  const faits = duMois.filter(e => envois[e.id]?.envoyee).length;
  const total = duMois.length;
  const toutFait = faits === total;

  const etat = toutFait
    ? `Ta page est partie dans ${total === 1 ? 'ton groupe' : 'tes ' + total + ' groupes'}.`
    : faits
      ? `Déjà envoyée dans ${faits} groupe${faits > 1 ? 's' : ''} sur ${total}.`
      : 'Tu remplis une seule fois, puis tu choisis à qui l\'envoyer.';

  return `
    <div class="carte carte-questionnaire">
      <div class="rangee espace" style="gap:18px">
        <div style="min-width:0">
          <span class="surtitre">Le questionnaire du mois</span>
          <h2 style="margin:2px 0 6px;font-size:1.6rem">${txt(moisEnLettres(moisEnCours))}</h2>
          <p class="discret" style="margin:0">${txt(etat)}</p>
        </div>
        <a class="btn" href="repondre.html?mois=${encodeURIComponent(moisEnCours)}">
          ${toutFait ? 'Modifier ma page' : (faits ? 'Continuer' : 'Remplir')}
        </a>
      </div>
      ${total > 1 ? `
      <div class="jauge" style="margin-top:18px">
        <div class="jauge-remplie" style="width:${Math.round((faits / total) * 100)}%"></div>
      </div>` : ''}
    </div>
    ${moisOuvertsRestants(ouvertes, moisEnCours)}`;
}

/** Les autres mois encore ouverts, s'il y en a (rattrapage). */
function moisOuvertsRestants(ouvertes, moisEnCours) {
  const autres = [...new Set(ouvertes.map(e => e.mois))].filter(m => m !== moisEnCours).sort().reverse();
  if (!autres.length) return '';
  return `<p class="discret" style="margin:-8px 0 22px">
    Encore ouvert : ${autres.map(m =>
      `<a href="repondre.html?mois=${encodeURIComponent(m)}">${txt(moisEnLettres(m))}</a>`).join(', ')}.
  </p>`;
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
