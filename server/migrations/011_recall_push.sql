-- 011_recall_push.sql
-- Sprint 5A: push_tokens, recall_events 테이블 추가, users 에 push_opt_in_at 컬럼 추가.

-- ─── users 알림 환경설정 ──────────────────────────────────────────────────────
alter table users
  add column if not exists push_opt_in_at timestamptz;

-- ─── push_tokens ─────────────────────────────────────────────────────────────
create table if not exists push_tokens (
  id           text primary key,
  user_id      text not null references users(id) on delete cascade,
  token        text not null,
  platform     text not null check (platform in ('ios', 'android', 'web')),
  opt_in_at    timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists push_tokens_user_id_idx on push_tokens (user_id);

-- ─── recall_events ───────────────────────────────────────────────────────────
create table if not exists recall_events (
  id             text primary key,
  user_id        text not null references users(id) on delete cascade,
  kind           text not null check (kind in ('anniversary', 'proximity')),
  source_post_id text references memory_posts(id) on delete cascade,
  place_id       text references places(id) on delete set null,
  scheduled_for  timestamptz not null,
  delivered_at   timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists recall_events_user_scheduled_idx on recall_events (user_id, scheduled_for);
create index if not exists recall_events_delivered_at_idx   on recall_events (delivered_at);
