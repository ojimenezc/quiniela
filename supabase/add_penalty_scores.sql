alter table matches add column if not exists home_penalty_score integer check (home_penalty_score >= 0);
alter table matches add column if not exists away_penalty_score integer check (away_penalty_score >= 0);

alter table predictions add column if not exists home_penalty_score integer check (home_penalty_score >= 0);
alter table predictions add column if not exists away_penalty_score integer check (away_penalty_score >= 0);
