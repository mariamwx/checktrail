-- Category 3 — Feud (schema folder: category_three)
-- Classic + Funny multiple-choice decks. Anonymous option tallies.
-- Winner = most majority answers.

create schema if not exists category_three;
comment on schema category_three is 'Category 3 — Feud multiple-choice survey game';

grant usage on schema category_three to anon, authenticated, service_role;

create table if not exists category_three.rooms (
  code text primary key,
  host_id text not null,
  phase text not null default 'lobby' check (phase in ('lobby', 'playing', 'results')),
  question_count int not null default 10,
  deck_version text not null default 'classic'
    check (deck_version in ('classic', 'funny')),
  question_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists category_three.players (
  id text primary key,
  room_id text not null references category_three.rooms(code) on delete cascade,
  name text not null,
  is_host boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists category_three.question_bank (
  id text primary key,
  prompt text not null,
  theme text not null default '',
  answers text[] not null,
  sort_order int not null default 0,
  version text not null default 'classic'
    check (version in ('classic', 'funny'))
);

create table if not exists category_three.votes (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references category_three.rooms(code) on delete cascade,
  question_id text not null references category_three.question_bank(id),
  voter_id text not null,
  choice_index int not null check (choice_index between 0 and 3),
  created_at timestamptz not null default now(),
  unique (room_id, question_id, voter_id)
);

alter table category_three.rooms enable row level security;
alter table category_three.players enable row level security;
alter table category_three.question_bank enable row level security;
alter table category_three.votes enable row level security;

drop policy if exists "c3 read rooms" on category_three.rooms;
drop policy if exists "c3 insert rooms" on category_three.rooms;
drop policy if exists "c3 update rooms" on category_three.rooms;
create policy "c3 read rooms" on category_three.rooms for select using (true);
create policy "c3 insert rooms" on category_three.rooms for insert with check (true);
create policy "c3 update rooms" on category_three.rooms for update using (true);

drop policy if exists "c3 read players" on category_three.players;
drop policy if exists "c3 insert players" on category_three.players;
drop policy if exists "c3 update players" on category_three.players;
drop policy if exists "c3 delete players" on category_three.players;
create policy "c3 read players" on category_three.players for select using (true);
create policy "c3 insert players" on category_three.players for insert with check (true);
create policy "c3 update players" on category_three.players for update using (true);
create policy "c3 delete players" on category_three.players for delete using (true);

drop policy if exists "c3 read questions" on category_three.question_bank;
drop policy if exists "c3 insert questions" on category_three.question_bank;
drop policy if exists "c3 update questions" on category_three.question_bank;
create policy "c3 read questions" on category_three.question_bank for select using (true);
create policy "c3 insert questions" on category_three.question_bank for insert with check (true);
create policy "c3 update questions" on category_three.question_bank for update using (true);

drop policy if exists "c3 read votes" on category_three.votes;
drop policy if exists "c3 insert votes" on category_three.votes;
drop policy if exists "c3 update votes" on category_three.votes;
create policy "c3 read votes" on category_three.votes for select using (true);
create policy "c3 insert votes" on category_three.votes for insert with check (true);
create policy "c3 update votes" on category_three.votes for update using (true);

grant all on all tables in schema category_three to anon, authenticated, service_role;
grant all on all sequences in schema category_three to anon, authenticated, service_role;

alter publication supabase_realtime add table category_three.rooms;
alter publication supabase_realtime add table category_three.players;
alter publication supabase_realtime add table category_three.votes;
