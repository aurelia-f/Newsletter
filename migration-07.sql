-- ============================================================
--  Entre Nous : migration 07
--  Le 1er du mois, tout seul : on publie, on ouvre, on prévient
--  À coller dans Supabase > SQL Editor, après migration-06.sql.
--  Relançable sans risque.
-- ============================================================
--  AVANT DE LANCER CE FICHIER
--  Va dans Supabase > Database > Extensions et active :
--    pg_cron  (indispensable : c'est lui qui déclenche à l'heure)
--    pg_net   (seulement si tu veux les mails)
--  Si tu oublies, ce fichier passe quand même sans erreur, et les
--  fonctions restent utilisables à la main.
-- ============================================================

set search_path = newsletter, public;

-- ------------------------------------------------------------
--  1. LA FILE D'ATTENTE DES MAILS
--     On n'envoie pas depuis la fonction qui publie : on dépose le
--     mail ici, et une autre tâche le sort. Ainsi, si le service de
--     mail est en panne ou pas encore configuré, la publication a
--     lieu quand même et les mails partent plus tard.
-- ------------------------------------------------------------
create table if not exists mails (
  id           bigserial primary key,
  destinataire text not null,
  sujet        text not null,
  corps        text not null,
  motif        text,
  -- Deux mails de même motif, même clé et même destinataire ne
  -- partent qu'une fois. C'est ce qui évite les doublons quand la
  -- tâche se déclenche deux fois, et les trois mails identiques
  -- quand on est dans trois groupes.
  cle_unicite  text,
  statut       text not null default 'en_attente'
               check (statut in ('en_attente','envoye','echec','expire')),
  tentatives   int  not null default 0,
  reponse      jsonb,
  cree_le      timestamptz not null default now(),
  envoye_le    timestamptz
);

create index if not exists mails_statut_idx on mails(statut, cree_le);

create unique index if not exists mails_unicite_idx
  on mails(destinataire, motif, cle_unicite)
  where cle_unicite is not null;

-- Aucune politique de lecture : la file ne sort jamais de la base.
alter table mails enable row level security;

-- Le mois en français, pour les sujets de mail.
create or replace function mois_en_lettres(p_mois date)
returns text
language sql
immutable
as $$
  select (array['janvier','février','mars','avril','mai','juin','juillet',
                'août','septembre','octobre','novembre','décembre'])
         [extract(month from p_mois)::int]
         || ' ' || extract(year from p_mois)::text;
$$;

-- ------------------------------------------------------------
--  2. RENUMÉROTER UN GROUPE
--     Les numéros suivent toujours l'ordre des mois.
-- ------------------------------------------------------------
create or replace function renumeroter_groupe(p_groupe uuid)
returns void
language sql
volatile
security definer
set search_path = newsletter, public
as $$
  update editions e
     set numero = t.rang
    from (select id, row_number() over (order by mois) as rang
            from editions where groupe_id = p_groupe) t
   where e.id = t.id and e.numero <> t.rang;
$$;

-- ------------------------------------------------------------
--  3. DÉPOSER UN MAIL POUR TOUT UN GROUPE
-- ------------------------------------------------------------
create or replace function deposer_mail_groupe(
  p_groupe uuid, p_sujet text, p_corps text, p_motif text,
  p_cle_unicite text default null,
  p_seulement_sans_reponse uuid default null)
returns int
language plpgsql
volatile
security definer
set search_path = newsletter, public
as $$
declare
  n int := 0;
