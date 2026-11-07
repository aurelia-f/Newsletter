-- ============================================================
--  Entre Nous — migration 02
--  Fiche profil, co-administratrices, protections
--  À coller dans Supabase > SQL Editor > New query > Run.
--  Relançable autant de fois que tu veux sans rien casser.
-- ============================================================

-- Tes tables vivent dans le schéma `newsletter` (c'est ce que
-- dit db.js). Si jamais elles sont dans `public`, cette ligne
-- ne gêne pas : Postgres retombera sur `public` tout seul.
set search_path = newsletter, public;

-- ------------------------------------------------------------
-- 1. LA FICHE PROFIL
--    On peut maintenant mettre des informations sur soi.
-- ------------------------------------------------------------
alter table profiles add column if not exists date_naissance date;
alter table profiles add column if not exists bio   text;
alter table profiles add column if not exists ville text;

-- ------------------------------------------------------------
-- 2. PREMIÈRE CONNEXION
--    Avant : le prénom était rempli avec le début de l'adresse
--    e-mail (« aurelia.fournier »). Maintenant on le laisse
--    vide, et le site demande « Comment on t'appelle ? ».
-- ------------------------------------------------------------
create or replace function gerer_nouvel_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = newsletter, public
as $$
begin
  insert into profiles (id, email, prenom)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data->>'prenom'), ''))
  on conflict (id) do nothing;

  -- On rattache les invitations en attente portant la même adresse,
  -- en gardant le prénom que l'admin avait éventuellement saisi.
  update membres
     set profile_id = new.id
   where profile_id is null
     and lower(email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function gerer_nouvel_utilisateur();

-- Nettoyage : les prénoms déjà remplis automatiquement avec le
-- début de l'adresse e-mail sont remis à vide, pour que le site
-- pose la question à la prochaine connexion.
update profiles
   set prenom = null
 where prenom is not null
   and prenom = split_part(email, '@', 1);

update membres m
   set prenom = null
 where m.prenom is not null
   and m.prenom = split_part(m.email, '@', 1);

-- Filet de sécurité : si un compte avait été créé avant la pose du
-- trigger, le site doit pouvoir créer la ligne de profil manquante.
drop policy if exists "creer son profil" on profiles;
create policy "creer son profil" on profiles
  for insert with check (id = auth.uid());

-- ------------------------------------------------------------
-- 3. PLUSIEURS ADMINISTRATRICES PAR GROUPE
--    Une co-admin peut tout faire : inviter, retirer, ouvrir et
--    publier. Sauf deux choses, réservées à la créatrice :
--    supprimer le groupe, et retirer la créatrice.
-- ------------------------------------------------------------

-- Qui a créé le groupe ? (utilisé par les règles ci-dessous)
create or replace function creatrice_du_groupe(g uuid)
returns uuid
language sql
security definer
stable
set search_path = newsletter, public
as $$
  select cree_par from groupes where id = g;
$$;

-- Garde-fou sur les changements de rôle. Un trigger plutôt
-- qu'une règle RLS, parce qu'il faut comparer l'ancien et le
-- nouveau rôle — ce que RLS ne sait pas faire.
create or replace function proteger_role_membre()
returns trigger
language plpgsql
security definer
set search_path = newsletter, public
as $$
begin
  if new.role is distinct from old.role then

    -- Seule une administratrice du groupe peut changer un rôle.
    if not exists (
      select 1 from membres
      where groupe_id = old.groupe_id
        and profile_id = auth.uid()
        and role = 'admin'
    ) then
      raise exception 'Seule une administratrice peut changer un rôle.';
    end if;

    -- La créatrice du groupe reste administratrice, toujours.
    if old.profile_id = creatrice_du_groupe(old.groupe_id)
       and new.role <> 'admin' then
      raise exception 'La créatrice du groupe reste administratrice.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_membre_role_change on membres;
create trigger on_membre_role_change
  before update on membres
  for each row execute function proteger_role_membre();

-- ------------------------------------------------------------
-- 4. RÈGLES DE SÉCURITÉ MISES À JOUR
-- ------------------------------------------------------------

-- Modifier une ligne de membre : son propre prénom, ou — si on
-- est admin du groupe — le rôle d'une copine. Le trigger
-- ci-dessus empêche de se nommer admin toute seule.
drop policy if exists "admin modifie un membre" on membres;
drop policy if exists "modifier un membre" on membres;
create policy "modifier un membre" on membres
  for update using (
    profile_id = auth.uid()
    or groupe_id in (select mes_groupes_admin())
  )
  with check (
    profile_id = auth.uid()
    or groupe_id in (select mes_groupes_admin())
  );

-- Retirer une copine : par une admin, ou par elle-même si elle
-- veut quitter le groupe. Jamais la créatrice.
drop policy if exists "admin retire un membre" on membres;
drop policy if exists "retirer un membre" on membres;
create policy "retirer un membre" on membres
  for delete using (
    (groupe_id in (select mes_groupes_admin()) or profile_id = auth.uid())
    and profile_id is distinct from creatrice_du_groupe(groupe_id)
  );

-- Supprimer le groupe : la créatrice seule.
drop policy if exists "admin supprime le groupe" on groupes;
drop policy if exists "la creatrice supprime le groupe" on groupes;
create policy "la creatrice supprime le groupe" on groupes
  for delete using (cree_par = auth.uid());

-- ------------------------------------------------------------
-- 5. STOCKAGE DES PHOTOS DE PROFIL
--    Le bucket utilisé par le site s'appelle `medias-newsletter`.
--    Les avatars y vivent avec les photos des éditions, dans le
--    dossier de chacune.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('medias-newsletter', 'medias-newsletter', true)
on conflict (id) do nothing;

drop policy if exists "envoyer ses medias" on storage.objects;
create policy "envoyer ses medias" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('medias', 'medias-newsletter')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "remplacer ses medias" on storage.objects;
create policy "remplacer ses medias" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('medias', 'medias-newsletter')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "supprimer ses medias" on storage.objects;
create policy "supprimer ses medias" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('medias', 'medias-newsletter')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "lire les medias" on storage.objects;
create policy "lire les medias" on storage.objects
  for select using (bucket_id in ('medias', 'medias-newsletter'));
