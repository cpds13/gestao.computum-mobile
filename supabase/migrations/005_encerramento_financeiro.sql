-- Gestão Computum — V29 — encerramento financeiro
-- Registra os dados necessários para concluir uma solicitação após o recebimento.

alter table public.pagamentos
  add column if not exists conta_recebimento text,
  add column if not exists recibo_emitido boolean not null default false,
  add column if not exists recibo_numero text,
  add column if not exists recibo_data date,
  add column if not exists recibo_observacoes text,
  add column if not exists recibo_drive_url text;

alter table public.pagamentos
  drop constraint if exists pagamentos_forma_pagamento_check;

alter table public.pagamentos
  add constraint pagamentos_forma_pagamento_check
  check (forma_pagamento in ('PIX','CREDITO','DEBITO','TRANSFERENCIA','DINHEIRO','CARTAO','OUTRO','Cartão','Outro'));

create index if not exists pagamentos_data_idx on public.pagamentos(data_pagamento);
create index if not exists pagamentos_recibo_idx on public.pagamentos(recibo_emitido);
