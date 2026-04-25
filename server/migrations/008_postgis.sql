-- 008_postgis.sql
-- Enable PostGIS, add geography(POINT,4326) columns derived from lat/lng, GIST indexes,
-- and trigger-based auto-sync so existing app code that writes lat/lng keeps working.
-- Backfill existing rows.

create extension if not exists postgis;

-- places: add geom + index
alter table places add column if not exists geom geography(Point, 4326);

create or replace function places_sync_geom() returns trigger as $$
begin
  if new.lat is not null and new.lng is not null then
    new.geom := ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists places_sync_geom_trg on places;
create trigger places_sync_geom_trg
  before insert or update of lat, lng on places
  for each row execute function places_sync_geom();

update places
   set geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
 where geom is null and lat is not null and lng is not null;

create index if not exists places_geom_gix on places using gist (geom);

-- memory_posts has no lat/lng of its own (distance_meters is denormalized);
-- we still add a geom column derived from the linked place at insert/update time
-- so radius/KNN queries against posts work without re-joining places.
alter table memory_posts add column if not exists geom geography(Point, 4326);

create or replace function memory_posts_sync_geom() returns trigger as $$
declare
  p_lat double precision;
  p_lng double precision;
begin
  if new.place_id is not null then
    select lat, lng into p_lat, p_lng from places where id = new.place_id;
    if p_lat is not null and p_lng is not null then
      new.geom := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists memory_posts_sync_geom_trg on memory_posts;
create trigger memory_posts_sync_geom_trg
  before insert or update of place_id on memory_posts
  for each row execute function memory_posts_sync_geom();

update memory_posts mp
   set geom = ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography
  from places p
 where mp.place_id = p.id
   and mp.geom is null
   and p.lat is not null
   and p.lng is not null;

create index if not exists memory_posts_geom_gix on memory_posts using gist (geom);
