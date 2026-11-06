// ==========================================================
//  Petits utilitaires d'affichage
// ==========================================================

export const $ = (sel, racine = document) => racine.querySelector(sel);

/** Échappe le texte saisi par les utilisatrices avant insertion. */
export function txt(valeur) {
  return String(valeur ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function moisEnLettres(dateIso) {
  const d = new Date(dateIso + (dateIso.length === 10 ? 'T12:00:00' : ''));
  return `${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Le 1er du mois courant, au format AAAA-MM-01. */
export function moisCourant() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function initiale(personne) {
  const base = personne?.prenom || personne?.email || '?';
  return base.trim().charAt(0).toUpperCase();
}

export function chargement(message = 'Un instant…') {
  return `<div class="chargement"><div class="tourne"></div>${txt(message)}</div>`;
}

export function messageVide(emoji, titre, detail = '') {
  return `<div class="vide">
    <span class="emoji">${emoji}</span>
    <h3>${txt(titre)}</h3>
    ${detail ? `<p class="discret">${txt(detail)}</p>` : ''}
  </div>`;
}

/** Transforme un lien Spotify ou YouTube en lecteur intégré. */
export function lecteurMusique(lien) {
  if (!lien) return '';
  try {
    const u = new URL(lien);
    if (u.hostname.includes('spotify')) {
      const chemin = u.pathname.replace(/^\/(intl-[a-z]+\/)?/, '/');
      return `<iframe style="border-radius:12px;margin-top:10px" src="https://open.spotify.com/embed${chemin}"
        width="100%" height="152" frameborder="0" loading="lazy"
        allow="encrypted-media; clipboard-write"></iframe>`;
    }
    if (u.hostname.includes('youtu')) {
      const id = u.hostname.includes('youtu.be')
        ? u.pathname.slice(1)
        : u.searchParams.get('v');
      if (id && /^[\w-]{6,20}$/.test(id)) {
        return `<iframe style="border-radius:12px;margin-top:10px" width="100%" height="200"
          src="https://www.youtube.com/embed/${txt(id)}" frameborder="0" loading="lazy"
          allowfullscreen></iframe>`;
      }
    }
    return `<p><a href="${txt(lien)}" target="_blank" rel="noopener">Écouter ↗</a></p>`;
  } catch {
    return '';
  }
}

export function alerte(conteneur, type, texte) {
  conteneur.insertAdjacentHTML('afterbegin',
    `<div class="message ${type}">${txt(texte)}</div>`);
  setTimeout(() => conteneur.querySelector('.message')?.remove(), 6000);
}
