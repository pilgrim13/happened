-- 008_postgis.down.sql
-- Manual rollback for the 008_postgis migration. The migration runner does not
-- support `down` automatically; apply this file with `psql $DATABASE_URL -f`
-- and then delete the row from schema_migrations:
--   delete from schema_migrations where id = '008_postgis.sql';

drop index if exists memory_posts_geom_gix;
drop trigger if exists memory_posts_sync_geom_trg on memory_posts;
drop function if exists memory_posts_sync_geom();
alter table memory_posts drop column if exists geom;

drop index if exists places_geom_gix;
drop trigger if exists places_sync_geom_trg on places;
drop function if exists places_sync_geom();
alter table places drop column if exists geom;

-- Intentionally NOT dropping the postgis extension; it may be in use elsewhere.
-- To remove it manually: drop extension if exists postgis;
