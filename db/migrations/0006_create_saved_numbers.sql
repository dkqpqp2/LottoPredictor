create table if not exists saved_numbers (
  id bigserial primary key,
  user_id bigint not null references users(id),
  source varchar(20) not null,
  target_draw_no integer not null,
  num1 integer not null,
  num2 integer not null,
  num3 integer not null,
  num4 integer not null,
  num5 integer not null,
  num6 integer not null,
  saved_at timestamptz not null default now()
);
