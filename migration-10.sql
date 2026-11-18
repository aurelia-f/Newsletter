-- ============================================================
--  My Newsletter : migration 10
--  La couleur du numéro — la première qui choisit décide
--  À coller dans Supabase > SQL Editor, après migration-09.sql.
--  Relançable sans risque.
-- ============================================================
--  Règle voulue : dans un numéro, tout le monde a la même couleur.
--  La première personne qui en choisit une la fixe pour le groupe.
--  Si personne ne choisit, le numéro sort en noir et blanc.
--
--  Ce n'est pas qu'une règle d'affichage : elle est verrouillée
--  dans la base. Même en trafiquant les requêtes depuis le
--  navigateur, on ne peut pas repeindre le numéro d'une copine.
--  Seules les administratrices peuvent revenir dessus.
-- ============================================================

set search_path = newsletter, public;

-- ------------------------------------------------------------
--  1. LES DEUX COLONNES
--     rendu   : 'nb' (noir et blanc), 'duo' (une seule couleur)
--               ou 'couleur' (photos en couleur)
--     couleur : la teinte choisie, en hexadécimal
-- ------------------------------------------------------------
alter table editions add column if not exists rendu   text;
alter table editions add column if not exists couleur text;
alter table editions add column if not exists rendu_par uuid references profiles(id);
alter table editions add column if not exists rendu_le  timestamptz;

alter table editions drop constraint if exists editions_rendu_valide;
alter table editions add  constraint editions_rendu_valide
  check (rendu is null or rendu in ('nb', 'duo', 'couleur'));

alter table editions drop constraint if exists editions_couleur_valide;
alter table editions add  constraint editions_couleur_valide
  check (couleur is null or couleur ~* '^#[0-9a-f]{6}$');

-- ------------------------------------------------------------
--  2. LE GARDE-FOU : on ne repeint pas le numéro d'une autre
-- ------------------------------------------------------------
create or replace function garder_la_couleur()
returns trigger
language plpgsql
as $$
declare
  est_admin boolean;
begin
  -- Rien ne change côté couleur : on laisse passer.
  if new.rendu is not distinct from old.rendu
     and new.couleur is not distinct from old.couleur then
    return new;
  end if;

  -- Le numéro n'avait pas encore de couleur : la première gagne.
  if old.rendu is null then
    new.rendu_par := auth.uid();
    new.rendu_le  := now();
    return new;
  end if;

  -- Il en avait une. Seules les administratrices peuvent la changer.
  select exists (
    select 1 from membres m
     where m.groupe_id = old.groupe_id
       and m.profile_id = auth.uid()
       and m.role in ('creatrice', 'admin')
  ) into est_admin;

  if not est_admin then
    raise exception
      'La couleur de ce numéro a déjà été choisie. Seule une administratrice peut la changer.';
  end if;

  new.rendu_par := auth.uid();
  new.rendu_le  := now();
  return new;
end;
$$;

drop trigger if exists editions_garder_la_couleur on editions;
create trigger editions_garder_la_couleur
  before update on editions
  for each row execute function garder_la_couleur();

-- ------------------------------------------------------------
--  3. QUI PEUT POSER LA COULEUR
--     N'importe quelle membre du groupe, comme pour l'ouverture
--     d'un numéro. Le garde-fou ci-dessus fait le reste.
-- ------------------------------------------------------------
drop policy if exists editions_couleur_membre on editions;
create policy editions_couleur_membre on editions
  for update
  using (exists (
    select 1 from membres m
     where m.groupe_id = editions.groupe_id
       and m.profile_id = auth.uid()))
  with check (exists (
    select 1 from membres m
     where m.groupe_id = editions.groupe_id
       and m.profile_id = auth.uid()));

do $$ begin
  raise notice 'Couleur du numéro en place : la première qui choisit décide.';
end $$;
