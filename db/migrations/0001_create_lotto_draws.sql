create table if not exists lotto_draws (
  draw_no integer primary key,
  draw_date date not null,
  num1 integer not null,
  num2 integer not null,
  num3 integer not null,
  num4 integer not null,
  num5 integer not null,
  num6 integer not null,
  bonus_num integer not null,
  created_at timestamptz not null default now()
);
