create table notification_log (
  id uuid primary key default gen_random_uuid(),
  routine_item_id uuid not null references routine_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  occurrence_date date not null,
  sent_at timestamptz not null default now(),
  unique (routine_item_id, user_id, occurrence_date)
);

alter table notification_log enable row level security;

create policy "select own notification log"
on notification_log for select
using (user_id = auth.uid());

alter table push_subscriptions
  add constraint push_subscriptions_user_id_key unique (user_id);
