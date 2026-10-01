-- Gestão Computum V51
-- Perfil Usuário: acesso de consulta aos painéis operacionais, sem edição.
-- Escopo: advogados, clientes, processos e calculistas. Relatórios são somente leitura.

-- Leitura para usuários autenticados permanece permitida.
-- Alterações nessas tabelas ficam restritas ao administrador.

-- ADVOGADOS
drop policy if exists "authenticated users can manage advogados" on public.advogados;
drop policy if exists "authenticated users can read advogados" on public.advogados;
drop policy if exists "administrators can insert advogados" on public.advogados;
drop policy if exists "administrators can update advogados" on public.advogados;
drop policy if exists "administrators can delete advogados" on public.advogados;

create policy "authenticated users can read advogados"
  on public.advogados for select to authenticated using (true);
create policy "administrators can insert advogados"
  on public.advogados for insert to authenticated
  with check (public.usuario_eh_administrador(auth.uid()));
create policy "administrators can update advogados"
  on public.advogados for update to authenticated
  using (public.usuario_eh_administrador(auth.uid()))
  with check (public.usuario_eh_administrador(auth.uid()));
create policy "administrators can delete advogados"
  on public.advogados for delete to authenticated
  using (public.usuario_eh_administrador(auth.uid()));

-- CLIENTES
drop policy if exists "authenticated users can manage clientes" on public.clientes;
drop policy if exists "authenticated users can read clientes" on public.clientes;
drop policy if exists "administrators can insert clientes" on public.clientes;
drop policy if exists "administrators can update clientes" on public.clientes;
drop policy if exists "administrators can delete clientes" on public.clientes;

create policy "authenticated users can read clientes"
  on public.clientes for select to authenticated using (true);
create policy "administrators can insert clientes"
  on public.clientes for insert to authenticated
  with check (public.usuario_eh_administrador(auth.uid()));
create policy "administrators can update clientes"
  on public.clientes for update to authenticated
  using (public.usuario_eh_administrador(auth.uid()))
  with check (public.usuario_eh_administrador(auth.uid()));
create policy "administrators can delete clientes"
  on public.clientes for delete to authenticated
  using (public.usuario_eh_administrador(auth.uid()));

-- PROCESSOS
drop policy if exists "authenticated users can manage processos" on public.processos;
drop policy if exists "authenticated users can read processos" on public.processos;
drop policy if exists "administrators can insert processos" on public.processos;
drop policy if exists "administrators can update processos" on public.processos;
drop policy if exists "administrators can delete processos" on public.processos;

create policy "authenticated users can read processos"
  on public.processos for select to authenticated using (true);
create policy "administrators can insert processos"
  on public.processos for insert to authenticated
  with check (public.usuario_eh_administrador(auth.uid()));
create policy "administrators can update processos"
  on public.processos for update to authenticated
  using (public.usuario_eh_administrador(auth.uid()))
  with check (public.usuario_eh_administrador(auth.uid()));
create policy "administrators can delete processos"
  on public.processos for delete to authenticated
  using (public.usuario_eh_administrador(auth.uid()));

-- CALCULISTAS
drop policy if exists "calculistas_authenticated_all" on public.calculistas;
drop policy if exists "authenticated users can read calculistas" on public.calculistas;
drop policy if exists "administrators can insert calculistas" on public.calculistas;
drop policy if exists "administrators can update calculistas" on public.calculistas;
drop policy if exists "administrators can delete calculistas" on public.calculistas;

create policy "authenticated users can read calculistas"
  on public.calculistas for select to authenticated using (true);
create policy "administrators can insert calculistas"
  on public.calculistas for insert to authenticated
  with check (public.usuario_eh_administrador(auth.uid()));
create policy "administrators can update calculistas"
  on public.calculistas for update to authenticated
  using (public.usuario_eh_administrador(auth.uid()))
  with check (public.usuario_eh_administrador(auth.uid()));
create policy "administrators can delete calculistas"
  on public.calculistas for delete to authenticated
  using (public.usuario_eh_administrador(auth.uid()));

-- Privilégios SQL coerentes com as policies.
grant select on table public.advogados, public.clientes, public.processos, public.calculistas to authenticated;
grant insert, update, delete on table public.advogados, public.clientes, public.processos, public.calculistas to authenticated;
