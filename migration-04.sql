-- ============================================================
--  Entre Nous : migration 04
--  Mémoriser que le tutoriel d'accueil a été vu
--  À coller dans Supabase > SQL Editor, après migration-03.sql.
--  Relançable sans risque.
-- ============================================================

set search_path = newsletter, public;

-- Stocké sur le profil plutôt que dans le navigateur : ainsi le
-- tutoriel ne se réaffiche pas quand on ouvre le site sur son
-- téléphone après l'avoir vu sur son ordinateur.
alter table profiles add column if not exists tuto_vu boolean not null default false;

-- Les comptes qui existent déjà ont découvert le site sans tutoriel.
-- On ne le leur impose pas : elles pourront le rouvrir depuis leur
-- profil si elles le veulent.
update profiles set tuto_vu = true where prenom is not null;