begin
  insert into mails (destinataire, sujet, corps, motif, cle_unicite)
  select m.email, p_sujet,
         replace(p_corps, '{{prenom}}', coalesce(m.prenom, 'toi')),
         p_motif, p_cle_unicite
    from membres m
   where m.groupe_id = p_groupe
     and m.email is not null
     -- Si on vise les retardataires, on saute celles qui ont déjà envoyé.
     and (p_seulement_sans_reponse is null
          or not exists (select 1 from reponses r
                          where r.edition_id = p_seulement_sans_reponse
                            and r.profile_id = m.profile_id
                            and r.envoyee))
  on conflict do nothing;
  -- À lire juste après l'insertion, dans la même fonction : un appel
  -- de fonction intermédiaire remettrait ce compteur à zéro.
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ------------------------------------------------------------
--  4. LE BASCULEMENT DU 1er DU MOIS
--     a. on publie les numéros du mois écoulé qui ont au moins une
--        réponse, et on prévient le groupe ;
--     b. un numéro sans aucune réponse reste ouvert, et le groupe
--        reçoit un message pour se relancer ;
--     c. on ouvre le numéro du mois qui commence, pour chaque groupe ;
--     d. on remet les numéros dans l'ordre chronologique.
-- ------------------------------------------------------------
create or replace function basculer_le_mois(p_aujourdhui date default current_date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = newsletter, public
as $$
declare
  mois_courant   date := date_trunc('month', p_aujourdhui)::date;
  mois_precedent date := (date_trunc('month', p_aujourdhui) - interval '1 month')::date;
  e        record;
  g        record;
  nb_reponses int;
  publiees int := 0;
  vides    int := 0;
  ouvertes int := 0;
  mails_deposes int := 0;
begin
  -- a et b : le mois écoulé
  for e in
    select ed.id, ed.groupe_id, ed.numero, ed.mois, gr.nom as nom_groupe
      from editions ed
      join groupes gr on gr.id = ed.groupe_id
     where ed.mois = mois_precedent
       and ed.statut = 'ouverte'
  loop
    select count(*) into nb_reponses
      from reponses r where r.edition_id = e.id and r.envoyee;

    if nb_reponses > 0 then
      update editions
         set statut = 'publiee', publiee_le = now()
       where id = e.id;
      publiees := publiees + 1;

      mails_deposes := mails_deposes + deposer_mail_groupe(
        e.groupe_id,
        e.nom_groupe || ' : le numéro de ' || mois_en_lettres(e.mois) || ' est publié',
        'Bonjour {{prenom}},' || chr(10) || chr(10) ||
        'Le numéro ' || e.numero || ' de ' || e.nom_groupe || ' vient de paraître, ' ||
        'avec ' || nb_reponses || ' page' || case when nb_reponses > 1 then 's' else '' end || ' à lire.' ||
        chr(10) || chr(10) || 'Bonne lecture.',
        'publication', e.id::text);     -- une fois par numéro
    else
      -- Personne n'a répondu : on ne publie pas un numéro vide.
      vides := vides + 1;
      mails_deposes := mails_deposes + deposer_mail_groupe(
        e.groupe_id,
        e.nom_groupe || ' : personne n''a encore répondu pour ' || mois_en_lettres(e.mois),
        'Bonjour {{prenom}},' || chr(10) || chr(10) ||
        'Le numéro de ' || mois_en_lettres(e.mois) || ' pour ' || e.nom_groupe ||
        ' est resté vide. Il reste ouvert, donc rien n''est perdu.' || chr(10) || chr(10) ||
        'Si tu n''as pas vu les messages précédents, c''est le moment. ' ||
        'Et si tu as cinq minutes, relance les autres : il suffit souvent ' ||
        'qu''une personne commence.',
        'relance_vide', e.id::text);    -- une fois par numéro, même si la tâche repasse
    end if;
  end loop;

  -- c : le mois qui commence
  for g in select id, nom from groupes loop
    if not exists (select 1 from editions where groupe_id = g.id and mois = mois_courant) then
      insert into editions (groupe_id, numero, mois, statut, questions)
      values (
        g.id,
        (select count(*) from editions where groupe_id = g.id and mois < mois_courant) + 1,
        mois_courant,
        'ouverte',
        questions_du_mois(mois_courant)
      );
      ouvertes := ouvertes + 1;

      mails_deposes := mails_deposes + deposer_mail_groupe(
        g.id,
        'À toi de raconter : ' || mois_en_lettres(mois_courant),
        'Bonjour {{prenom}},' || chr(10) || chr(10) ||
        'Le questionnaire de ' || mois_en_lettres(mois_courant) || ' est ouvert. ' ||
        'Tu remplis une seule fois, même si tu es dans plusieurs groupes.' || chr(10) || chr(10) ||
        'Tout est facultatif. Réponds à ce qui te parle, saute le reste.',
        -- Une seule fois par personne et par mois : le questionnaire
        -- est commun à tous les groupes, inutile de le dire trois fois.
        'ouverture', 'ouverture-' || mois_courant::text);
    end if;
  end loop;

  -- d : les numéros dans l'ordre
  perform renumeroter_groupe(id) from groupes;

  return jsonb_build_object(
    'le',             p_aujourdhui,
    'mois_publie',    mois_precedent,
    'mois_ouvert',    mois_courant,
    'publiees',       publiees,
    'restees_vides',  vides,
    'ouvertes',       ouvertes,
    'mails_deposes',  mails_deposes
  );
end;
$$;

-- ------------------------------------------------------------
--  5. LA RELANCE AVANT LA CLÔTURE
--     Quelques jours avant le 1er, on prévient celles qui n'ont pas
--     encore envoyé leur page. C'est ce qui fait vivre le projet.
-- ------------------------------------------------------------
create or replace function relancer_avant_cloture(p_aujourdhui date default current_date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = newsletter, public
as $$
declare
  mois_courant date := date_trunc('month', p_aujourdhui)::date;
  fin          date := (date_trunc('month', p_aujourdhui) + interval '1 month')::date;
  jours        int  := (fin - p_aujourdhui);
  e            record;
  deposes      int := 0;
begin
  for e in
    select ed.id, ed.groupe_id, gr.nom as nom_groupe
      from editions ed
      join groupes gr on gr.id = ed.groupe_id
     where ed.mois = mois_courant and ed.statut = 'ouverte'
  loop
    deposes := deposes + deposer_mail_groupe(
      e.groupe_id,
      'Il te reste ' || jours || ' jour' || case when jours > 1 then 's' else '' end ||
        ' pour ' || mois_en_lettres(mois_courant),
      'Bonjour {{prenom}},' || chr(10) || chr(10) ||
      'Le numéro de ' || mois_en_lettres(mois_courant) || ' pour ' || e.nom_groupe ||
      ' se referme le 1er. Tu n''as pas encore envoyé ta page.' || chr(10) || chr(10) ||
      'Cinq minutes suffisent, et il y a même un mode « 5 minutes » qui ne ' ||
      'garde que l''essentiel. Tout est facultatif.',
      'relance',
      'relance-' || mois_courant::text,   -- une seule fois par mois
      e.id);                              -- seulement celles qui n'ont pas envoyé
  end loop;

  return jsonb_build_object('le', p_aujourdhui, 'jours_restants', jours, 'mails_deposes', deposes);
end;
$$;

-- ------------------------------------------------------------
--  6. SORTIR LES MAILS DE LA FILE
--     Marche avec Brevo ou Resend. Tant que la clé n'est pas
--     renseignée, les mails restent en attente sans rien casser,
--     et ils partiront dès que tu l'auras collée.
--
--     Pour l'activer, une seule commande à lancer ici :
--       select newsletter.configurer_mail('brevo', 'TA-CLE',
--              'ton@email.com', 'Entre Nous');
-- ------------------------------------------------------------
create or replace function configurer_mail(
  p_fournisseur text, p_cle text, p_expediteur text, p_nom text default 'Entre Nous')
returns text
language plpgsql
volatile
security definer
set search_path = newsletter, public
as $$
begin
  if p_fournisseur not in ('brevo', 'resend') then
    raise exception 'Fournisseur inconnu : %. Utilise brevo ou resend.', p_fournisseur;
  end if;

  insert into reglages (cle, valeur) values
    ('fournisseur_mail', to_jsonb(p_fournisseur)),
    ('expediteur_mail',  to_jsonb(p_expediteur)),
    ('expediteur_nom',   to_jsonb(p_nom)),
    ('secret_cle_mail',  to_jsonb(p_cle))
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now();

  return 'Service de mail configuré : ' || p_fournisseur || ', expéditeur ' || p_expediteur;
end;
$$;

create or replace function envoyer_mails(p_max int default 40)
returns jsonb
language plpgsql
volatile
security definer
set search_path = newsletter, public
as $$
declare
  -- Préfixe v_ sur toutes les variables : sans lui, `cle` désignait
  -- à la fois la variable et la colonne `reglages.cle`, et PostgreSQL
  -- refusait la requête.
  v_fournisseur text;
  v_cle         text;
  v_expediteur  text;
  v_nom         text;
  v_url         text;
  v_entetes     jsonb;
  v_corps       jsonb;
  v_envoyes     int := 0;
  m             record;
begin
  -- On teste la présence de la fonction elle-même, plus fiable que le
  -- nom de l'extension, et testable en local avec un bouchon.
  if to_regproc('net.http_post') is null then
    return jsonb_build_object(
      'etat', 'pg_net n''est pas activé',
      'en_attente', (select count(*) from mails where statut = 'en_attente'));
  end if;

  select r.valeur #>> '{}' into v_fournisseur from reglages r where r.cle = 'fournisseur_mail';
  select r.valeur #>> '{}' into v_cle         from reglages r where r.cle = 'secret_cle_mail';
  select r.valeur #>> '{}' into v_expediteur  from reglages r where r.cle = 'expediteur_mail';
  select r.valeur #>> '{}' into v_nom         from reglages r where r.cle = 'expediteur_nom';

  if v_cle is null or v_expediteur is null then
    return jsonb_build_object(
      'etat', 'service de mail pas encore configuré',
      'en_attente', (select count(*) from mails where statut = 'en_attente'));
  end if;

  for m in
    select * from mails where statut = 'en_attente' order by cree_le limit p_max
  loop
    if v_fournisseur = 'brevo' then
      v_url := 'https://api.brevo.com/v3/smtp/email';
      v_entetes := jsonb_build_object('api-key', v_cle, 'Content-Type', 'application/json');
      v_corps := jsonb_build_object(
        'sender', jsonb_build_object('email', v_expediteur,
                                     'name', coalesce(v_nom, 'Entre Nous')),
        'to', jsonb_build_array(jsonb_build_object('email', m.destinataire)),
        'subject', m.sujet,
        'textContent', m.corps);
    else
      v_url := 'https://api.resend.com/emails';
      v_entetes := jsonb_build_object('Authorization', 'Bearer ' || v_cle,
                                      'Content-Type', 'application/json');
      v_corps := jsonb_build_object(
        'from', coalesce(v_nom, 'Entre Nous') || ' <' || v_expediteur || '>',
        'to', jsonb_build_array(m.destinataire),
        'subject', m.sujet,
        'text', m.corps);
    end if;

    perform net.http_post(url := v_url, headers := v_entetes, body := v_corps);

    update mails
       set statut = 'envoye', envoye_le = now(), tentatives = tentatives + 1
     where id = m.id;
    v_envoyes := v_envoyes + 1;
  end loop;

  -- Un mail qui attend depuis plus de dix jours n'a plus de sens.
  update mails set statut = 'expire'
   where statut = 'en_attente' and cree_le < now() - interval '10 days';

  return jsonb_build_object(
    'etat', 'ok',
    'envoyes', v_envoyes,
    'en_attente', (select count(*) from mails where statut = 'en_attente'));
end;
$$;

-- ------------------------------------------------------------
--  7. LES TÂCHES PLANIFIÉES
--     Les heures sont en UTC. Le Cap est à UTC+2, la France à UTC+1.
-- ------------------------------------------------------------
do $plan$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron n''est pas activé : les tâches ne sont pas planifiées. Active-le dans Database > Extensions, puis relance ce fichier.';
    return;
  end if;

  -- Le 1er du mois à 02h17 UTC : on publie le mois écoulé et on ouvre le nouveau.
  perform cron.unschedule('entre-nous-bascule')
    where exists (select 1 from cron.job where jobname = 'entre-nous-bascule');
  perform cron.schedule('entre-nous-bascule', '17 2 1 * *',
                        'select newsletter.basculer_le_mois();');

  -- Le 27 à 08h17 UTC : relance des retardataires.
  perform cron.unschedule('entre-nous-relance')
    where exists (select 1 from cron.job where jobname = 'entre-nous-relance');
  perform cron.schedule('entre-nous-relance', '17 8 27 * *',
                        'select newsletter.relancer_avant_cloture();');

  -- Toutes les cinq minutes : on vide la file des mails.
  perform cron.unschedule('entre-nous-mails')
    where exists (select 1 from cron.job where jobname = 'entre-nous-mails');
  perform cron.schedule('entre-nous-mails', '*/5 * * * *',
                        'select newsletter.envoyer_mails();');

  raise notice 'Tâches planifiées : bascule le 1er, relance le 27, mails toutes les 5 minutes.';
end;
$plan$;
