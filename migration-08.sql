-- ============================================================
--  Entre Nous : migration 08
--  Tout le monde peut ouvrir un questionnaire
--  Nouvelles questions de profil
--  À coller dans Supabase > SQL Editor, après migration-07.sql.
--  Relançable sans risque.
-- ============================================================

set search_path = newsletter, public;

-- ------------------------------------------------------------
--  1. OUVRIR UN QUESTIONNAIRE N'EST PLUS RÉSERVÉ AUX ADMINS
--     Avant, seule une administratrice pouvait ouvrir le numéro
--     du mois. Maintenant n'importe quelle membre du groupe peut,
--     pour que personne n'attende après personne.
--     En revanche, PUBLIER reste réservé aux administratrices :
--     c'est le geste qui rend les pages visibles de tout le monde.
-- ------------------------------------------------------------
drop policy if exists "admin cree une edition" on editions;
drop policy if exists "ouvrir une edition" on editions;
create policy "ouvrir une edition" on editions
  for insert with check (
    groupe_id in (select mes_groupes())
    and statut = 'ouverte'        -- on ouvre, on ne publie pas directement
  );

-- Modifier une édition devient possible pour toutes les membres,
-- mais le garde-fou ci-dessous limite ce qu'elles peuvent changer.
drop policy if exists "admin modifie une edition" on editions;
drop policy if exists "modifier une edition" on editions;
create policy "modifier une edition" on editions
  for update using (groupe_id in (select mes_groupes()))
  with check (groupe_id in (select mes_groupes()));

-- Le garde-fou. Une membre peut seulement laisser renuméroter son
-- groupe. Changer le statut, le mois ou les questions d'un numéro
-- reste le privilège des administratrices.
create or replace function proteger_edition()
returns trigger
language plpgsql
security definer
set search_path = newsletter, public
as $$
declare
  je_suis_admin boolean;
begin
  select exists (
    select 1 from membres
     where groupe_id = old.groupe_id
       and profile_id = auth.uid()
       and role = 'admin'
  ) into je_suis_admin;

  -- Les tâches planifiées tournent sans utilisateur connecté :
  -- elles ont tous les droits.
  if auth.uid() is null then
    return new;
  end if;

  if je_suis_admin then
    return new;
  end if;

  if new.statut is distinct from old.statut then
    raise exception 'Seule une administratrice peut publier un numéro.';
  end if;
  if new.mois is distinct from old.mois then
    raise exception 'Le mois d''un numéro ne se change pas.';
  end if;
  if new.questions is distinct from old.questions then
    raise exception 'Seule une administratrice peut changer les questions d''un numéro.';
  end if;

  return new;
end;
$$;

drop trigger if exists on_edition_update on editions;
create trigger on_edition_update
  before update on editions
  for each row execute function proteger_edition();

-- Supprimer un numéro reste réservé aux administratrices.
drop policy if exists "admin supprime une edition" on editions;
create policy "admin supprime une edition" on editions
  for delete using (groupe_id in (select mes_groupes_admin()));

-- ------------------------------------------------------------
--  2. NOUVELLES QUESTIONS DE PROFIL
--     Ce qu'on a envie de savoir d'une copine qu'on ne voit plus
--     assez souvent, et qui change rarement.
-- ------------------------------------------------------------
alter table profiles add column if not exists occupation text;  -- métier ou études
alter table profiles add column if not exists enfants    text;  -- « deux, 4 et 7 ans »
alter table profiles add column if not exists animaux    text;  -- « un chat, Plume »
alter table profiles add column if not exists anecdote   text;  -- un truc que peu de gens savent
alter table profiles add column if not exists devise     text;  -- la phrase du moment
