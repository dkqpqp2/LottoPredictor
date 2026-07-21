create table if not exists weekly_picks (
  week_start date primary key,
  target_draw_no integer not null,
  num1 integer not null,
  num2 integer not null,
  num3 integer not null,
  num4 integer not null,
  num5 integer not null,
  num6 integer not null,
  mode varchar(20) not null,
  created_at timestamptz not null default now()
);
