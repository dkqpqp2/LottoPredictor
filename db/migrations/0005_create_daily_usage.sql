create table if not exists daily_usage (
  id bigserial primary key,
  user_id bigint not null references users(id),
  usage_date date not null,
  feature varchar(20) not null,
  count integer not null default 0,
  unique (user_id, usage_date, feature)
);
