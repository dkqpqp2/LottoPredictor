create table if not exists pension_draws (
  draw_no integer primary key,
  draw_date date not null,
  group_no integer not null,
  number varchar(6) not null,
  bonus_number varchar(6) not null,
  created_at timestamptz not null default now()
);
