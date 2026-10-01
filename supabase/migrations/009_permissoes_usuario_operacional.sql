-- Gestão Computum — V46 (migração histórica, já aplicada)
-- Permissões do perfil Usuário (antigo administrativo) e proteção operacional.
-- Usuário pode criar/visualizar solicitações e atribuí-las a calculistas,
-- mas não pode editar/excluir solicitações ou executar rotinas administrativas.

create or replace function public.usuario_perfil_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select perfil
  from public.usuarios
  where id = auth.uid()
    and ativo = true
  limit 1;
$$;

grant execute on function public.usuario_perfil_atual() to authenticated;

create or replace function public.proteger_solicitacao_por_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  perfil_atual text;
  antiga jsonb;
  nova jsonb;
begin
  perfil_atual := public.usuario_perfil_atual();

  if perfil_atual = 'administrador' then
    return coalesce(new, old);
  end if;

  if perfil_atual = 'administrativo' then
    if tg_op = 'DELETE' then
      raise exception 'Usuário não pode excluir solicitações.' using errcode = '42501';
    end if;

    antiga := to_jsonb(old) - 'calculista_id' - 'updated_at';
    nova := to_jsonb(new) - 'calculista_id' - 'updated_at';

    if antiga <> nova then
      raise exception 'Usuário pode apenas atribuir ou remover o calculista responsável.' using errcode = '42501';
    end if;

    return new;
  end if;

  if perfil_atual = 'calculista' then
    return new;
  end if;

  raise exception 'Usuário sem permissão para alterar solicitações.' using errcode = '42501';
end;
$$;

drop trigger if exists trg_proteger_solicitacao_por_perfil on public.solicitacoes;
create trigger trg_proteger_solicitacao_por_perfil
before update or delete on public.solicitacoes
for each row execute function public.proteger_solicitacao_por_perfil();

-- A exclusão direta continua sendo possível somente para administradores.
drop policy if exists "authenticated users can manage solicitacoes" on public.solicitacoes;
drop policy if exists "authenticated users can read solicitacoes" on public.solicitacoes;
drop policy if exists "authenticated users can insert solicitacoes" on public.solicitacoes;
drop policy if exists "authenticated users can update solicitacoes" on public.solicitacoes;
drop policy if exists "administrators can delete solicitacoes" on public.solicitacoes;

create policy "authenticated users can read solicitacoes"
  on public.solicitacoes
  for select
  to authenticated
  using (true);

create policy "authenticated users can insert solicitacoes"
  on public.solicitacoes
  for insert
  to authenticated
  with check (true);

create policy "authenticated users can update solicitacoes"
  on public.solicitacoes
  for update
  to authenticated
  using (true)
  with check (true);

create policy "administrators can delete solicitacoes"
  on public.solicitacoes
  for delete
  to authenticated
  using (public.usuario_eh_administrador(auth.uid()));

