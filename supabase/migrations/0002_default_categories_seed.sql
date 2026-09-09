-- Fix recurrence_rule default to match the app's RecurrenceRule shape.
alter table routine_items
  alter column recurrence_rule set default '{"type":"once"}'::jsonb;

-- Fix recurrence_end default to match the app's RecurrenceEnd shape.
alter table routine_items
  alter column recurrence_end set default '{"type":"never"}'::jsonb;

-- Seed 4 default categories for every new auth user.
create or replace function seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, nome, cor, icone) values
    (new.id, 'Treino/Saúde', '#22c55e', 'dumbbell'),
    (new.id, 'Estudos', '#3b82f6', 'book'),
    (new.id, 'Trabalho', '#f59e0b', 'briefcase'),
    (new.id, 'Lazer', '#a855f7', 'smile');
  return new;
end;
$$;

create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute function seed_default_categories();
