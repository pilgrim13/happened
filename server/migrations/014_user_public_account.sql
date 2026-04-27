-- 014_user_public_account.sql
-- Sprint 6D: 전체 공개 계정 플래그 추가
-- is_public_account = true 인 계정의 글은 팔로잉 여부와 무관하게 홈 피드에 노출됨

alter table users add column if not exists is_public_account boolean not null default false;
