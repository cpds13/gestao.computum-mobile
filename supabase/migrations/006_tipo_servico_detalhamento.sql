-- Gestão Computum — V36 — detalhamento do Tipo de Serviço
-- Reexecução segura: a coluna e os tipos abaixo usam IF NOT EXISTS / DROP CONSTRAINT.

alter table public.solicitacoes
  add column if not exists tipo_servico_outro text;

alter table public.solicitacoes
  drop constraint if exists solicitacoes_tipo_servico_outro_max_length;

alter table public.solicitacoes
  add constraint solicitacoes_tipo_servico_outro_max_length
  check (
    tipo_servico_outro is null
    or char_length(tipo_servico_outro) <= 100
  );

insert into public.tipos_servico (area_id, nome, ativo, ordem)
select
  a.id,
  'Rest. acima TETO',
  true,
  coalesce(
    (
      select max(t.ordem)
      from public.tipos_servico t
      where t.area_id = a.id
    ),
    0
  ) + 1
from public.areas_servico a
where a.nome = 'Tributário'
  and not exists (
    select 1
    from public.tipos_servico t
    where t.area_id = a.id
      and lower(t.nome) = lower('Rest. acima TETO')
  );

insert into public.tipos_servico (area_id, nome, ativo, ordem)
select
  a.id,
  'Recomposição IR',
  true,
  coalesce(
    (
      select max(t.ordem)
      from public.tipos_servico t
      where t.area_id = a.id
    ),
    0
  ) + 1
from public.areas_servico a
where a.nome = 'Tributário'
  and not exists (
    select 1
    from public.tipos_servico t
    where t.area_id = a.id
      and lower(t.nome) = lower('Recomposição IR')
  );
