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

-- ═══ Community Study Guides ═══

create table if not exists community_guides (
  id uuid default gen_random_uuid() primary key,
  course_code text not null unique,
  course_name text not null default '',
  uploader_id uuid references auth.users(id) on delete set null,
  uploader_name text not null default 'Anonymous',
  card_count integer not null default 0,
  question_count integer not null default 0,
  unit_count integer not null default 0,
  guide_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_community_guides_course_code on community_guides(course_code);

alter table community_guides enable row level security;

-- Anyone can read community guides (even anonymous/anon key)
create policy "Anyone can read community guides"
  on community_guides for select
  using (true);

-- Authenticated users can share (insert) guides
create policy "Authenticated users can share guides"
  on community_guides for insert
  with check (auth.uid() = uploader_id);

-- Only the uploader can update their own guide
create policy "Uploader can update own guide"
  on community_guides for update
  using (auth.uid() = uploader_id);

-- Only the uploader can delete their own guide
create policy "Uploader can delete own guide"
  on community_guides for delete
  using (auth.uid() = uploader_id);

create trigger community_guides_updated_at
  before update on community_guides
  for each row
  execute function update_updated_at();
