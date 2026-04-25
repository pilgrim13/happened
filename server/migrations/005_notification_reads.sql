create table if not exists notification_reads (
  user_id text not null references users(id) on delete cascade,
  notification_id text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

create index if not exists notification_reads_read_at_idx on notification_reads(read_at desc);
