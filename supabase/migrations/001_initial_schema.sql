-- Gestão Computum — migration inicial
-- Estrutura base do sistema operacional de gestão de solicitações.
-- Documentos permanecem no Google Drive; o banco guarda apenas referências.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  perfil text not null default 'administrativo'
    check (perfil in ('administrador','calculista','revisor','administrativo')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.advogados (
  id uuid primary key default gen_random_uuid(), nome text not null, oab text,
  uf_oab char(2), escritorio text, telefone text, whatsapp text, email text,
  origem text check (origem in ('Instagram','Site','WhatsApp','Indicação','Cliente antigo','LinkedIn','Outro')),
  observacoes text, ativo boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index advogados_oab_uf_unique on public.advogados(oab,uf_oab) where oab is not null and uf_oab is not null;

create table public.clientes (
  id uuid primary key default gen_random_uuid(), nome text not null, cpf text,
  email text, telefone text, observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index clientes_cpf_unique on public.clientes(cpf) where cpf is not null and cpf <> '';

create table public.processos (
  id uuid primary key default gen_random_uuid(), numero_processo text not null unique,
  tribunal text, vara text, comarca text,
  cliente_id uuid references public.clientes(id) on delete set null,
  observacoes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.areas_servico (
  id uuid primary key default gen_random_uuid(), nome text not null unique,
  ativo boolean not null default true, ordem integer not null default 0
);

create table public.tipos_servico (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas_servico(id) on delete restrict,
  nome text not null, ativo boolean not null default true, ordem integer not null default 0,
  unique(area_id,nome)
);

create table public.sistemas_especializados (
  id uuid primary key default gen_random_uuid(), nome text not null unique,
  url text not null, area_id uuid references public.areas_servico(id) on delete set null,
  descricao text, ativo boolean not null default true, ordem integer not null default 0
);

create table public.solicitacoes (
  id uuid primary key default gen_random_uuid(), codigo text not null unique,
  advogado_id uuid references public.advogados(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  processo_id uuid references public.processos(id) on delete set null,
  area_id uuid references public.areas_servico(id) on delete set null,
  tipo_servico_id uuid references public.tipos_servico(id) on delete set null,
  descricao text, prazo date,
  status text not null default 'NOVO' check (status in ('NOVO','ANALISE','AGUARDANDO_DOCUMENTOS','EM_CALCULO','EM_REVISAO','ENVIADO','AGUARDANDO_PAGAMENTO','CONCLUIDO','IMPUGNACAO','RETRABALHO','PAUSADO','CANCELADO')),
  prioridade text not null default 'normal' check (prioridade in ('normal','alta','urgente')),
  calculista_id uuid references public.usuarios(id) on delete set null,
  revisor_id uuid references public.usuarios(id) on delete set null,
  tipo_entrega text not null default 'calculo' check (tipo_entrega in ('calculo','calculo_parecer','parecer','conferencia','outro')),
  data_solicitacao timestamptz not null default now(), data_inicio timestamptz,
  data_conclusao timestamptz, data_envio timestamptz,
  valor_cobrado numeric(12,2) not null default 0 check (valor_cobrado >= 0),
  desconto numeric(12,2) not null default 0 check (desconto >= 0),
  valor_final numeric(12,2) not null default 0 check (valor_final >= 0),
  origem text check (origem in ('Instagram','Site','WhatsApp','Indicação','Cliente antigo','LinkedIn','Outro')),
  cliente_antigo boolean not null default false,
  google_drive_folder_id text, google_drive_url text, observacoes text,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.retrabalhos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  tipo text not null check (tipo in ('impugnacao','esclarecimento','erro_identificado','novo_documento','alteracao_sentenca','atualizacao','solicitacao_advogado','outro')),
  motivo text, descricao text,
  responsavel_id uuid references public.usuarios(id) on delete set null,
  data_solicitacao timestamptz not null default now(), data_inicio timestamptz,
  data_conclusao timestamptz, data_envio timestamptz, cobrado boolean not null default false,
  valor_cobrado numeric(12,2) not null default 0 check (valor_cobrado >= 0),
  valor_final numeric(12,2) not null default 0 check (valor_final >= 0),
  status text not null default 'NOVO' check (status in ('NOVO','EM_ANALISE','EM_ANDAMENTO','EM_REVISAO','ENVIADO','CONCLUIDO','CANCELADO')),
  observacoes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.arquivos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  retrabalho_id uuid references public.retrabalhos(id) on delete set null,
  nome text not null, categoria text, mime_type text, tamanho bigint,
  google_drive_file_id text not null, google_drive_url text,
  uploaded_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.pastas_drive (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null unique references public.solicitacoes(id) on delete cascade,
  google_drive_folder_id text not null, google_drive_url text, nome_pasta text not null,
  created_at timestamptz not null default now()
);

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  retrabalho_id uuid references public.retrabalhos(id) on delete set null,
  data_pagamento date not null default current_date,
  valor numeric(12,2) not null check (valor > 0),
  forma_pagamento text not null check (forma_pagamento in ('PIX','Transferência','Dinheiro','Cartão','Outro')),
  observacao text, created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.historico_solicitacao (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  tipo_evento text not null, descricao text, data_hora timestamptz not null default now()
);

create index solicitacoes_status_idx on public.solicitacoes(status);
create index solicitacoes_prazo_idx on public.solicitacoes(prazo);
create index solicitacoes_advogado_idx on public.solicitacoes(advogado_id);
create index solicitacoes_cliente_idx on public.solicitacoes(cliente_id);
create index solicitacoes_calculista_idx on public.solicitacoes(calculista_id);
create index solicitacoes_revisor_idx on public.solicitacoes(revisor_id);
create index solicitacoes_tipo_servico_idx on public.solicitacoes(tipo_servico_id);
create index arquivos_solicitacao_idx on public.arquivos(solicitacao_id);
create index retrabalhos_solicitacao_idx on public.retrabalhos(solicitacao_id);
create index pagamentos_solicitacao_idx on public.pagamentos(solicitacao_id);
create index historico_solicitacao_idx on public.historico_solicitacao(solicitacao_id);

create trigger trg_advogados_updated_at before update on public.advogados for each row execute function public.set_updated_at();
create trigger trg_clientes_updated_at before update on public.clientes for each row execute function public.set_updated_at();
create trigger trg_processos_updated_at before update on public.processos for each row execute function public.set_updated_at();
create trigger trg_solicitacoes_updated_at before update on public.solicitacoes for each row execute function public.set_updated_at();
create trigger trg_retrabalhos_updated_at before update on public.retrabalhos for each row execute function public.set_updated_at();

alter table public.usuarios enable row level security;
alter table public.advogados enable row level security;
alter table public.clientes enable row level security;
alter table public.processos enable row level security;
alter table public.areas_servico enable row level security;
alter table public.tipos_servico enable row level security;
alter table public.sistemas_especializados enable row level security;
alter table public.solicitacoes enable row level security;
alter table public.retrabalhos enable row level security;
alter table public.arquivos enable row level security;
alter table public.pastas_drive enable row level security;
alter table public.pagamentos enable row level security;
alter table public.historico_solicitacao enable row level security;

create policy "authenticated users can manage usuarios" on public.usuarios for all to authenticated using (true) with check (true);
create policy "authenticated users can manage advogados" on public.advogados for all to authenticated using (true) with check (true);
create policy "authenticated users can manage clientes" on public.clientes for all to authenticated using (true) with check (true);
create policy "authenticated users can manage processos" on public.processos for all to authenticated using (true) with check (true);
create policy "authenticated users can manage areas" on public.areas_servico for all to authenticated using (true) with check (true);
create policy "authenticated users can manage tipos" on public.tipos_servico for all to authenticated using (true) with check (true);
create policy "authenticated users can manage sistemas" on public.sistemas_especializados for all to authenticated using (true) with check (true);
create policy "authenticated users can manage solicitacoes" on public.solicitacoes for all to authenticated using (true) with check (true);
create policy "authenticated users can manage retrabalhos" on public.retrabalhos for all to authenticated using (true) with check (true);
create policy "authenticated users can manage arquivos" on public.arquivos for all to authenticated using (true) with check (true);
create policy "authenticated users can manage pastas drive" on public.pastas_drive for all to authenticated using (true) with check (true);
create policy "authenticated users can manage pagamentos" on public.pagamentos for all to authenticated using (true) with check (true);
create policy "authenticated users can manage historico" on public.historico_solicitacao for all to authenticated using (true) with check (true);

insert into public.areas_servico(nome,ordem) values
('Previdenciário',1),('Trabalhista',2),('Servidor Público',3),('Cível',4),('Tributário',5),('Consumidor',6),('Saúde',7),('Outro',99)
on conflict (nome) do nothing;

insert into public.tipos_servico(area_id,nome,ordem)
select a.id,v.nome,v.ordem from (values
('Previdenciário','Cálculo previdenciário',1),('Previdenciário','Revisão de RMI',2),('Previdenciário','URV',3),('Previdenciário','LOAS',4),('Previdenciário','Revisão da Vida Toda',5),
('Trabalhista','Liquidação trabalhista',1),('Servidor Público','Cálculo de servidor público',1),('Cível','Liquidação cível',1),('Tributário','Cálculo tributário',1),('Consumidor','Cálculo de diferenças',1),('Saúde','Cálculo de plano de saúde',1)
) v(area_nome,nome,ordem) join public.areas_servico a on a.nome=v.area_nome
on conflict(area_id,nome) do nothing;

insert into public.sistemas_especializados(nome,url,area_id,descricao,ordem)
select v.nome,v.url,a.id,v.descricao,v.ordem from (values
('Abono Computum','https://abono.computum.com.br/','Servidor Público','Sistema especializado para cálculos de abono e diferenças de servidor.',1),
('Diferenças Computum','https://diferencas.computum.com.br/','Previdenciário','Sistema especializado para cálculos de diferenças.',2),
('Saúde Computum','https://saude.computum.com.br/','Saúde','Sistema especializado para cálculos relacionados à saúde.',3)
) v(nome,url,area_nome,descricao,ordem) left join public.areas_servico a on a.nome=v.area_nome
on conflict(nome) do nothing;
