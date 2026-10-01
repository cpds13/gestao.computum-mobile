-- Gestão Computum — V43 — ampliação dos Tipos de Serviço
-- Reexecução segura: cada inclusão usa NOT EXISTS e preserva os tipos existentes.

insert into public.tipos_servico (area_id, nome, ativo, ordem)
select
  a.id,
  v.nome,
  true,
  coalesce((select max(t.ordem) from public.tipos_servico t where t.area_id = a.id), 0)
    + row_number() over (partition by a.id order by v.posicao)
from public.areas_servico a
join (values
  ('Servidor Público', '1/3 de férias', 1),
  ('Servidor Público', 'Licença-prêmio', 2),
  ('Servidor Público', 'Valores devidos pela Administração Pública', 3),
  ('Saúde', 'Reajuste de plano de saúde', 1),
  ('Saúde', 'Danos morais', 2),
  ('Saúde', 'Danos materiais', 3)
) as v(area_nome, nome, posicao)
  on v.area_nome = a.nome
where not exists (
  select 1
  from public.tipos_servico t
  where t.area_id = a.id
    and lower(trim(t.nome)) = lower(trim(v.nome))
);
