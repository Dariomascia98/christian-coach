-- MISURA — schema Supabase
-- Incolla tutto questo script nell'SQL Editor di Supabase ed esegui "Run".

create extension if not exists "pgcrypto";

-- ---------- Tabelle ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  username text not null unique,
  role text not null check (role in ('trainer','client')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table public.programs (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{"days":[]}'::jsonb,
  updated_at timestamptz default now()
);

create table public.progress (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

create table public.loads (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table public.exercise_library (
  trainer_id uuid primary key references public.profiles(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- ---------- Row Level Security ----------
-- Un cliente vede solo i propri dati. Un trainer vede i propri dati e quelli
-- dei clienti che ha creato lui (created_by). Le funzioni serverless in /api
-- usano la service role key e bypassano queste regole quando serve
-- (creazione/eliminazione account), tutto il resto passa da qui.

alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.progress enable row level security;
alter table public.loads enable row level security;
alter table public.exercise_library enable row level security;

create policy "profiles_select" on public.profiles for select
  using (auth.uid() = id or created_by = auth.uid());

create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id);

create policy "programs_rw" on public.programs for all
  using (
    auth.uid() = client_id
    or exists (select 1 from public.profiles p where p.id = client_id and p.created_by = auth.uid())
  )
  with check (
    auth.uid() = client_id
    or exists (select 1 from public.profiles p where p.id = client_id and p.created_by = auth.uid())
  );

create policy "progress_rw" on public.progress for all
  using (
    auth.uid() = client_id
    or exists (select 1 from public.profiles p where p.id = client_id and p.created_by = auth.uid())
  )
  with check (
    auth.uid() = client_id
    or exists (select 1 from public.profiles p where p.id = client_id and p.created_by = auth.uid())
  );

create policy "loads_rw" on public.loads for all
  using (
    auth.uid() = client_id
    or exists (select 1 from public.profiles p where p.id = client_id and p.created_by = auth.uid())
  )
  with check (
    auth.uid() = client_id
    or exists (select 1 from public.profiles p where p.id = client_id and p.created_by = auth.uid())
  );

create policy "library_rw" on public.exercise_library for all
  using (auth.uid() = trainer_id)
  with check (auth.uid() = trainer_id);
