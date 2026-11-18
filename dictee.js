// ==========================================================
//  La dictée : parler au lieu de taper
//  Utilise la reconnaissance vocale du navigateur. Rien n'est
//  enregistré, rien n'est stocké : seule la transcription arrive
//  dans le champ, et elle reste modifiable à la main.
// ==========================================================

const Moteur = window.SpeechRecognition || window.webkitSpeechRecognition;

/** La dictée est-elle disponible dans ce navigateur ? */
export function dicteeDisponible() {
  return !!Moteur;
}

let enCours = null;   // une seule dictée à la fois

/**
 * Ajoute un bouton micro à un champ de saisie.
 * `champ` est un <input type=text> ou un <textarea>.
 * `auChangement` est appelé après chaque ajout de texte, pour que
 * le formulaire enregistre son brouillon.
 */
export function brancherDictee(champ, auChangement = () => {}) {
  if (!Moteur || !champ) return;

  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bouton-micro';
  bouton.title = 'Dicter au lieu de taper';
  bouton.setAttribute('aria-label', 'Dicter cette réponse');
  bouton.innerHTML = '<span class="icone-micro" aria-hidden="true"></span>';

  const enveloppe = document.createElement('div');
  enveloppe.className = 'champ-dictee';
  champ.parentNode.insertBefore(enveloppe, champ);
  enveloppe.appendChild(champ);
  enveloppe.appendChild(bouton);

  let moteur = null;
  let dejaLa = '';     // le texte présent avant de commencer à parler

  function arreter() {
    try { moteur?.stop(); } catch { /* déjà arrêté */ }
    moteur = null;
    enCours = null;
    bouton.classList.remove('ecoute');
    enveloppe.classList.remove('en-dictee');
  }

  bouton.addEventListener('click', () => {
    // Un clic pendant l'écoute arrête la dictée.
    if (moteur) { arreter(); return; }

    // On n'écoute qu'un champ à la fois.
    if (enCours) enCours();

    moteur = new Moteur();
    moteur.lang = 'fr-FR';
    moteur.continuous = true;
    moteur.interimResults = true;

    dejaLa = champ.value.trim();
    enCours = arreter;
    bouton.classList.add('ecoute');
    enveloppe.classList.add('en-dictee');

    moteur.onresult = e => {
      let definitif = '';
      let enAttente = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const bout = e.results[i][0].transcript;
        if (e.results[i].isFinal) definitif += bout;
        else enAttente += bout;
      }
      if (definitif) {
        dejaLa = (dejaLa ? dejaLa + ' ' : '') + definitif.trim();
        auChangement();
      }
      champ.value = (dejaLa + (enAttente ? ' ' + enAttente : '')).trim();
    };

    moteur.onerror = e => {
      arreter();
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        signaler(enveloppe, 'Ton navigateur a refusé le micro. Autorise-le dans la barre d\'adresse.');
      } else if (e.error === 'no-speech') {
        signaler(enveloppe, 'Je n\'ai rien entendu. Réessaie en parlant un peu plus fort.');
      } else if (e.error !== 'aborted') {
        signaler(enveloppe, 'La dictée s\'est interrompue. Tu peux réessayer.');
      }
    };

    moteur.onend = () => { if (moteur) arreter(); };

    try {
      moteur.start();
    } catch {
      arreter();
      signaler(enveloppe, 'La dictée n\'a pas pu démarrer.');
    }
  });
}

function signaler(enveloppe, texte) {
  const existant = enveloppe.parentNode.querySelector('.note-dictee');
  if (existant) existant.remove();
  const note = document.createElement('p');
  note.className = 'discret note-dictee';
  note.textContent = texte;
  enveloppe.parentNode.appendChild(note);
  setTimeout(() => note.remove(), 7000);
}

/**
 * Le bandeau qui explique la dictée, en haut du formulaire.
 * Renvoie une chaîne vide si le navigateur ne sait pas la faire.
 */
export function bandeauDictee() {
  if (!Moteur) {
    return `<div class="message info">
      Pour dicter tes réponses au lieu de les taper, ouvre le site dans
      Chrome ou Edge. Ton navigateur actuel ne sait pas encore le faire.
    </div>`;
  }
  return `<div class="message info">
    Pas envie de taper ? Clique sur le micro à côté d'une question et
    parle. Le texte s'écrit tout seul, et tu peux le corriger ensuite.
  </div>`;
}
