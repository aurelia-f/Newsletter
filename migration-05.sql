-- ============================================================
--  Entre Nous : migration 05
--  Le brouillon mensuel, commun à tous les groupes
--  À coller dans Supabase > SQL Editor, après migration-04.sql.
--  Relançable sans risque.
-- ============================================================

set search_path = newsletter, public;

-- ------------------------------------------------------------
--  UN BROUILLON PAR PERSONNE ET PAR MOIS
--  Avant, on remplissait un formulaire par groupe. Maintenant on
--  remplit une seule fois, puis on coche les groupes à qui
--  l'envoyer. Ce brouillon est la source : il ne dépend d'aucun
--  groupe, et il reste disponible pour envoyer plus tard à un
--  groupe laissé de côté, déjà pré-rempli.
-- ------------------------------------------------------------
create table if not exists brouillons (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  mois       date not null,
  contenu    jsonb not null default '{}'::jsonb,
  medias     jsonb not null default '[]'::jsonb,
  maj_le     timestamptz not null default now(),
  unique (profile_id, mois)
);

create index if not exists brouillons_profil_idx on brouillons(profile_id);

alter table brouillons enable row level security;

-- Un brouillon est strictement privé : personne d'autre ne le voit,
-- jamais. Ce qui est partagé, c'est la réponse envoyée à un groupe.
drop policy if exists "lire son brouillon" on brouillons;
create policy "lire son brouillon" on brouillons
  for select using (profile_id = auth.uid());

drop policy if exists "ecrire son brouillon" on brouillons;
create policy "ecrire son brouillon" on brouillons
  for insert with check (profile_id = auth.uid());

drop policy if exists "modifier son brouillon" on brouillons;
create policy "modifier son brouillon" on brouillons
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "supprimer son brouillon" on brouillons;
create policy "supprimer son brouillon" on brouillons
  for delete using (profile_id = auth.uid());
