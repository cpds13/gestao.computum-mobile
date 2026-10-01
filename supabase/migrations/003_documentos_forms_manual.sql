/*
  Gestão Computum — V8
  Modelo de documentos: Google Forms + vinculação manual.

  ATENÇÃO:
  Esta migration documenta a evolução do modelo. Não executar ainda sem validar
  os campos finais com o formulário Google.
*/

alter table public.arquivos
  alter column google_drive_file_id drop not null;

alter table public.arquivos
  add column if not exists origem text not null default 'MANUAL'
    check (origem in ('FORM', 'MANUAL'));

alter table public.arquivos
  add column if not exists forms_resposta_id text;

create index if not exists arquivos_origem_idx
  on public.arquivos(origem);

comment on column public.arquivos.origem is
  'Origem do documento: FORM (Google Forms) ou MANUAL (vinculação pelo usuário).';

comment on column public.arquivos.forms_resposta_id is
  'Identificador opcional da resposta do Google Forms associada ao documento.';
