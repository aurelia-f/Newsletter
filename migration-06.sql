-- ============================================================
--  Entre Nous : migration 06
--  La banque de questions, copiée dans la base
--  À coller dans Supabase > SQL Editor, après migration-05.sql.
--  Relançable sans risque.
-- ============================================================
--  Pourquoi cette copie. L'ouverture automatique du 1er du mois se
--  fait dans la base, qui ne sait pas lire config.js. Elle a donc
--  besoin de sa propre copie des questions.
--
--  config.js reste LE fichier que tu modifies. Le site recopie la
--  banque dans la base tout seul quand tu l'ouvres, dès qu'il voit
--  que config.js a changé. Tu n'as rien à faire ici.
-- ============================================================

set search_path = newsletter, public;

-- ------------------------------------------------------------
--  0. RÉPARATION
--     Trois fonctions de schema.sql forcent `search_path = public`,
--     alors que tes tables vivent dans le schéma `newsletter`. Dans
--     cette situation elles ne trouvent plus la table `membres`, et
--     toutes les règles de sécurité qui s'appuient sur elles cassent.
--     On les recrée en cherchant d'abord dans `newsletter`, puis dans
--     `public` : correct dans les deux dispositions.
-- ------------------------------------------------------------
create or replace function mes_groupes()
returns setof uuid
language sql security definer stable
set search_path = newsletter, public
as $$ select groupe_id from membres where profile_id = auth.uid(); $$;

create or replace function mes_groupes_admin()
returns setof uuid
language sql security definer stable
set search_path = newsletter, public
as $$ select groupe_id from membres
      where profile_id = auth.uid() and role = 'admin'; $$;

create or replace function gerer_nouvel_utilisateur()
returns trigger
language plpgsql security definer
set search_path = newsletter, public
as $$
begin
  insert into profiles (id, email, prenom)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data->>'prenom'), ''))
  on conflict (id) do nothing;

  update membres
     set profile_id = new.id
   where profile_id is null
     and lower(email) = lower(new.email);

  return new;
end;
$$;

-- ------------------------------------------------------------
--  1. LA BANQUE
-- ------------------------------------------------------------
create table if not exists banque (
  id        bigserial primary key,
  categorie text not null check (categorie in ('rubrique','tournante','choix','saison','fete')),
  ordre     int  not null default 0,
  mois      int,                      -- seulement pour les questions de saison
  question  jsonb not null
);

create index if not exists banque_categorie_idx on banque(categorie);

-- ------------------------------------------------------------
--  2. LES RÉGLAGES
--     Quelques valeurs que la base doit connaître : combien de
--     questions tirer, et plus tard la clé du service de mail.
-- ------------------------------------------------------------
create table if not exists reglages (
  cle    text primary key,
  valeur jsonb not null,
  maj_le timestamptz not null default now()
);

-- Tout le monde peut lire la banque (le site en a besoin).
-- Seules les administratrices peuvent la remplacer.
alter table banque   enable row level security;
alter table reglages enable row level security;

drop policy if exists "lire la banque" on banque;
create policy "lire la banque" on banque for select using (auth.uid() is not null);

drop policy if exists "admin remplace la banque" on banque;
create policy "admin remplace la banque" on banque
  for all using (exists (select 1 from membres where profile_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from membres where profile_id = auth.uid() and role = 'admin'));

-- Les réglages sensibles (clé de mail) ne sortent jamais de la base :
-- personne ne peut les lire depuis le site.
drop policy if exists "lire les reglages publics" on reglages;
create policy "lire les reglages publics" on reglages
  for select using (auth.uid() is not null and cle not like 'secret_%');

drop policy if exists "admin ecrit les reglages publics" on reglages;
create policy "admin ecrit les reglages publics" on reglages
  for all using (
    cle not like 'secret_%'
    and exists (select 1 from membres where profile_id = auth.uid() and role = 'admin')
  )
  with check (
    cle not like 'secret_%'
    and exists (select 1 from membres where profile_id = auth.uid() and role = 'admin')
  );

