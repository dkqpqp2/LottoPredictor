create table if not exists lotto_draws (
  draw_no integer primary key,
  draw_date date not null,
  num1 smallint not null,
  num2 smallint not null,
  num3 smallint not null,
  num4 smallint not null,
  num5 smallint not null,
  num6 smallint not null,
  bonus_num smallint not null,
  created_at timestamptz not null default now()
);
