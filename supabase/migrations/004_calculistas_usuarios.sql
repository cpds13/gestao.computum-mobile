-- Gestão Computum — V23
-- Vincula o cadastro operacional de calculista ao usuário autenticado.
-- O vínculo permite que um mesmo usuário exerça as funções de Administrador e Calculista.

alter table public.calculistas
  add column if not exists usuario_id uuid references public.usuarios(id) on delete set null;

create unique index if not exists calculistas_usuario_unique
  on public.calculistas(usuario_id)
  where usuario_id is not null;

-- Faz o vínculo inicial por nome para os cadastros já existentes.
update public.calculistas c
set usuario_id = u.id,
    updated_at = now()
from public.usuarios u
where lower(trim(c.nome)) = lower(trim(u.nome))
  and c.usuario_id is null
  and c.ativo = true
  and u.ativo = true;

comment on column public.calculistas.usuario_id is
  'Usuário autenticado que exerce a função de calculista. Permite acumular a função de administrador.';
