-- 010_postgis.sql
-- Sprint 3: geog GENERATED STORED 컬럼 추가 (places), memory_posts 트리거 갱신,
-- geog GIST 인덱스, 누락 플레인 인덱스 추가.

-- ─── places ──────────────────────────────────────────────────────────────────
-- generated always as stored: 트리거 없이 lat/lng 변경 시 자동 갱신.
-- 008_postgis.sql 의 geom(트리거) 과 병존; 기존 geom 인덱스는 유지.
alter table places
  add column if not exists geog geography(Point, 4326)
    generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored;

create index if not exists places_geog_gix on places using gist (geog);

-- ─── memory_posts ────────────────────────────────────────────────────────────
-- memory_posts 에는 lat/lng 가 없으므로 generated stored 불가; 트리거로 동기화.
alter table memory_posts
  add column if not exists geog geography(Point, 4326);

-- 기존 geom 컬럼(008에서 백필 완료)으로부터 초기값 복사.
update memory_posts set geog = geom where geog is null and geom is not null;

-- 008 트리거 함수를 교체해 geog 도 함께 갱신.
create or replace function memory_posts_sync_geom() returns trigger as $$
declare
  p_lat double precision;
  p_lng double precision;
begin
  if new.place_id is not null then
    select lat, lng into p_lat, p_lng from places where id = new.place_id;
    if p_lat is not null and p_lng is not null then
      new.geom := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
      new.geog := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;
-- 트리거 자체는 008에서 이미 등록됨; 함수만 교체하면 됨.

create index if not exists memory_posts_geog_gix on memory_posts using gist (geog);

-- ─── 누락 플레인 인덱스 ───────────────────────────────────────────────────────
create index if not exists memory_posts_user_id_idx    on memory_posts (user_id);
create index if not exists memory_posts_created_at_idx on memory_posts (created_at);
create index if not exists memory_posts_place_id_idx   on memory_posts (place_id);