insert into reglages (cle, valeur) values
  ('nb_tournantes', '2'::jsonb),
  ('nb_choix',      '2'::jsonb)
on conflict (cle) do nothing;

-- ------------------------------------------------------------
--  3. LE CONTENU DE LA BANQUE
--     Recopié automatiquement depuis config.js. Si tu modifies
--     config.js, le site met cette table à jour tout seul.
-- ------------------------------------------------------------
delete from banque;
insert into banque (categorie, ordre, mois, question) values
  ('rubrique', 0, null, '{"id":"humeur","type":"qcm","express":true,"intitule":"Alors, comment ça va vraiment ?","choix":["Au top","Ça va bien","Tranquille","Je survis","Mois difficile","Ne me demande pas"]}'::jsonb),
  ('rubrique', 1, null, '{"id":"resume","type":"long","express":true,"intitule":"Mon mois en trois lignes","aide":"Ce que tu raconterais à quelqu''un autour d''un café."}'::jsonb),
  ('rubrique', 2, null, '{"id":"energie","type":"curseur","intitule":"Mon niveau d''énergie","aide":"0 = une loque, 10 = inarrêtable. On comparera dans un an.","min":0,"max":10,"basG":"À plat","basD":"Inarrêtable"}'::jsonb),
  ('rubrique', 3, null, '{"id":"mode","type":"multi","intitule":"Ce mois-ci, j''étais plutôt en mode","aide":"Coche tout ce qui s''applique, sans honte.","choix":["Débordé·e","Amoureux·se","Productif·ve","En vrac","Sportif·ve","Casanier·ère","Fêtard·e","Insupportable","Zen","En pleine réflexion"]}'::jsonb),
  ('rubrique', 4, null, '{"id":"potin","type":"long","express":true,"intitule":"Le potin du mois","aide":"Une nouvelle, un ragot, une annonce. Tout est permis."}'::jsonb),
  ('rubrique', 5, null, '{"id":"victoire","type":"court","intitule":"Ma petite victoire","aide":"Même minuscule. Surtout si elle est minuscule."}'::jsonb),
  ('rubrique', 6, null, '{"id":"rire","type":"court","intitule":"Ce qui m''a fait rire"}'::jsonb),
  ('rubrique', 7, null, '{"id":"pleurer","type":"court","intitule":"Ce qui m''a fait pleurer","aide":"Un film, une news, une fatigue. Ou rien du tout."}'::jsonb),
  ('rubrique', 8, null, '{"id":"emojis","type":"emojis","express":true,"intitule":"Mon mois en trois emojis","aide":"Trois, pas plus. C''est ce qu''on relira le plus vite dans dix ans."}'::jsonb),
  ('rubrique', 9, null, '{"id":"musique","type":"musique","intitule":"Ma chanson du moment","aide":"Elle rejoindra la playlist commune du mois."}'::jsonb),
  ('rubrique', 10, null, '{"id":"ecran","type":"court","intitule":"Ce que je regarde ou je lis"}'::jsonb),
  ('rubrique', 11, null, '{"id":"achat","type":"court","intitule":"Mon achat du mois","aide":"Assumé ou profondément regretté."}'::jsonb),
  ('rubrique', 12, null, '{"id":"note_mois","type":"note","intitule":"Mon mois, sur cinq étoiles"}'::jsonb),
  ('rubrique', 13, null, '{"id":"photos","type":"photos","express":true,"intitule":"Mon mois en photos","aide":"Les bébés, les chats, les voyages, le brunch raté."}'::jsonb),
  ('rubrique', 14, null, '{"id":"suite","type":"court","intitule":"Le mois prochain, j''ai hâte de…"}'::jsonb),
  ('tournante', 0, null, '{"texte":"Ton pire rendez-vous galant, raconte."}'::jsonb),
  ('tournante', 1, null, '{"texte":"Si tu déménageais demain, ce serait où ?"}'::jsonb),
  ('tournante', 2, null, '{"texte":"Qu''est-ce que tu dirais à la personne que tu étais il y a dix ans ?"}'::jsonb),
  ('tournante', 3, null, '{"texte":"La dépense la plus honteuse de ce mois-ci ?"}'::jsonb),
  ('tournante', 4, null, '{"texte":"Quelle habitude tu essaies d''arrêter sans y arriver ?"}'::jsonb),
  ('tournante', 5, null, '{"texte":"Le compliment qui t''a le plus touché·e récemment ?"}'::jsonb),
  ('tournante', 6, null, '{"texte":"Qu''est-ce que tu as appris ce mois-ci, même de complètement inutile ?"}'::jsonb),
  ('tournante', 7, null, '{"texte":"Ton dimanche parfait, heure par heure."}'::jsonb),
  ('tournante', 8, null, '{"texte":"La chose la plus spontanée que tu aies faite ce mois-ci ?"}'::jsonb),
  ('tournante', 9, null, '{"texte":"Qu''est-ce qui te manque le plus de nos années ensemble ?"}'::jsonb),
  ('tournante', 10, null, '{"texte":"Si on partait tous en week-end demain, tu nous emmènes où ?"}'::jsonb),
  ('tournante', 11, null, '{"texte":"Ton plus gros projet secret du moment ?"}'::jsonb),
  ('tournante', 12, null, '{"texte":"Le message que tu as hésité à envoyer et que tu n''as pas envoyé ?"}'::jsonb),
  ('tournante', 13, null, '{"texte":"Qu''est-ce qui t''a énervé·e bien plus que ça ne le méritait ?"}'::jsonb),
  ('tournante', 14, null, '{"texte":"Un truc que tout le monde adore et que tu ne supportes pas ?"}'::jsonb),
  ('tournante', 15, null, '{"texte":"La dernière fois que tu as ri jusqu''aux larmes, c''était pourquoi ?"}'::jsonb),
  ('tournante', 16, null, '{"texte":"Qu''est-ce que tu remets à plus tard depuis trop longtemps ?"}'::jsonb),
  ('tournante', 17, null, '{"texte":"Le meilleur conseil qu''on t''a donné ce mois-ci ?"}'::jsonb),
  ('tournante', 18, null, '{"texte":"Un endroit de ta ville que tu nous recommanderais les yeux fermés ?"}'::jsonb),
  ('tournante', 19, null, '{"texte":"Si ton mois avait un titre de film, ce serait quoi ?"}'::jsonb),
  ('tournante', 20, null, '{"texte":"Quelle chanson te remet d''aplomb à chaque fois ?"}'::jsonb),
  ('tournante', 21, null, '{"texte":"Qu''est-ce que tu as mangé de meilleur ce mois-ci ?"}'::jsonb),
  ('tournante', 22, null, '{"texte":"Une petite chose qui t''a rendu·e inexplicablement heureux·se ?"}'::jsonb),
  ('tournante', 23, null, '{"texte":"Qu''est-ce que tu ferais ce week-end si personne ne jugeait ?"}'::jsonb),
  ('tournante', 24, null, '{"texte":"À qui tu penses souvent sans jamais lui écrire ?"}'::jsonb),
  ('tournante', 25, null, '{"texte":"La dernière photo de ta galerie, c''est quoi ?"}'::jsonb),
  ('tournante', 26, null, '{"texte":"Qu''est-ce que tu veux absolument avoir fait avant la fin de l''année ?"}'::jsonb),
  ('tournante', 27, null, '{"texte":"Le pire achat de ta vie, toutes catégories ?"}'::jsonb),
  ('tournante', 28, null, '{"texte":"Qu''est-ce qui a changé chez toi cette année, en vrai ?"}'::jsonb),
  ('tournante', 29, null, '{"texte":"Une question que tu aimerais qu''on te pose plus souvent ?"}'::jsonb),
  ('choix', 0, null, '{"id":"c_sommeil","type":"qcm","intitule":"Ce mois-ci, mon sommeil","choix":["De bébé","Correct","Chaotique","Inexistant"]}'::jsonb),
  ('choix', 1, null, '{"id":"c_social","type":"qcm","intitule":"Ma vie sociale ce mois-ci","choix":["En feu","Équilibrée","Au ralenti","Je vis sous un rocher"]}'::jsonb),
  ('choix', 2, null, '{"id":"c_argent","type":"qcm","intitule":"Mon rapport à l''argent ce mois-ci","choix":["Sage comme une image","Ça va","J''ai craqué une fois","Ne regardons pas le relevé"]}'::jsonb),
  ('choix', 3, null, '{"id":"c_sport","type":"qcm","intitule":"Le sport et moi, ce mois-ci","choix":["Assidu·e","De temps en temps","J''y ai pensé","Le sport est mort"]}'::jsonb),
  ('choix', 4, null, '{"id":"c_cuisine","type":"qcm","intitule":"Ce mois-ci, j''ai surtout mangé","choix":["Fait maison","Un peu des deux","Des livraisons","Du pain et de l''espoir"]}'::jsonb),
  ('choix', 5, null, '{"id":"c_telephone","type":"qcm","intitule":"Mon temps d''écran","choix":["Maîtrisé","Raisonnable","Préoccupant","Je refuse de répondre"]}'::jsonb),
  ('choix', 6, null, '{"id":"c_decouvertes","type":"multi","intitule":"Ce mois-ci, j''ai découvert","choix":["Une série","Un album","Un resto","Un livre","Un sport","Une recette","Un endroit","Une personne","Rien du tout"]}'::jsonb),
  ('choix', 7, null, '{"id":"c_fierte","type":"curseur","intitule":"Ma fierté du mois, sur dix","min":0,"max":10,"basG":"Bof","basD":"Très fier·ère"}'::jsonb),
  ('choix', 8, null, '{"id":"c_stress","type":"curseur","intitule":"Mon niveau de stress","min":0,"max":10,"basG":"Serein·e","basD":"Au bord"}'::jsonb),
  ('choix', 9, null, '{"id":"c_mot","type":"mot","intitule":"Mon mois en UN seul mot","aide":"Un seul. On en fera un nuage de mots du groupe."}'::jsonb),
  ('choix', 10, null, '{"id":"c_prochain","type":"qcm","intitule":"Le mois prochain, je sens que ça va être","choix":["Génial","Chargé","Calme","Aucune idée"]}'::jsonb),
  ('choix', 11, null, '{"id":"c_besoin","type":"multi","intitule":"Ce dont j''aurais besoin là, maintenant","choix":["Des vacances","Du sommeil","Un câlin","De l''argent","Du silence","Voir du monde","Un projet","Rien, ça va"]}'::jsonb),
  ('saison', 0, 1, '{"id":"s_janvier","type":"long","intitule":"Ta résolution de janvier, et ton pronostic honnête sur sa survie ?"}'::jsonb),
  ('saison', 0, 2, '{"id":"s_fevrier","type":"long","intitule":"Février, mois de l''amour : raconte-nous une histoire d''amour. La tienne, celle d''un·e ami·e, ou celle de tes grands-parents."}'::jsonb),
  ('saison', 0, 3, '{"id":"s_mars","type":"long","intitule":"Qu''est-ce que tu recommences, ou qu''est-ce que tu arrêtes, ce trimestre ?"}'::jsonb),
  ('saison', 0, 4, '{"id":"s_avril","type":"long","intitule":"La dernière fois que tu t''es fait avoir, ou que tu as bien eu quelqu''un ?"}'::jsonb),
  ('saison', 0, 5, '{"id":"s_mai","type":"long","intitule":"Ton prochain jour de congé, tu en fais quoi ?"}'::jsonb),
  ('saison', 0, 6, '{"id":"s_juin","type":"long","intitule":"La moitié de l''année est passée : qu''est-ce que tu gardes, qu''est-ce que tu jettes ?"}'::jsonb),
  ('saison', 0, 7, '{"id":"s_juillet","type":"long","intitule":"Ton plan de l''été, même modeste, même inavouable ?"}'::jsonb),
  ('saison', 0, 8, '{"id":"s_aout","type":"long","intitule":"Le meilleur souvenir d''été de ta vie, toutes années confondues ?"}'::jsonb),
  ('saison', 0, 9, '{"id":"s_septembre","type":"long","intitule":"Ta rentrée en un mot et en une photo. À quoi ressemble ta vie en ce moment ?"}'::jsonb),
  ('saison', 0, 10, '{"id":"s_octobre","type":"long","intitule":"De quoi tu as eu peur cette année, et est-ce que ça s''est réalisé ?"}'::jsonb),
  ('saison', 0, 11, '{"id":"s_novembre","type":"long","intitule":"Trois choses pour lesquelles tu es sincèrement reconnaissant·e en ce moment ?"}'::jsonb),
  ('saison', 0, 12, '{"id":"s_decembre","type":"long","intitule":"Ton bilan de l''année en trois lignes : le meilleur, le pire, la surprise."}'::jsonb),
  ('fete', 0, null, '{"id":"fete","type":"long","intitule":"Une fête, une tradition, une occasion ce mois-ci ?","aide":"Même minuscule, même inventée. Ou rien du tout, c''est très bien aussi."}'::jsonb);

