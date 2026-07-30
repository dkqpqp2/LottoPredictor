create table if not exists pension_weekly_picks (
  id bigserial primary key,
  week_start date not null,
  target_draw_no integer not null unique,
  group_no integer not null,
  number varchar(6) not null,
  created_at timestamptz not null default now()
);
