create table if not exists follows (
  follower_id text not null references users(id) on delete cascade,
  following_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_check check (follower_id <> following_id)
);

create index if not exists follows_following_id_idx on follows(following_id);
create index if not exists follows_created_at_idx on follows(created_at desc);
