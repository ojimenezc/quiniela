create extension if not exists "pgcrypto";

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  pin text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  stage text not null,
  group_name text,
  home_team text not null,
  away_team text not null,
  starts_at timestamptz not null,
  home_score integer,
  away_score integer,
  status text not null default 'scheduled' check (status in ('scheduled', 'finished')),
  created_at timestamptz not null default now()
);

create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  home_score integer not null check (home_score >= 0),
  away_score integer not null check (away_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, match_id)
);

create index if not exists predictions_participant_id_idx on predictions(participant_id);
create index if not exists predictions_match_id_idx on predictions(match_id);
create index if not exists matches_starts_at_idx on matches(starts_at);

create or replace function prevent_late_prediction()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from matches
    where matches.id = new.match_id
      and (
        matches.starts_at <= now()
        or matches.status = 'finished'
      )
  ) then
    raise exception 'No se pueden guardar predicciones después de iniciado o cerrado el partido.';
  end if;

  return new;
end;
$$;

drop trigger if exists predictions_lock_after_kickoff on predictions;
create trigger predictions_lock_after_kickoff
before insert or update on predictions
for each row
execute function prevent_late_prediction();

alter table participants enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;

create policy "participants can be read by app"
  on participants for select
  using (true);

create policy "participants can register"
  on participants for insert
  with check (is_admin = false);

create policy "matches can be read by app"
  on matches for select
  using (true);

create policy "matches can be updated by app admin screen"
  on matches for update
  using (true)
  with check (true);

create policy "predictions can be read by app"
  on predictions for select
  using (true);

create policy "predictions can be inserted"
  on predictions for insert
  with check (true);

create policy "predictions can be updated"
  on predictions for update
  using (true)
  with check (true);

insert into matches (stage, group_name, home_team, away_team, starts_at)
values
  ('Grupos', 'A', 'México', 'Sudáfrica', '2026-06-11 19:00:00+00'),
  ('Grupos', 'A', 'Canadá', 'Qatar', '2026-06-12 00:00:00+00'),
  ('Grupos', 'B', 'Estados Unidos', 'Ghana', '2026-06-12 19:00:00+00')
on conflict do nothing;

insert into participants (name, pin, is_admin)
values ('Admin', '0000', true)
on conflict (name) do nothing;
