create table if not exists tarot_interpretations (
  id bigserial primary key,
  user_id bigint not null references users(id),
  mode varchar(20) not null,
  cards_json text not null,
  zodiac varchar(20),
  interpretation_text text not null,
  created_at timestamptz not null default now()
);
