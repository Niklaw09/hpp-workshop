-- High Point Perspective · Live Workshop prototype schema
-- Run once in your Supabase project (Bolt.new applies files in supabase/migrations
-- automatically when Supabase is connected; otherwise paste into the SQL Editor).
--
-- Security model
--  • Anyone with the anon key can READ a workshop's live state and poll tallies
--    (that's what audience phones subscribe to).
--  • All WRITES go through SECURITY DEFINER functions below.
--  • Presenter changes require the presenter key; only its SHA-256 hash is stored,
--    in a table nobody can read.
--  • First names and individual votes are never readable by clients.

create table if not exists public.workshops (
  code        text primary key,
  title       text not null check (char_length(title) between 1 and 120),
  state       jsonb not null default '{}'::jsonb,
  version     bigint not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.workshop_secrets (
  code      text primary key references public.workshops(code) on delete cascade,
  key_hash  text not null
);

create table if not exists public.participants (
  id             uuid primary key default gen_random_uuid(),
  workshop_code  text not null references public.workshops(code) on delete cascade,
  first_name     text not null check (char_length(first_name) between 1 and 40),
  joined_at      timestamptz not null default now()
);
create index if not exists participants_workshop_idx on public.participants (workshop_code);

create table if not exists public.poll_votes (
  workshop_code   text not null references public.workshops(code) on delete cascade,
  poll_id         text not null,
  participant_id  uuid not null references public.participants(id) on delete cascade,
  option_index    int  not null check (option_index between 0 and 19),
  updated_at      timestamptz not null default now(),
  primary key (workshop_code, poll_id, participant_id)
);

-- Aggregated counts, the only vote data clients can see. counts = {"0": 4, "1": 7, ...}
create table if not exists public.poll_tallies (
  workshop_code  text not null references public.workshops(code) on delete cascade,
  poll_id        text not null,
  counts         jsonb not null default '{}'::jsonb,
  total          int not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (workshop_code, poll_id)
);

alter table public.workshops        enable row level security;
alter table public.workshop_secrets enable row level security;
alter table public.participants     enable row level security;
alter table public.poll_votes       enable row level security;
alter table public.poll_tallies     enable row level security;

drop policy if exists "workshops are readable" on public.workshops;
create policy "workshops are readable" on public.workshops for select to anon, authenticated using (true);
drop policy if exists "tallies are readable" on public.poll_tallies;
create policy "tallies are readable" on public.poll_tallies for select to anon, authenticated using (true);
-- No policies on workshop_secrets, participants, poll_votes: clients cannot touch them directly.

-- ── Helpers ─────────────────────────────────────────────────────────────
create or replace function public._hash_key(p_key text) returns text
language sql immutable as $$ select encode(sha256(convert_to(p_key, 'UTF8')), 'hex') $$;

create or replace function public._check_presenter(p_code text, p_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_key is null or not exists (
    select 1 from workshop_secrets where code = p_code and key_hash = _hash_key(p_key)
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
end $$;

-- ── Presenter ───────────────────────────────────────────────────────────
create or replace function public.create_workshop(p_title text, p_key text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  i int;
begin
  if p_key is null or char_length(p_key) < 24 then
    raise exception 'Presenter key too short';
  end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * char_length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from workshops where code = v_code);
  end loop;
  insert into workshops (code, title) values (v_code, coalesce(nullif(trim(p_title), ''), 'Live workshop'));
  insert into workshop_secrets (code, key_hash) values (v_code, _hash_key(p_key));
  return v_code;
end $$;

create or replace function public.verify_presenter(p_code text, p_key text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from workshop_secrets where code = p_code and key_hash = _hash_key(p_key))
$$;

-- Merges p_patch into state (so two presenter devices don't wipe each other's fields).
create or replace function public.presenter_update(p_code text, p_key text, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_row workshops;
begin
  perform _check_presenter(p_code, p_key);
  if jsonb_typeof(p_patch) <> 'object' or octet_length(p_patch::text) > 8000 then
    raise exception 'Invalid patch';
  end if;
  update workshops
     set state = state || p_patch, version = version + 1, updated_at = now()
   where code = p_code
  returning * into v_row;
  return jsonb_build_object('code', v_row.code, 'title', v_row.title, 'state', v_row.state, 'version', v_row.version);
end $$;

-- ── Audience ────────────────────────────────────────────────────────────
create or replace function public.join_workshop(p_code text, p_first_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text := left(trim(coalesce(p_first_name, '')), 40);
begin
  if v_name = '' then raise exception 'First name is required'; end if;
  if not exists (select 1 from workshops where code = p_code) then
    raise exception 'Workshop not found. Check the code and try again.';
  end if;
  insert into participants (workshop_code, first_name) values (p_code, v_name) returning id into v_id;
  return v_id;
end $$;

create or replace function public.cast_vote(p_code text, p_poll_id text, p_participant_id uuid, p_option int) returns void
language plpgsql security definer set search_path = public as $$
declare v_counts jsonb; v_total int;
begin
  if not exists (select 1 from workshops where code = p_code and state->>'activePollId' = p_poll_id) then
    raise exception 'This poll is closed.';
  end if;
  if not exists (select 1 from participants where id = p_participant_id and workshop_code = p_code) then
    raise exception 'Please rejoin the workshop.';
  end if;

  -- Lock this poll's tally row so concurrent votes recount in order.
  insert into poll_tallies (workshop_code, poll_id) values (p_code, p_poll_id) on conflict do nothing;
  perform 1 from poll_tallies where workshop_code = p_code and poll_id = p_poll_id for update;

  insert into poll_votes (workshop_code, poll_id, participant_id, option_index)
  values (p_code, p_poll_id, p_participant_id, p_option)
  on conflict (workshop_code, poll_id, participant_id)
  do update set option_index = excluded.option_index, updated_at = now();

  select coalesce(jsonb_object_agg(option_index::text, n), '{}'::jsonb), coalesce(sum(n), 0)
    into v_counts, v_total
    from (select option_index, count(*)::int as n from poll_votes
           where workshop_code = p_code and poll_id = p_poll_id group by option_index) s;

  update poll_tallies set counts = v_counts, total = v_total, updated_at = now()
   where workshop_code = p_code and poll_id = p_poll_id;
end $$;

create or replace function public.get_my_vote(p_code text, p_poll_id text, p_participant_id uuid) returns int
language sql security definer set search_path = public as $$
  select option_index from poll_votes
   where workshop_code = p_code and poll_id = p_poll_id and participant_id = p_participant_id
$$;

-- ── Permissions ─────────────────────────────────────────────────────────
revoke all on function public._check_presenter(text, text) from public, anon, authenticated;
revoke all on function public._hash_key(text) from public, anon, authenticated;
grant execute on function public.create_workshop(text, text)            to anon, authenticated;
grant execute on function public.verify_presenter(text, text)           to anon, authenticated;
grant execute on function public.presenter_update(text, text, jsonb)    to anon, authenticated;
grant execute on function public.join_workshop(text, text)              to anon, authenticated;
grant execute on function public.cast_vote(text, text, uuid, int)       to anon, authenticated;
grant execute on function public.get_my_vote(text, text, uuid)          to anon, authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'workshops') then
      alter publication supabase_realtime add table public.workshops;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'poll_tallies') then
      alter publication supabase_realtime add table public.poll_tallies;
    end if;
  end if;
end $$;
