create table if not exists users (
  id text primary key,
  email text not null unique,
  display_name text not null,
  handle text not null unique,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists places (
  id text primary key,
  name text not null,
  city text not null,
  subtitle text not null,
  lat double precision not null,
  lng double precision not null,
  map_x double precision not null,
  map_y double precision not null,
  intensity double precision not null,
  unlocked boolean not null default false,
  unlock_radius_meters integer not null default 200,
  upload_radius_meters integer not null default 120,
  created_at timestamptz not null default now()
);

create table if not exists memory_posts (
  id text primary key,
  mode text not null,
  user_id text references users(id) on delete set null,
  author_name text not null,
  author_handle text not null,
  place_id text references places(id) on delete set null,
  place_name text not null,
  city text not null,
  distance_meters integer not null,
  unlock_radius_meters integer not null,
  unlock_state text not null,
  visibility text not null,
  caption text not null,
  time_label text not null,
  film_stamp text not null,
  recall_label text,
  media_colors jsonb not null,
  media_url text,
  accent_color text not null,
  stats jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists check_in_tokens (
  id text primary key,
  user_id text references users(id) on delete set null,
  place_id text references places(id) on delete set null,
  place_name text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  uploads_remaining integer not null,
  unlock_radius_meters integer not null,
  created_at timestamptz not null default now()
);

create table if not exists timeline_months (
  id text primary key,
  title text not null,
  place_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists timeline_items (
  id text primary key,
  month_id text not null references timeline_months(id) on delete cascade,
  title text not null,
  meta text not null,
  unlocked boolean not null default false,
  sort_order integer not null default 0
);

create index if not exists memory_posts_mode_idx on memory_posts(mode);
create index if not exists memory_posts_place_name_idx on memory_posts(place_name);
create index if not exists sessions_user_id_idx on sessions(user_id);
create index if not exists check_in_tokens_user_id_idx on check_in_tokens(user_id);
