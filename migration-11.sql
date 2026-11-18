-- ============================================================
--  My Newsletter : migration 11
--  Chacune range sa page comme elle veut
--  À coller dans Supabase > SQL Editor, après migration-10.sql.
--  Relançable sans risque.
-- ============================================================
--  Par défaut, la page est montée toute seule avec un gabarit.
--  Dès qu'une personne déplace un bloc, on enregistre SA mise en
--  page à elle, dans sa propre réponse. Elle ne peut toucher
--  qu'à la sienne : c'est verrouillé par les règles existantes
--  de la table des réponses.
--
--  Forme de la colonne :
--    { "libre": true,
--      "blocs": [ { "id": "resume", "large": 3 }, … ] }
--  `large` = le nombre de colonnes sur six.
-- ============================================================

set search_path = newsletter, public;

alter table reponses add column if not exists mise_en_page jsonb;

comment on column reponses.mise_en_page is
  'Rangement des blocs choisi par la personne. Null = gabarit automatique.';

-- Le garde-fou : on ne range que sa propre page.
-- (Les politiques d'écriture de `reponses` le font déjà, on vérifie
--  seulement qu'elles existent bien avant de s'en remettre à elles.)
do $$
declare n int;
begin
  select count(*) into n
    from pg_policies
   where schemaname = 'newsletter'
     and tablename  = 'reponses'
     and cmd in ('UPDATE', 'ALL');
  if n = 0 then
    raise warning 'Aucune politique d''écriture sur reponses : relance schema.sql.';
  else
    raise notice 'Mise en page personnelle en place.';
  end if;
end $$;
