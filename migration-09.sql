-- ============================================================
--  My Newsletter : migration 09
--  On enlève l'envoi de mails (Brevo / Resend)
--  À coller dans Supabase > SQL Editor, après migration-08.sql.
--  Relançable sans risque.
-- ============================================================
--  Pourquoi : les mails n'arrivaient pas, et ils ne sont pas
--  nécessaires. On se connecte sur le site pour lire le numéro.
--
--  Ce qui RESTE en place :
--    · le lien magique de connexion (c'est Supabase Auth, pas nous) ;
--    · le basculement automatique du 1er du mois ;
--    · la relance du 27, qui continue de tourner mais ne dépose
--      plus rien : les rappels s'affichent dans l'appli.
--
--  Ce qui PART :
--    · la file de mails, la clé d'API et l'expéditeur ;
--    · la tâche qui vidait la file toutes les 5 minutes.
-- ============================================================

set search_path = newsletter, public;

-- ------------------------------------------------------------
--  1. ARRÊTER LA TÂCHE QUI ENVOYAIT
-- ------------------------------------------------------------
do $plan$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('entre-nous-mails')
      where exists (select 1 from cron.job where jobname = 'entre-nous-mails');
    raise notice 'Tâche d''envoi de mails supprimée.';
  end if;
end;
$plan$;

-- ------------------------------------------------------------
--  2. LE DÉPÔT DE MAIL DEVIENT UNE COQUILLE VIDE
--     basculer_le_mois() et relancer_avant_cloture() l'appellent
--     encore : on la garde, mais elle ne fait plus rien. Comme ça
--     il n'y a rien d'autre à modifier, et rien ne casse.
-- ------------------------------------------------------------
create or replace function deposer_mail_groupe(
  p_groupe uuid, p_sujet text, p_corps text,
  p_motif text, p_cle_unicite text default null)
returns int
language sql
immutable
as $$ select 0; $$;

comment on function deposer_mail_groupe(uuid, text, text, text, text) is
  'Neutralisée en migration-09 : le site n''envoie plus de mails.';

-- ------------------------------------------------------------
--  3. SUPPRIMER L'ENVOI ET SA CONFIGURATION
-- ------------------------------------------------------------
drop function if exists envoyer_mails(int);
drop function if exists configurer_mail(text, text, text, text);

delete from reglages
 where cle in ('fournisseur_mail', 'expediteur_mail',
               'expediteur_nom', 'secret_cle_mail');

-- ------------------------------------------------------------
--  4. SUPPRIMER LA FILE
--     Les mails en attente n'ont plus de raison d'être : ils
--     n'auraient jamais été lus.
-- ------------------------------------------------------------
drop table if exists mails;

do $$ begin
  raise notice 'Brevo retiré. Le numéro se lit sur le site, point.';
end $$;
