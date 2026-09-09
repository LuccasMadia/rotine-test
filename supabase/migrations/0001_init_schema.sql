create extension if not exists pgcrypto;

-- Couples: links two auth users together
create table couples (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  cor text not null default '#6366f1',
  icone text not null default 'circle',
  created_at timestamptz not null default now()
);

create table routine_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  titulo text not null,
  notas text,
  prioridade text not null default 'media' check (prioridade in ('alta', 'media', 'baixa')),
  data_inicio date not null,
  horario time not null,
  is_shared boolean not null default false,
  recurrence_rule jsonb not null default '{"type":"none"}'::jsonb,
  recurrence_end jsonb,
  created_at timestamptz not null default now()
);

create table item_completions (
  id uuid primary key default gen_random_uuid(),
  routine_item_id uuid not null references routine_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null,
  completed_at timestamptz not null default now(),
  unique (routine_item_id, user_id, data)
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_json jsonb not null,
  created_at timestamptz not null default now()
);

-- Returns the partner's user id for a given user, if they're in a couple.
create or replace function partner_id(uid uuid)
returns uuid
language sql
stable
as $$
  select case
    when user_a = uid then user_b
    when user_b = uid then user_a
    else null
  end
  from couples
  where user_a = uid or user_b = uid
  limit 1;
$$;

-- couples
alter table couples enable row level security;

create policy "select own or joinable couples"
on couples for select
using (user_a = auth.uid() or user_b = auth.uid() or user_b is null);

create policy "insert own couple"
on couples for insert
with check (user_a = auth.uid());

create policy "join couple"
on couples for update
using (user_b is null and user_a <> auth.uid())
with check (user_b = auth.uid());

-- categories
alter table categories enable row level security;

create policy "select own categories"
on categories for select
using (user_id = auth.uid());

create policy "insert own categories"
on categories for insert
with check (user_id = auth.uid());

create policy "update own categories"
on categories for update
using (user_id = auth.uid());

create policy "delete own categories"
on categories for delete
using (user_id = auth.uid());

-- routine_items
alter table routine_items enable row level security;

create policy "select own or shared with partner"
on routine_items for select
using (
  user_id = auth.uid()
  or (is_shared = true and user_id = partner_id(auth.uid()))
);

create policy "insert own items"
on routine_items for insert
with check (user_id = auth.uid());

create policy "update own or shared items"
on routine_items for update
using (
  user_id = auth.uid()
  or (is_shared = true and user_id = partner_id(auth.uid()))
);

create policy "delete own or shared items"
on routine_items for delete
using (
  user_id = auth.uid()
  or (is_shared = true and user_id = partner_id(auth.uid()))
);

-- item_completions
alter table item_completions enable row level security;

create policy "select own or shared item completions"
on item_completions for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from routine_items ri
    where ri.id = item_completions.routine_item_id
      and ri.is_shared = true
      and (ri.user_id = auth.uid() or ri.user_id = partner_id(auth.uid()))
  )
);

create policy "insert own completions"
on item_completions for insert
with check (user_id = auth.uid());

create policy "delete own completions"
on item_completions for delete
using (user_id = auth.uid());

-- push_subscriptions
alter table push_subscriptions enable row level security;

create policy "manage own subscriptions"
on push_subscriptions for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
