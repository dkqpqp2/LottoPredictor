alter table users
  add column total_points integer not null default 0,
  add column current_streak integer not null default 0,
  add column last_active_date date;
