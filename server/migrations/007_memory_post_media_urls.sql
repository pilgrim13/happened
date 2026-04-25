alter table memory_posts
  add column if not exists media_urls jsonb not null default '[]'::jsonb;

update memory_posts
set media_urls = jsonb_build_array(media_url)
where media_url is not null
  and jsonb_array_length(media_urls) = 0;
