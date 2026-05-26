alter table matches
  drop constraint if exists matches_home_score_max_15,
  drop constraint if exists matches_away_score_max_15;

alter table predictions
  drop constraint if exists predictions_home_score_max_15,
  drop constraint if exists predictions_away_score_max_15;

alter table matches
  add constraint matches_home_score_max_15 check (home_score is null or (home_score >= 0 and home_score <= 15)),
  add constraint matches_away_score_max_15 check (away_score is null or (away_score >= 0 and away_score <= 15));

alter table predictions
  add constraint predictions_home_score_max_15 check (home_score >= 0 and home_score <= 15),
  add constraint predictions_away_score_max_15 check (away_score >= 0 and away_score <= 15);
