-- Gestão Computum — V46 (migração histórica, já aplicada)
-- Gestão administrativa de usuários, perfis e vínculo com calculistas.

alter table public.usuarios
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists usuarios_email_unique
  on public.usuarios (lower(email));

-- Sincroniza contas que já existem no Supabase Auth, mas ainda não possuem
-- registro correspondente em public.usuarios.
insert into public.usuarios (id, nome, email, perfil, ativo)
select
  au.id,
  coalesce(
    nullif(trim(coalesce(au.raw_user_meta_data->>'name', '')), ''),
    nullif(trim(coalesce(au.raw_user_meta_data->>'display_name', '')), ''),
    au.email
  ) as nome,
  lower(au.email),
  'administrativo',
  true
from auth.users au
left join public.usuarios u on u.id = au.id
where u.id is null
  and au.email is not null;

-- Novas contas criadas no Auth passam a possuir automaticamente o perfil
-- administrativo inicial. O administrador define depois as funções.
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nome, email, perfil, ativo)
  values (
    new.id,
    coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data->>'name', '')), ''),
      nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''),
      new.email
    ),
    lower(new.email),
    'administrativo',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();

create or replace function public.set_usuarios_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_usuarios_updated_at on public.usuarios;
create trigger trg_usuarios_updated_at
before update on public.usuarios
for each row execute function public.set_usuarios_updated_at();

-- A leitura continua disponível para usuários autenticados porque o sistema
-- precisa identificar nomes/perfis em seus fluxos. Alterações de usuários,
-- porém, passam a ser restritas ao administrador. A interface usa a Edge
-- Function para operações que também alteram o Supabase Auth.
create or replace function public.usuario_eh_administrador(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios
    where id = p_user_id
      and perfil = 'administrador'
      and ativo = true
  );
$$;

grant execute on function public.usuario_eh_administrador(uuid) to authenticated;

drop policy if exists "authenticated users can manage usuarios" on public.usuarios;

drop policy if exists "authenticated users can read usuarios" on public.usuarios;
create policy "authenticated users can read usuarios"
  on public.usuarios
  for select
  to authenticated
  using (true);

drop policy if exists "administrators can insert usuarios" on public.usuarios;
create policy "administrators can insert usuarios"
  on public.usuarios
  for insert
  to authenticated
  with check (public.usuario_eh_administrador(auth.uid()));

drop policy if exists "administrators can update usuarios" on public.usuarios;
create policy "administrators can update usuarios"
  on public.usuarios
  for update
  to authenticated
  using (public.usuario_eh_administrador(auth.uid()))
  with check (public.usuario_eh_administrador(auth.uid()));

drop policy if exists "administrators can delete usuarios" on public.usuarios;
create policy "administrators can delete usuarios"
  on public.usuarios
  for delete
  to authenticated
  using (public.usuario_eh_administrador(auth.uid()));

