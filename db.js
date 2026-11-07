// ==========================================================
//  Accès aux données (Supabase)
// ==========================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_ANON_KEY, RUBRIQUES, QUESTIONS_TOURNANTES,
         QUESTIONS_CHOIX, QUESTIONS_SAISON, QUESTION_FETE_NEUTRE,
         NB_QUESTIONS_TOURNANTES, NB_QUESTIONS_CHOIX } from './config.js';

// Toutes les tables de cette appli vivent dans le schéma `newsletter`,
// ce qui permet d'héberger d'autres applis dans le même projet Supabase.
// À faire une fois côté Supabase : Settings > Data API > Exposed schemas,
// ajouter `newsletter` à la liste.
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: 'newsletter' },
});

const BUCKET = 'medias-newsletter';

export function configOk() {
  return !SUPABASE_URL.includes('TON-PROJET') && !SUPABASE_ANON_KEY.includes('TA-CLE');
}

/* ---------- Session ---------- */

export async function sessionActuelle() {
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

export async function envoyerLienMagique(email) {
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}

export async function seDeconnecter() {
  await sb.auth.signOut();
}

/* ---------- Profil ---------- */

export async function monProfil() {
  const session = await sessionActuelle();
  if (!session) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  // Si le profil n'existe pas encore (compte créé avant le trigger), on le crée.
  if (!data) {
    const { data: cree } = await sb.from('profiles')
      .insert({ id: session.user.id, email: session.user.email })
      .select().maybeSingle();
    return cree ?? { id: session.user.id, email: session.user.email, prenom: null };
  }
  return data;
}

/**
 * Enregistre la fiche profil. On ne passe que les champs à changer.
 * Le prénom est recopié sur les lignes `membres` pour que les copines
 * le voient dans tous les groupes.
 */
export async function majProfil(champs) {
  const session = await sessionActuelle();
  if (!session) return;

  const propre = {};
  for (const cle of ['prenom', 'avatar_url', 'date_naissance', 'bio', 'ville', 'fetes']) {
    if (cle in champs) {
      const v = champs[cle];
      if (cle === 'fetes') propre.fetes = Array.isArray(v) ? v : [];
      else propre[cle] = typeof v === 'string' ? (v.trim() || null) : (v ?? null);
    }
  }
  if (!Object.keys(propre).length) return;

  const { error } = await sb.from('profiles').update(propre).eq('id', session.user.id);
  if (error) throw error;

  if ('prenom' in propre) {
    await sb.from('membres').update({ prenom: propre.prenom }).eq('profile_id', session.user.id);
  }
}

/** Compatibilité avec l'ancien code. */
export const majPrenom = prenom => majProfil({ prenom });

/** La fiche est-elle remplie ? Sert à poser la question à la 1re connexion. */
export function profilIncomplet(profil) {
  return !profil?.prenom?.trim();
}

/** Envoie une photo de profil et renvoie son adresse publique. */
export async function envoyerAvatar(fichier) {
  const session = await sessionActuelle();
  const ext = (fichier.name.split('.').pop() || 'jpg').toLowerCase();
  const chemin = `${session.user.id}/avatar-${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(chemin, fichier, { cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
}

/* ---------- Groupes ---------- */

/**
 * Mes groupes, avec mon rôle dans chacun.
 *
 * ⚠️ Le filtre sur `profile_id` est indispensable : les règles de
 * sécurité m'autorisent à lire TOUTES les lignes `membres` de mes
 * groupes, donc sans ce filtre la requête renvoyait une ligne par
 * copine et le même groupe apparaissait plusieurs fois.
 */
export async function mesGroupes() {
  const session = await sessionActuelle();
  if (!session) return [];
  const { data, error } = await sb
    .from('membres')
    .select('role, groupe:groupes!inner(id, nom, emoji, cree_par, cree_le)')
    .eq('profile_id', session.user.id);
  if (error) throw error;

  // Ceinture et bretelles : on dédoublonne par id de groupe.
  const parId = new Map();
  for (const ligne of data ?? []) {
    if (!ligne.groupe) continue;
    const existant = parId.get(ligne.groupe.id);
    // En cas de doublon, le rôle admin gagne.
    if (!existant || ligne.role === 'admin') {
      parId.set(ligne.groupe.id, {
        ...ligne.groupe,
        role: ligne.role,
        jeSuisLaCreatrice: ligne.groupe.cree_par === session.user.id,
      });
    }
  }
  return [...parId.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

export async function creerGroupe(nom, emoji) {
  const session = await sessionActuelle();
  const { data: groupe, error } = await sb
    .from('groupes')
    .insert({ nom: nom.trim(), emoji: emoji || '🎀', cree_par: session.user.id })
    .select()
    .single();
  if (error) throw error;

  // La créatrice devient administratrice de son groupe.
  // L'adresse est mise en minuscules, comme pour les invitations :
  // sans ça la contrainte d'unicité laissait passer un doublon.
  const { error: e2 } = await sb.from('membres').insert({
    groupe_id: groupe.id,
    email: session.user.email.trim().toLowerCase(),
    profile_id: session.user.id,
    role: 'admin',
  });
  if (e2) throw e2;
  return groupe;
}

export async function membresDuGroupe(groupeId) {
  const { data, error } = await sb
    .from('membres')
    .select('id, email, prenom, role, profile_id, profil:profiles(prenom, avatar_url, ville, date_naissance, fetes)')
    .eq('groupe_id', groupeId)
    .order('prenom', { nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map(m => ({
    ...m,
    prenom: m.profil?.prenom || m.prenom,
    avatar_url: m.profil?.avatar_url ?? null,
    date_naissance: m.profil?.date_naissance ?? null,
    fetes: m.profil?.fetes ?? [],
  }));
}

export async function inviter(groupeId, email, prenom) {
  const session = await sessionActuelle();
  const propre = email.trim().toLowerCase();

  // On ne s'invite pas soi-même : on est déjà dans le groupe.
  if (propre === session.user.email.trim().toLowerCase()) {
    throw new Error('Tu es déjà dans ce groupe, pas besoin de t\'inviter toi-même.');
  }

  const { error } = await sb.from('membres').insert({
    groupe_id: groupeId,
    email: propre,
    prenom: prenom?.trim() || null,
  });
  if (error) throw error;
}

export async function retirerMembre(membreId) {
  const { error } = await sb.from('membres').delete().eq('id', membreId);
  if (error) throw error;
}

/** Nomme une copine co-administratrice, ou lui retire le rôle. */
export async function changerRole(membreId, role) {
  const { error } = await sb.from('membres').update({ role }).eq('id', membreId);
  if (error) throw error;
}

/* ---------- Éditions ---------- */

export async function editionsDuGroupe(groupeId) {
  const { data, error } = await sb
    .from('editions')
    .select('*')
    .eq('groupe_id', groupeId)
    .order('mois', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function edition(id) {
  const { data, error } = await sb
    .from('editions')
    .select('*, groupe:groupes(id, nom, emoji)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

function piocher(liste, combien) {
  return [...liste].sort(() => Math.random() - 0.5).slice(0, combien);
}

/**
 * Les questions d'un numéro : le squelette fixe, la question de
 * saison du mois, la question des fêtes, puis des questions à
 * cocher et des questions surprises tirées au hasard.
 */
export function questionsDuMois(mois) {
  const numeroDuMois = Number(String(mois).slice(5, 7));

  const tournantes = piocher(QUESTIONS_TOURNANTES, NB_QUESTIONS_TOURNANTES)
    .map((texte, i) => ({
      id: 'tournante' + (i + 1),
      type: 'long',
      intitule: texte,
      tournante: true,
    }));

  const cocher = piocher(QUESTIONS_CHOIX, NB_QUESTIONS_CHOIX)
    .map(q => ({ ...q, tournante: true }));

  const saison = QUESTIONS_SAISON[numeroDuMois]
    ? [{ ...QUESTIONS_SAISON[numeroDuMois], saison: true }]
    : [];

  // La question des fêtes est personnalisée au moment de répondre,
  // selon ce que chacune a renseigné dans son profil.
  const fete = [{ ...QUESTION_FETE_NEUTRE, fete: true }];

  return [...RUBRIQUES, ...saison, ...fete, ...cocher, ...tournantes];
}

export async function ouvrirEdition(groupeId, mois) {
  const precedentes = await editionsDuGroupe(groupeId);
  const numero = precedentes.length + 1;
  const { data, error } = await sb
    .from('editions')
    .insert({
      groupe_id: groupeId,
      numero,
      mois,
      statut: 'ouverte',
      questions: questionsDuMois(mois),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function publierEdition(id) {
  const { error } = await sb
    .from('editions')
    .update({ statut: 'publiee', publiee_le: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/* ---------- Réponses ---------- */

export async function maReponse(editionId) {
  const session = await sessionActuelle();
  const { data } = await sb
    .from('reponses')
    .select('*')
    .eq('edition_id', editionId)
    .eq('profile_id', session.user.id)
    .maybeSingle();
  return data;
}

export async function enregistrerReponse(editionId, contenu, medias, envoyee) {
  const session = await sessionActuelle();
  const ligne = {
    edition_id: editionId,
    profile_id: session.user.id,
    contenu,
    medias,
    envoyee,
    maj_le: new Date().toISOString(),
  };
  const { error } = await sb
    .from('reponses')
    .upsert(ligne, { onConflict: 'edition_id,profile_id' });
  if (error) throw error;
}

export async function reponsesPubliees(editionId) {
  const { data, error } = await sb
    .from('reponses')
    .select('*, auteure:profiles(id, prenom, email, avatar_url, ville)')
    .eq('edition_id', editionId)
    .eq('envoyee', true);
  if (error) throw error;
  return data ?? [];
}

export async function compterReponses(editionId) {
  const { count } = await sb
    .from('reponses')
    .select('id', { count: 'exact', head: true })
    .eq('edition_id', editionId)
    .eq('envoyee', true);
  return count ?? 0;
}

/* ---------- Les questions posées par les copines ---------- */

/** Toutes les questions posées dans une édition. */
export async function questionsPosees(editionId) {
  const { data, error } = await sb
    .from('questions_posees')
    .select('*, auteur:profiles!questions_posees_auteur_id_fkey(id, prenom, avatar_url),'
          + ' destinataire:profiles!questions_posees_destinataire_id_fkey(id, prenom, avatar_url)')
    .eq('edition_id', editionId)
    .order('cree_le');
  if (error) throw error;
  return data ?? [];
}

/** Pose une question. destinataireId vide = question à tout le groupe. */
export async function poserQuestion(editionId, texte, destinataireId) {
  const session = await sessionActuelle();
  const propre = String(texte ?? '').trim();
  if (propre.length < 3) throw new Error('Ta question est un peu courte.');
  if (propre.length > 300) throw new Error('Ta question est trop longue (300 caractères maximum).');

  const { error } = await sb.from('questions_posees').insert({
    edition_id: editionId,
    auteur_id: session.user.id,
    destinataire_id: destinataireId || null,
    texte: propre,
  });
  if (error) throw error;
}

export async function retirerQuestion(id) {
  const { error } = await sb.from('questions_posees').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Les questions auxquelles la personne connectée doit répondre :
 * celles posées à tout le groupe par quelqu'un d'autre, et celles
 * qui lui sont adressées personnellement.
 */
export async function mesQuestionsARepondre(editionId) {
  const session = await sessionActuelle();
  const toutes = await questionsPosees(editionId);
  return toutes.filter(q =>
    q.destinataire_id
      ? q.destinataire_id === session.user.id
      : q.auteur_id !== session.user.id);
}

/* ---------- Les réactions ---------- */

export async function reactionsDesReponses(idsReponses) {
  if (!idsReponses?.length) return [];
  const { data, error } = await sb
    .from('reactions')
    .select('*, auteure:profiles(id, prenom, avatar_url)')
    .in('reponse_id', idsReponses);
  if (error) throw error;
  return data ?? [];
}

/** Enregistre ma réaction. Vide emoji et mot = je retire ma réaction. */
export async function enregistrerReaction(reponseId, emoji, mot) {
  const session = await sessionActuelle();
  const motPropre = String(mot ?? '').trim();

  if (!emoji && !motPropre) {
    const { error } = await sb.from('reactions').delete()
      .eq('reponse_id', reponseId).eq('profile_id', session.user.id);
    if (error) throw error;
    return;
  }

  const { error } = await sb.from('reactions').upsert({
    reponse_id: reponseId,
    profile_id: session.user.id,
    emoji: emoji || null,
    mot: motPropre || null,
  }, { onConflict: 'reponse_id,profile_id' });
  if (error) throw error;
}

/* ---------- « Il y a un an » ---------- */

/**
 * L'édition du même mois, l'année dernière, si elle existe et a
 * été publiée. Sert à remonter une réponse dans le numéro courant.
 */
export async function editionIlYaUnAn(groupeId, mois) {
  const annee = Number(String(mois).slice(0, 4)) - 1;
  const cible = `${annee}-${String(mois).slice(5, 7)}-01`;

  const { data } = await sb
    .from('editions')
    .select('id, numero, mois, questions')
    .eq('groupe_id', groupeId)
    .eq('mois', cible)
    .eq('statut', 'publiee')
    .maybeSingle();
  if (!data) return null;

  const reponses = await reponsesPubliees(data.id);
  if (!reponses.length) return null;
  return { edition: data, reponses };
}

/* ---------- Photos et vidéos ---------- */

export async function envoyerMedia(fichier) {
  const session = await sessionActuelle();
  const ext = (fichier.name.split('.').pop() || 'bin').toLowerCase();
  const chemin = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(chemin, fichier, { cacheControl: '31536000', upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(chemin);
  return {
    chemin,
    url: data.publicUrl,
    type: fichier.type.startsWith('video') ? 'video' : 'image',
  };
}

/* ---------- Garde-fou et en-tête, partagés par toutes les pages ---------- */

/**
 * À appeler en haut de chaque page privée.
 * Renvoie la session, ou renvoie vers la page de connexion.
 */
export async function exigerSession() {
  const session = await sessionActuelle();
  if (!session) {
    location.replace('index.html');
    return null;
  }
  return session;
}

function echappe(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Remplit l'en-tête : photo de profil cliquable + déconnexion.
 * Renvoie le profil, pour éviter de le recharger dans la page.
 */
export async function brancherEntete() {
  const zone = document.getElementById('entete-actions');
  const profil = await monProfil();
  if (!zone) return profil;

  const nom = profil?.prenom || profil?.email?.split('@')[0] || '';
  const vignette = profil?.avatar_url
    ? `<img src="${echappe(profil.avatar_url)}" alt="">`
    : `<span>${echappe((nom || '?').charAt(0).toUpperCase())}</span>`;

  zone.innerHTML = `
    <a class="lien-profil" href="profil.html" title="Mon profil">
      <span class="pastille petite">${vignette}</span>
      <span class="nom-entete">${echappe(nom)}</span>
    </a>
    <button class="btn fil petit" id="btn-sortir">Se déconnecter</button>`;

  document.getElementById('btn-sortir').addEventListener('click', async () => {
    await seDeconnecter();
    location.replace('index.html');
  });
  return profil;
}

/** Ancien nom, gardé pour que les pages non modifiées continuent de marcher. */
export const brancherDeconnexion = brancherEntete;

/**
 * Renvoie vers la fiche profil si le prénom n'est pas encore renseigné.
 * Renvoie true si la page appelante doit s'arrêter là.
 */
export function exigerPrenom(profil) {
  if (profilIncomplet(profil)) {
    location.replace('profil.html?bienvenue=1');
    return true;
  }
  return false;
}

/** Affiche une erreur à la place du contenu. */
export function afficherErreur(err) {
  const vue = document.getElementById('vue');
  if (!vue) return;
  const m = echappe(err?.message || err || 'Une erreur est survenue.');
  vue.innerHTML = `<div class="page etroit">
    <div class="message erreur">${m}</div>
    <a href="groupes.html" class="btn doux">Revenir à mes groupes</a>
  </div>`;
}
