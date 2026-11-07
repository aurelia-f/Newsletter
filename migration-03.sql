-- ============================================================
--  Entre Nous — migration 03
--  Questions posées par les copines, réactions, fêtes célébrées
--  À coller dans Supabase > SQL Editor > New query > Run,
--  après migration-02.sql. Relançable sans risque.
-- ============================================================

set search_path = newsletter, public;

-- ------------------------------------------------------------
-- 1. LES FÊTES QUE CHACUNE CÉLÈBRE
--    Sert aux questions de saison : en décembre, l'une raconte
--    son Noël, l'autre son Aïd, une troisième sa fin d'année.
--    Facultatif : sans réponse, la question reste neutre.
-- ------------------------------------------------------------
alter table profiles add column if not exists fetes text[] not null default '{}';

-- ------------------------------------------------------------
-- 2. LES QUESTIONS POSÉES PAR LES COPINES
--    destinataire_id vide  → la question est posée à tout le groupe
--    destinataire_id rempli → elle est posée à une seule personne
--    Dans les deux cas, la réponse paraît dans l'édition.
-- ------------------------------------------------------------
create table if not exists questions_posees (
  id              uuid primary key default gen_random_uuid(),
  edition_id      uuid not null references editions(id) on delete cascade,
  auteur_id       uuid not null references profiles(id) on delete cascade,
  destinataire_id uuid references profiles(id) on delete cascade,
  texte           text not null check (char_length(trim(texte)) between 3 and 300),
  cree_le         timestamptz not null default now()
);

create index if not exists questions_posees_edition_idx on questions_posees(edition_id);

-- Le groupe auquel appartient une édition.
create or replace function groupe_de_ledition(e uuid)
returns uuid
language sql security definer stable
set search_path = newsletter, public
as $$ select groupe_id from editions where id = e; $$;

-- Le statut d'une édition.
create or replace function statut_de_ledition(e uuid)
returns text
language sql security definer stable
set search_path = newsletter, public
as $$ select statut from editions where id = e; $$;

alter table questions_posees enable row level security;

-- On lit les questions des éditions de ses groupes.
drop policy if exists "lire les questions posees" on questions_posees;
create policy "lire les questions posees" on questions_posees
  for select using (groupe_de_ledition(edition_id) in (select mes_groupes()));

-- On pose une question en son nom, dans une édition encore ouverte
-- d'un groupe dont on est membre.
drop policy if exists "poser une question" on questions_posees;
create policy "poser une question" on questions_posees
  for insert with check (
    auteur_id = auth.uid()
    and statut_de_ledition(edition_id) = 'ouverte'
    and groupe_de_ledition(edition_id) in (select mes_groupes())
  );

-- On retire sa propre question tant que l'édition n'est pas publiée.
-- Une administratrice peut retirer n'importe quelle question (modération).
drop policy if exists "retirer une question" on questions_posees;
create policy "retirer une question" on questions_posees
  for delete using (
    statut_de_ledition(edition_id) = 'ouverte'
    and (
      auteur_id = auth.uid()
      or groupe_de_ledition(edition_id) in (select mes_groupes_admin())
    )
  );

-- ------------------------------------------------------------
-- 3. LES RÉACTIONS
--    Un emoji et, si on veut, un petit mot sous la page d'une
--    copine, dans une édition publiée. Une réaction par personne
--    et par page : on modifie la sienne, on n'en empile pas.
-- ------------------------------------------------------------
create table if not exists reactions (
  id         uuid primary key default gen_random_uuid(),
  reponse_id uuid not null references reponses(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  emoji      text check (emoji is null or char_length(emoji) <= 8),
  mot        text check (mot is null or char_length(mot) <= 140),
  cree_le    timestamptz not null default now(),
  unique (reponse_id, profile_id)
);

create index if not exists reactions_reponse_idx on reactions(reponse_id);

-- Une page de magazine est-elle lisible par la personne connectée ?
-- Vrai seulement si son édition est publiée et dans un de ses groupes.
create or replace function reponse_lisible(r uuid)
returns boolean
language sql security definer stable
set search_path = newsletter, public
as $$
  select exists (
    select 1
    from reponses rep
    join editions e on e.id = rep.edition_id
    where rep.id = r
      and e.statut = 'publiee'
      and e.groupe_id in (select mes_groupes())
  );
$$;

alter table reactions enable row level security;

drop policy if exists "lire les reactions" on reactions;
create policy "lire les reactions" on reactions
  for select using (reponse_lisible(reponse_id));

drop policy if exists "reagir" on reactions;
create policy "reagir" on reactions
  for insert with check (profile_id = auth.uid() and reponse_lisible(reponse_id));

drop policy if exists "modifier sa reaction" on reactions;
create policy "modifier sa reaction" on reactions
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "retirer sa reaction" on reactions;
create policy "retirer sa reaction" on reactions
  for delete using (profile_id = auth.uid());

-- ------------------------------------------------------------
-- 4. LIRE LES ANNIVERSAIRES DES COPINES
--    La règle de lecture des profils existe déjà (migration 01) :
--    on voit le profil des copines de ses groupes. Les colonnes
--    date_naissance et fetes en font partie, rien à ajouter.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 5. « IL Y A UN AN »
--    Rien à créer : la règle de lecture des réponses autorise
--    déjà toutes les éditions publiées de ses groupes, donc
--    celles de l'année dernière aussi.
-- ------------------------------------------------------------
