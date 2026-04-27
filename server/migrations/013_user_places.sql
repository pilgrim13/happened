-- 013_user_places.sql
-- places 테이블에 사용자 생성 장소 추적용 created_by_user_id 컬럼 추가
-- 기존 시드 장소는 NULL로 유지됨

ALTER TABLE places ADD COLUMN IF NOT EXISTS created_by_user_id text REFERENCES users(id);
