create table if not exists post_actions (
  id text primary key,
  post_id text not null references memory_posts(id) on delete cascade,
  user_id text references users(id) on delete set null,
  actor_key text not null,
  action text not null,
  body text,
  created_at timestamptz not null default now()
);

create index if not exists post_actions_post_id_idx on post_actions(post_id);
create unique index if not exists post_actions_unique_toggle_idx
  on post_actions(post_id, actor_key, action)
  where action in ('echo', 'save', 'hide', 'report');
