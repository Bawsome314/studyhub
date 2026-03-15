-- StudyHub Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database.

-- Key-value store for all user data
create table if not exists user_data (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  key text not null,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique(user_id, key)
);

-- Index for fast lookups by user
create index if not exists idx_user_data_user_id on user_data(user_id);
create index if not exists idx_user_data_user_key on user_data(user_id, key);

-- Enable RLS
alter table user_data enable row level security;

-- Users can only access their own data
create policy "Users can read own data"
  on user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert own data"
  on user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on user_data for update
  using (auth.uid() = user_id);

create policy "Users can delete own data"
  on user_data for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at on changes
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_data_updated_at
  before update on user_data
  for each row
  execute function update_updated_at();
