-- S3 sprint: session metadata, email verification & password reset tokens, post media table.

-- Session metadata for "active sessions" view + revocation accounting.
alter table sessions add column if not exists user_agent text;
alter table sessions add column if not exists ip text;
alter table sessions add column if not exists last_seen_at timestamptz;
alter table sessions add column if not exists revoked_at timestamptz;
create index if not exists sessions_user_active_idx on sessions(user_id, revoked_at, expires_at);

-- User-level flags for verification.
alter table users add column if not exists email_verified_at timestamptz;

-- Email verification tokens (1-time use, hashed).
create table if not exists email_verification_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists evt_user_idx on email_verification_tokens(user_id);
create index if not exists evt_token_hash_idx on email_verification_tokens(token_hash);

-- Password reset tokens (1-time use, hashed).
create table if not exists password_reset_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists prt_user_idx on password_reset_tokens(user_id);
create index if not exists prt_token_hash_idx on password_reset_tokens(token_hash);

-- Post media (presigned upload flow). Decoupled from memory_posts.media_url.
create table if not exists post_media (
  id text primary key,
  post_id text not null references memory_posts(id) on delete cascade,
  user_id text references users(id) on delete set null,
  media_key text not null,
  public_url text not null,
  content_type text,
  kind text not null default 'photo',
  byte_size bigint,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists post_media_post_idx on post_media(post_id);
create index if not exists post_media_user_idx on post_media(user_id);
