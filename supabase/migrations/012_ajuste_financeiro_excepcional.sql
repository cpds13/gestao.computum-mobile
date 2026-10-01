-- Gestão Computum — V61 — ajuste financeiro excepcional
-- Permite a Administradores corrigir o valor de uma solicitação já concluída.
-- A operação é atômica e registra o ajuste no histórico.

create or replace function public.ajustar_valor_financeiro(
  p_solicitacao_id uuid,
  p_novo_valor numeric,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitacao public.solicitacoes%rowtype;
  v_novo_valor_final numeric(12,2);
  v_motivo text;
begin
  if not public.usuario_eh_administrador(auth.uid()) then
    raise exception 'Somente Administradores podem realizar ajustes financeiros.'
      using errcode = '42501';
  end if;

  if p_solicitacao_id is null then
    raise exception 'Solicitação não informada.'
      using errcode = '22023';
  end if;

  if p_novo_valor is null or p_novo_valor < 0 then
    raise exception 'O novo valor deve ser maior ou igual a zero.'
      using errcode = '22023';
  end if;

  v_motivo := trim(coalesce(p_motivo, ''));

  if v_motivo = '' then
    raise exception 'O motivo do ajuste é obrigatório.'
      using errcode = '22023';
  end if;

  if length(v_motivo) > 500 then
    raise exception 'O motivo do ajuste deve ter no máximo 500 caracteres.'
      using errcode = '22023';
  end if;

  select *
    into v_solicitacao
    from public.solicitacoes
   where id = p_solicitacao_id
   for update;

  if not found then
    raise exception 'Solicitação não encontrada.'
      using errcode = 'P0002';
  end if;

  if v_solicitacao.status <> 'CONCLUIDO' then
    raise exception 'O ajuste financeiro excepcional está disponível somente para solicitações concluídas.'
      using errcode = '42501';
  end if;

  if round(v_solicitacao.valor_cobrado, 2) = round(p_novo_valor, 2) then
    raise exception 'O novo valor deve ser diferente do valor atual.'
      using errcode = '22023';
  end if;

  -- Mantém eventual desconto já registrado e recalcula o valor final.
  v_novo_valor_final := greatest(
    0,
    round(p_novo_valor, 2) - coalesce(v_solicitacao.desconto, 0)
  );

  update public.solicitacoes
     set valor_cobrado = round(p_novo_valor, 2),
         valor_final = v_novo_valor_final,
         updated_at = now()
   where id = p_solicitacao_id;

  insert into public.historico_solicitacao (
    solicitacao_id,
    usuario_id,
    tipo_evento,
    descricao,
    data_hora
  )
  values (
    p_solicitacao_id,
    auth.uid(),
    'AJUSTE_FINANCEIRO',
    format(
      'Ajuste financeiro excepcional. Valor cobrado alterado de R$ %s para R$ %s. Motivo: %s',
      to_char(v_solicitacao.valor_cobrado, 'FM999999990D00'),
      to_char(round(p_novo_valor, 2), 'FM999999990D00'),
      v_motivo
    ),
    now()
  );

  return jsonb_build_object(
    'solicitacao_id', p_solicitacao_id,
    'codigo', v_solicitacao.codigo,
    'valor_anterior', round(v_solicitacao.valor_cobrado, 2),
    'novo_valor', round(p_novo_valor, 2),
    'novo_valor_final', v_novo_valor_final
  );
end;
$$;

revoke all on function public.ajustar_valor_financeiro(uuid, numeric, text) from public;
grant execute on function public.ajustar_valor_financeiro(uuid, numeric, text) to authenticated;