-- ------------------------------------------------------------
--  4. COMPOSER LES QUESTIONS D'UN NUMÉRO
--     Même recette que le site : les rubriques fixes, la question
--     de saison du mois, la question des fêtes, puis des questions
--     à cocher et des questions surprises tirées au hasard.
-- ------------------------------------------------------------
create or replace function questions_du_mois(p_mois date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = newsletter, public
as $$
declare
  res      jsonb := '[]'::jsonb;
  n_tour   int;
  n_choix  int;
begin
  select coalesce((valeur #>> '{}')::int, 2) into n_tour  from reglages where cle = 'nb_tournantes';
  select coalesce((valeur #>> '{}')::int, 2) into n_choix from reglages where cle = 'nb_choix';
  n_tour  := coalesce(n_tour, 2);
  n_choix := coalesce(n_choix, 2);

  -- Les rubriques fixes, dans leur ordre.
  select coalesce(jsonb_agg(question order by ordre, id), '[]'::jsonb) into res
    from banque where categorie = 'rubrique';

  -- La question de saison du mois.
  res := res || coalesce((
    select jsonb_agg(question || jsonb_build_object('saison', true))
      from banque
     where categorie = 'saison'
       and mois = extract(month from p_mois)::int
  ), '[]'::jsonb);

  -- La question des fêtes, personnalisée côté site selon le profil.
  res := res || coalesce((
    select jsonb_agg(question || jsonb_build_object('fete', true))
      from banque where categorie = 'fete'
  ), '[]'::jsonb);

  -- Des questions à cocher, au hasard.
  res := res || coalesce((
    select jsonb_agg(question || jsonb_build_object('tournante', true))
      from (select question from banque where categorie = 'choix'
             order by random() limit n_choix) t
  ), '[]'::jsonb);

  -- Des questions surprises, au hasard, numérotées comme sur le site.
  res := res || coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', 'tournante' || rang,
             'type', 'long',
             'intitule', question ->> 'texte',
             'tournante', true))
      from (select question, row_number() over () as rang
              from (select question from banque where categorie = 'tournante'
                     order by random() limit n_tour) x) y
  ), '[]'::jsonb);

  return res;
end;
$$;
