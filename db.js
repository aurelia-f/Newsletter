// ==========================================================
//  Accès aux données (Supabase)
// ==========================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_ANON_KEY, RUBRIQUES, QUESTIONS_TOURNANTES } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

export async function monProfil() {
  const session = await sessionActuelle();
  if (!session) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  return data;
}

export async function majPrenom(prenom) {
  const session = await sessionActuelle();
  if (!session) return;
  await sb.from('profiles').update({ prenom }).eq('id', session.user.id);
  await sb.from('membres').update({ prenom }).eq('profile_id', session.user.id);
}

/* ---------- Groupes ---------- */

export async function mesGroupes() {
  const { data, error } = await sb
    .from('membres')
    .select('role, groupe:groupes!inner(id, nom, emoji, cree_le)');
  if (error) throw error;
  return (data ?? [])
    .filter(l => l.groupe)
    .map(l => ({ ...l.groupe, role: l.role }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
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
  const { error: e2 } = await sb.from('membres').insert({
    groupe_id: groupe.id,
    email: session.user.email,
    profile_id: session.user.id,
    role: 'admin',
  });
  if (e2) throw e2;
  return groupe;
}

export async function membresDuGroupe(groupeId) {
  const { data, error } = await sb
    .from('membres')
    .select('id, email, prenom, role, profile_id')
    .eq('groupe_id', groupeId)
    .order('prenom', { nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function inviter(groupeId, email, prenom) {
  const { error } = await sb.from('membres').insert({
    groupe_id: groupeId,
    email: email.trim().toLowerCase(),
    prenom: prenom?.trim() || null,
  });
  if (error) throw error;
}

export async function retirerMembre(membreId) {
  const { error } = await sb.from('membres').delete().eq('id', membreId);
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

function deuxQuestionsAuHasard() {
  const melange = [...QUESTIONS_TOURNANTES].sort(() => Math.random() - 0.5);
  return melange.slice(0, 2).map((texte, i) => ({
    id: 'tournante' + (i + 1),
    type: 'long',
    intitule: texte,
    tournante: true,
  }));
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
      questions: [...RUBRIQUES, ...deuxQuestionsAuHasard()],
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
    .select('*, auteure:profiles(id, prenom, email)')
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

/* ---------- Photos et vidéos ---------- */

export async function envoyerMedia(fichier) {
  const session = await sessionActuelle();
  const ext = (fichier.name.split('.').pop() || 'bin').toLowerCase();
  const chemin = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage
    .from('medias')
    .upload(chemin, fichier, { cacheControl: '31536000', upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from('medias').getPublicUrl(chemin);
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

/** Branche le bouton « Se déconnecter » de l'en-tête. */
export function brancherDeconnexion() {
  const zone = document.getElementById('entete-actions');
  if (!zone) return;
  zone.innerHTML = '<button class="btn fil petit" id="btn-sortir">Se déconnecter</button>';
  document.getElementById('btn-sortir').addEventListener('click', async () => {
    await seDeconnecter();
    location.replace('index.html');
  });
}

/** Affiche une erreur à la place du contenu. */
export function afficherErreur(err) {
  const vue = document.getElementById('vue');
  if (!vue) return;
  const m = String(err?.message || err || 'Une erreur est survenue.')
    .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  vue.innerHTML = `<div class="page etroit">
    <div class="message erreur">${m}</div>
    <a href="groupes.html" class="btn doux">Revenir à mes groupes</a>
  </div>`;
}
