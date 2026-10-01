-- Gestão Computum — V6
-- Calculistas são pessoas que executam cálculos, mas não precisam ter login.
-- Esta migração consolida a alteração que já foi aplicada manualmente no projeto.

create table if not exists public.calculistas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists calculistas_nome_unique
  on public.calculistas (lower(nome));

insert into public.calculistas (nome, ativo)
values
  ('Patrick', true),
  ('Ana Clara', true),
  ('Ericka', true)
on conflict ((lower(nome))) do update
set ativo = true,
    updated_at = now();

alter table public.calculistas enable row level security;

drop policy if exists "calculistas_authenticated_all"
  on public.calculistas;

create policy "calculistas_authenticated_all"
  on public.calculistas
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete
  on public.calculistas
  to authenticated;

-- A migração inicial apontava calculista_id para usuarios.
-- A regra definitiva é que calculista_id aponte para calculistas.
alter table public.solicitacoes
  drop constraint if exists solicitacoes_calculista_id_fkey;

alter table public.solicitacoes
  add constraint solicitacoes_calculista_id_fkey
  foreign key (calculista_id)
  references public.calculistas(id)
  on delete set null;
