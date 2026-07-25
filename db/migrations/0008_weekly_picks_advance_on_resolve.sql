alter table weekly_picks
  add column id bigserial;

alter table weekly_picks
  drop constraint weekly_picks_pkey,
  add primary key (id);

alter table weekly_picks
  add constraint weekly_picks_target_draw_no_key unique (target_draw_no);
