// ==========================================================
//  Page : profil.html — ma fiche
//  ?bienvenue=1 → version courte de première connexion
// ==========================================================
import { exigerSession, brancherEntete, afficherErreur,
         monProfil, majProfil, envoyerAvatar } from './db.js';
import { FETES } from './config.js';
import { $, txt, alerte } from './ui.js';

const vue = $('#vue');
const bienvenue = new URLSearchParams(location.search).get('bienvenue') === '1';

let profil = null;
let avatarUrl = null;

if (await exigerSession()) {
  await brancherEntete();
  try { await afficher(); } catch (err) { afficherErreur(err); }
}

async function afficher() {
  profil = await monProfil();
  avatarUrl = profil?.avatar_url ?? null;

  const prenom = profil?.prenom ?? '';
  const email = profil?.email ?? '';

  // ---- Première connexion : on demande juste le prénom ----
  if (bienvenue) {
    vue.innerHTML = `
      <div class="page etroit">
        <div class="couverture">
          <img class="logo" src="logo.png" alt="">
          <span class="numero">Bienvenue</span>
          <h1>Comment on t'appelle ?</h1>
          <p class="mois">C'est le nom que tes copines verront.</p>
        </div>
        <div class="carte">
          <form id="form-bienvenue">
            <label class="champ">
              <span class="intitule">Ton prénom</span>
              <span class="aide">Juste « Aurélia », pas ton adresse e-mail.</span>
              <input type="text" name="prenom" required maxlength="40"
                     value="${txt(prenom)}" placeholder="Aurélia"
                     autocomplete="given-name" autofocus>
            </label>
            <button class="btn large" type="submit">C'est parti</button>
          </form>
          <p class="discret" style="margin-top:14px;text-align:center">
            Tu pourras ajouter ta photo et le reste juste après.
          </p>
        </div>
        <div id="retour"></div>
      </div>`;

    $('#form-bienvenue').addEventListener('submit', async e => {
      e.preventDefault();
      const b = e.target.querySelector('button');
      b.disabled = true;
      try {
        await majProfil({ prenom: e.target.prenom.value });
        location.replace('profil.html');
      } catch (err) {
        alerte($('#retour'), 'erreur', err.message);
        b.disabled = false;
      }
    });
    return;
  }

  // ---- Fiche complète ----
  vue.innerHTML = `
    <div class="page etroit">
      <a href="groupes.html" class="discret">← Mes groupes</a>
      <h1 style="margin:10px 0 6px">Mon profil</h1>
      <p class="discret" style="margin-bottom:26px">
        Ce que tes copines voient de toi dans vos groupes et dans les éditions.
      </p>

      <div class="carte">
        <div class="bloc-avatar">
          <span class="pastille grande" id="apercu-avatar">${vignetteAvatar(avatarUrl, prenom || email)}</span>
          <div>
            <label class="btn doux petit" style="cursor:pointer">
              Changer ma photo
              <input type="file" id="champ-avatar" accept="image/*" hidden>
            </label>
            ${avatarUrl ? '<button class="btn fil petit" id="btn-retirer-photo" style="margin-left:8px">Retirer</button>' : ''}
            <p class="discret" style="margin-top:8px">JPEG ou PNG, 5 Mo maximum.</p>
          </div>
        </div>

        <div class="separateur">· · ·</div>

        <form id="form-profil">
          <label class="champ">
            <span class="intitule">Mon prénom</span>
            <span class="aide">Le nom affiché partout sur le site.</span>
            <input type="text" name="prenom" required maxlength="40"
                   value="${txt(prenom)}" placeholder="Aurélia" autocomplete="given-name">
          </label>

          <label class="champ">
            <span class="intitule">Mon anniversaire</span>
            <span class="aide">Pour que les copines ne l'oublient plus jamais.</span>
            <input type="date" name="date_naissance"
                   value="${txt(profil?.date_naissance ?? '')}">
          </label>

          <label class="champ">
            <span class="intitule">Où j'habite</span>
            <input type="text" name="ville" maxlength="80"
                   value="${txt(profil?.ville ?? '')}" placeholder="Le Cap, Afrique du Sud">
          </label>

          <fieldset class="champ sans-bordure">
            <legend class="intitule">Ce que je célèbre</legend>
            <span class="aide">
              Sert aux questions de saison : en décembre, l'une raconte son Noël,
              l'autre son Aïd, une troisième sa fin d'année. Facultatif — sans
              réponse, la question reste neutre.
            </span>
            <div class="pastilles">
              ${FETES.map(f => `
                <label class="pastille-choix">
                  <input type="checkbox" name="fetes" value="${txt(f.id)}"
                         ${(profil?.fetes ?? []).includes(f.id) ? 'checked' : ''}>
                  <span>${txt(f.nom)}</span>
                </label>`).join('')}
            </div>
          </fieldset>

          <label class="champ">
            <span class="intitule">En deux mots</span>
            <span class="aide">Ce que tu fais en ce moment, ton humeur, ce que tu veux.</span>
            <textarea name="bio" maxlength="300"
                      placeholder="Étudiante en échange, accro au bloc et aux chats des autres.">${txt(profil?.bio ?? '')}</textarea>
          </label>

          <button class="btn large" type="submit">Enregistrer</button>
        </form>

        <p class="discret" style="margin-top:18px;text-align:center">
          Connectée avec ${txt(email)}
        </p>
      </div>
      <div id="retour"></div>
    </div>`;

  brancherPhoto();

  $('#form-profil').addEventListener('submit', async e => {
    e.preventDefault();
    const b = e.target.querySelector('button[type=submit]');
    b.disabled = true;
    b.textContent = 'Enregistrement…';
    try {
      await majProfil({
        prenom: e.target.prenom.value,
        date_naissance: e.target.date_naissance.value || null,
        ville: e.target.ville.value,
        bio: e.target.bio.value,
        fetes: [...e.target.querySelectorAll('input[name=fetes]:checked')].map(c => c.value),
        avatar_url: avatarUrl,
      });
      await brancherEntete();
      alerte($('#retour'), 'ok', 'C\'est enregistré.');
    } catch (err) {
      alerte($('#retour'), 'erreur', err.message);
    } finally {
      b.disabled = false;
      b.textContent = 'Enregistrer';
    }
  });
}

function vignetteAvatar(url, nom) {
  return url
    ? `<img src="${txt(url)}" alt="">`
    : `<span>${txt((nom || '?').charAt(0).toUpperCase())}</span>`;
}

function brancherPhoto() {
  $('#champ-avatar')?.addEventListener('change', async e => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    if (fichier.size > 5 * 1024 * 1024) {
      alerte($('#retour'), 'erreur', 'Cette photo dépasse 5 Mo. Essaie-en une plus légère.');
      e.target.value = '';
      return;
    }
    $('#apercu-avatar').innerHTML = '<span>…</span>';
    try {
      avatarUrl = await envoyerAvatar(fichier);
      await majProfil({ avatar_url: avatarUrl });
      await brancherEntete();
      await afficher();
      alerte($('#retour'), 'ok', 'Jolie photo.');
    } catch (err) {
      alerte($('#retour'), 'erreur', err.message || 'Envoi impossible.');
      await afficher();
    }
  });

  $('#btn-retirer-photo')?.addEventListener('click', async () => {
    avatarUrl = null;
    try {
      await majProfil({ avatar_url: null });
      await brancherEntete();
      await afficher();
    } catch (err) {
      alerte($('#retour'), 'erreur', err.message);
    }
  });
}
