create or replace function prevent_late_prediction()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from matches
    where matches.id = new.match_id
      and matches.starts_at <= now()
  ) then
    raise exception 'No se pueden guardar predicciones después de iniciado el partido.';
  end if;

  return new;
end;
$$;

drop trigger if exists predictions_lock_after_kickoff on predictions;
create trigger predictions_lock_after_kickoff
before insert or update on predictions
for each row
execute function prevent_late_prediction();
