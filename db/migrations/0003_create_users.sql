create table if not exists users (
  id bigserial primary key,
  kakao_id bigint not null unique,
  nickname varchar(80) not null,
  created_at timestamptz not null default now()
);
