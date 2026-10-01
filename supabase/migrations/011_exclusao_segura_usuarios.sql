-- Gestão Computum V53
-- Exclusão segura de usuários pelo painel administrativo.
-- A Edge Function precisa consultar os vínculos antes de permitir a exclusão.

-- A service_role é usada exclusivamente pela Edge Function e precisa de leitura
-- das tabelas que podem manter referências ao usuário.
grant select on table
  public.solicitacoes,
  public.retrabalhos,
  public.arquivos,
  public.pagamentos,
  public.historico_solicitacao,
  public.calculistas
to service_role;

-- A própria conta interna e o vínculo de calculista já são alterados pela
-- Edge Function com service_role. Os privilégios abaixo tornam isso explícito.
grant delete on table public.usuarios, public.calculistas to service_role;
