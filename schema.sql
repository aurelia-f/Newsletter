-- ============================================================
--  Entre Nous — newsletter privée entre copines
--  Schéma Supabase : tables, sécurité (RLS) et stockage
--  À coller dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILS
--    Une ligne par personne connectée. Créée automatiquement
--    à la première connexion par le trigger plus bas.
-- ------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text not null unique,
  prenom      text,
  avatar_url  text,
  date_naissance date,
  bio         text,
  ville       text,
  cree_le     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. GROUPES
--    Un groupe de copines. Aurélia peut en avoir plusieurs,
--    totalement cloisonnés.
-- ------------------------------------------------------------
create table if not exists groupes (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  emoji       text default '🎀',
  cree_par    uuid not null references profiles(id) on delete cascade,
  cree_le     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. MEMBRES
--    On invite par e-mail AVANT que la personne ait un compte :
--    profile_id reste vide, puis se remplit tout seul à sa
--    première connexion (trigger plus bas). Zéro friction.
-- ------------------------------------------------------------
create table if not exists membres (
  id          uuid primary key default gen_random_uuid(),
  groupe_id   uuid not null references groupes(id) on delete cascade,
  email       text not null,
  prenom      text,
  profile_id  uuid references profiles(id) on delete set null,
  role        text not null default 'membre' check (role in ('membre','admin')),
  ajoute_le   timestamptz not null default now(),
  unique (groupe_id, email)
);

create index if not exists membres_profile_idx on membres(profile_id);
create index if not exists membres_email_idx   on membres(lower(email));

-- ------------------------------------------------------------
-- 4. ÉDITIONS
--    Un numéro mensuel par groupe. Les questions sont stockées
--    en JSON : elles peuvent donc évoluer d'un mois à l'autre
--    sans jamais toucher à la base.
-- ------------------------------------------------------------
create table if not exists editions (
  id          uuid primary key default gen_random_uuid(),
  groupe_id   uuid not null references groupes(id) on delete cascade,
  numero      int  not null,
  mois        date not null,            -- 1er du mois concerné
  titre       text,
  statut      text not null default 'ouverte'
              check (statut in ('ouverte','publiee')),
  questions   jsonb not null default '[]'::jsonb,
  publiee_le  timestamptz,
  unique (groupe_id, mois)
);

-- ------------------------------------------------------------
-- 5. RÉPONSES
--    Une ligne par copine et par édition. Le contenu est en
--    JSON (clé = id de question) et les médias à part.
-- ------------------------------------------------------------
create table if not exists reponses (
  id           uuid primary key default gen_random_uuid(),
  edition_id   uuid not null references editions(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  contenu      jsonb not null default '{}'::jsonb,
  medias       jsonb not null default '[]'::jsonb,
  envoyee      boolean not null default false,
  maj_le       timestamptz not null default now(),
  unique (edition_id, profile_id)
);

-- ============================================================
--  FONCTIONS UTILITAIRES
-- ============================================================

-- Les groupes auxquels la personne connectée appartient.
-- SECURITY DEFINER pour éviter une récursion infinie dans les
-- politiques RLS de la table membres.
create or replace function mes_groupes()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select groupe_id from membres where profile_id = auth.uid();
$$;

-- Les groupes où la personne connectée est administratrice.
create or replace function mes_groupes_admin()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select groupe_id from membres
  where profile_id = auth.uid() and role = 'admin';
$$;

-- À la création d'un compte : on crée le profil, puis on
-- rattache automatiquement toutes les invitations en attente
-- qui portent la même adresse e-mail.
create or replace function gerer_nouvel_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, prenom)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'prenom', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  update membres
     set profile_id = new.id,
         prenom = coalesce(prenom, split_part(new.email, '@', 1))
   where profile_id is null
     and lower(email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function gerer_nouvel_utilisateur();

-- ============================================================
--  SÉCURITÉ (RLS)
--  Règle d'or : on ne voit que les groupes dont on est membre.
-- ============================================================

alter table profiles enable row level security;
alter table groupes  enable row level security;
alter table membres  enable row level security;
alter table editions enable row level security;
alter table reponses enable row level security;

-- PROFILS ----------------------------------------------------
drop policy if exists "profil lisible par les copines" on profiles;
create policy "profil lisible par les copines" on profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from membres m
      where m.profile_id = profiles.id
        and m.groupe_id in (select mes_groupes())
    )
  );

