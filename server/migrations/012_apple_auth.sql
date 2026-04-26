-- Apple Sign-In 지원: users 테이블에 apple_user_id 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_user_id text UNIQUE;
