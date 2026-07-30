create table if not exists pension_saved_numbers (
  id bigserial primary key,
  user_id bigint not null references users(id),
  target_draw_no integer not null,
  group_no integer not null,
  number varchar(6) not null,
  saved_at timestamptz not null
);