drop policy if exists "chacune modifie son profil" on profiles;
create policy "chacune modifie son profil" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- GROUPES ----------------------------------------------------
drop policy if exists "voir ses groupes" on groupes;
create policy "voir ses groupes" on groupes
  for select using (
    id in (select mes_groupes())
    or cree_par = auth.uid()
  );

drop policy if exists "creer un groupe" on groupes;
create policy "creer un groupe" on groupes
  for insert with check (cree_par = auth.uid());

drop policy if exists "admin modifie le groupe" on groupes;
create policy "admin modifie le groupe" on groupes
  for update using (id in (select mes_groupes_admin()));

drop policy if exists "admin supprime le groupe" on groupes;
create policy "admin supprime le groupe" on groupes
  for delete using (id in (select mes_groupes_admin()));

-- MEMBRES ----------------------------------------------------
drop policy if exists "voir les membres de ses groupes" on membres;
create policy "voir les membres de ses groupes" on membres
  for select using (
    profile_id = auth.uid()
    or groupe_id in (select mes_groupes())
  );

-- Permet à la créatrice de s'ajouter elle-même comme admin
-- juste après avoir créé le groupe, puis aux admins d'inviter.
drop policy if exists "admin invite" on membres;
create policy "admin invite" on membres
  for insert with check (
    groupe_id in (select mes_groupes_admin())
    or exists (
      select 1 from groupes g
      where g.id = membres.groupe_id and g.cree_par = auth.uid()
    )
  );

drop policy if exists "admin modifie un membre" on membres;
create policy "admin modifie un membre" on membres
  for update using (groupe_id in (select mes_groupes_admin()));

drop policy if exists "admin retire un membre" on membres;
create policy "admin retire un membre" on membres
  for delete using (groupe_id in (select mes_groupes_admin()));

-- ÉDITIONS ---------------------------------------------------
drop policy if exists "voir les editions de ses groupes" on editions;
create policy "voir les editions de ses groupes" on editions
  for select using (groupe_id in (select mes_groupes()));

drop policy if exists "admin cree une edition" on editions;
create policy "admin cree une edition" on editions
  for insert with check (groupe_id in (select mes_groupes_admin()));

drop policy if exists "admin modifie une edition" on editions;
create policy "admin modifie une edition" on editions
  for update using (groupe_id in (select mes_groupes_admin()));

drop policy if exists "admin supprime une edition" on editions;
create policy "admin supprime une edition" on editions
  for delete using (groupe_id in (select mes_groupes_admin()));

-- RÉPONSES ---------------------------------------------------
-- Tant que l'édition est ouverte, chacune ne voit que la
-- sienne : la surprise du 1er du mois est préservée.
-- Une fois publiée, tout le groupe peut tout lire.
drop policy if exists "lire les reponses" on reponses;
create policy "lire les reponses" on reponses
  for select using (
    profile_id = auth.uid()
    or exists (
      select 1 from editions e
      where e.id = reponses.edition_id
        and e.statut = 'publiee'
        and e.groupe_id in (select mes_groupes())
    )
  );

drop policy if exists "ecrire sa reponse" on reponses;
create policy "ecrire sa reponse" on reponses
  for insert with check (
    profile_id = auth.uid()
    and exists (
      select 1 from editions e
      where e.id = reponses.edition_id
        and e.statut = 'ouverte'
        and e.groupe_id in (select mes_groupes())
    )
  );

drop policy if exists "modifier sa reponse" on reponses;
create policy "modifier sa reponse" on reponses
  for update using (
    profile_id = auth.uid()
    and exists (
      select 1 from editions e
      where e.id = reponses.edition_id and e.statut = 'ouverte'
    )
  );

-- ============================================================
--  STOCKAGE DES PHOTOS ET VIDÉOS
-- ============================================================
insert into storage.buckets (id, name, public)
values ('medias-newsletter', 'medias-newsletter', true)
on conflict (id) do nothing;

drop policy if exists "envoyer ses medias" on storage.objects;
create policy "envoyer ses medias" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'medias-newsletter' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "supprimer ses medias" on storage.objects;
create policy "supprimer ses medias" on storage.objects
  for delete to authenticated
  using (bucket_id = 'medias-newsletter' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "lire les medias" on storage.objects;
create policy "lire les medias" on storage.objects
  for select using (bucket_id = 'medias-newsletter');
