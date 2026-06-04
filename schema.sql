-- =====================================================================
--  Mentoria App — Esquema do banco de dados (Supabase / PostgreSQL)
--  Cole este arquivo no SQL Editor do Supabase e execute uma vez.
-- =====================================================================

-- ---------- CONTATOS --------------------------------------------------
create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  company     text,
  role        text,
  tags        text,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ---------- PROGRAMAS DE MENTORIA ------------------------------------
create table if not exists public.programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  contact_id  uuid references public.contacts(id) on delete set null,
  title       text not null,
  objective   text,
  description text,
  status      text not null default 'ativo',  -- ativo | pausado | concluido | cancelado
  start_date  date,
  end_date    date,
  total_value numeric(12,2) not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- ENCONTROS (+ observações) --------------------------------
create table if not exists public.meetings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  program_id   uuid not null references public.programs(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_min int not null default 60,
  topic        text,
  notes        text,                          -- observações do encontro
  status       text not null default 'agendado', -- agendado | realizado | cancelado | remarcado
  created_at   timestamptz not null default now()
);

-- ---------- AVALIAÇÕES DE PERFORMANCE --------------------------------
create table if not exists public.evaluations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  program_id    uuid not null references public.programs(id) on delete cascade,
  evaluated_at  date not null default current_date,
  period        text,                         -- ex.: "Mês 1", "Q1/2026"
  overall_score numeric(4,2),                 -- nota geral 0–10
  criteria      jsonb not null default '[]'::jsonb, -- [{"name":"Comunicação","score":8}]
  comments      text,
  created_at    timestamptz not null default now()
);

-- ---------- FATURAMENTO ----------------------------------------------
create table if not exists public.billings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  program_id  uuid references public.programs(id) on delete set null,
  description text,
  amount      numeric(12,2) not null default 0,
  due_date    date,
  paid_at     date,
  status      text not null default 'pendente', -- pendente | pago | atrasado | cancelado
  created_at  timestamptz not null default now()
);

-- ---------- ÍNDICES ---------------------------------------------------
create index if not exists idx_contacts_user    on public.contacts(user_id);
create index if not exists idx_programs_user     on public.programs(user_id);
create index if not exists idx_programs_contact  on public.programs(contact_id);
create index if not exists idx_meetings_program  on public.meetings(program_id);
create index if not exists idx_evals_program     on public.evaluations(program_id);
create index if not exists idx_billings_program  on public.billings(program_id);

-- =====================================================================
--  ROW LEVEL SECURITY  —  cada usuário só acessa os próprios registros
-- =====================================================================
alter table public.contacts    enable row level security;
alter table public.programs    enable row level security;
alter table public.meetings    enable row level security;
alter table public.evaluations enable row level security;
alter table public.billings    enable row level security;

-- Helper: gera as 4 políticas (select/insert/update/delete) por tabela.
-- Como o Supabase não tem "for all" com WITH CHECK em uma linha só de forma
-- portável, definimos uma policy permissiva por operação.

do $$
declare t text;
begin
  foreach t in array array['contacts','programs','meetings','evaluations','billings']
  loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s;', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$s;', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$s;', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$s;', t);

    execute format($f$create policy "%1$s_select" on public.%1$s
      for select using (auth.uid() = user_id);$f$, t);
    execute format($f$create policy "%1$s_insert" on public.%1$s
      for insert with check (auth.uid() = user_id);$f$, t);
    execute format($f$create policy "%1$s_update" on public.%1$s
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);$f$, t);
    execute format($f$create policy "%1$s_delete" on public.%1$s
      for delete using (auth.uid() = user_id);$f$, t);
  end loop;
end $$;
