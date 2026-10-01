# Gestão Computum — Documentos: Google Forms + Apps Script + Google Drive

## Status da decisão

**Estado atual — V43.**

A integração direta pela Google Drive API continua fora do escopo. O fluxo validado utiliza Google Forms + Google Apps Script + Google Drive privado. A automação usa o Google Forms e o Google Apps Script, sem Google Cloud/OAuth no frontend. O Gestão Computum usará duas portas de entrada para documentos:

1. **Google Forms** — recebimento de arquivos enviados pelo formulário.
2. **Manual** — registro/vinculação de arquivos ou pastas que já existem no Google Drive.

As duas formas alimentam a mesma área de documentos da solicitação.

## Estrutura prevista no Drive

```text
Computum/
└── Gestão/
    └── CJ-2026-xxxxx/
        ├── 01 - Documentos recebidos/
        ├── 02 - Cálculos/
        ├── 03 - Parecer/
        └── 04 - Retrabalho/
```

A criação e a movimentação dos arquivos são feitas pelo Google Forms + Google Apps Script. O Gestão Computum mantém o vínculo da pasta para acesso direto.

## Fluxo 1 — Google Forms

Dentro da solicitação haverá uma ação **Enviar pelo Forms**.

O formulário deverá receber, no mínimo:

- Código da solicitação (`CJ-AAAA-NNNNN`);
- Tipo/categoria do documento;
- Upload de arquivo;
- Observação opcional.

O Forms será utilizado como canal de recebimento. Os arquivos enviados ficam no Google Drive associado ao formulário.

### Tipos de arquivo

O formulário deverá ser configurado para aceitar, conforme a necessidade operacional:

- PDF;
- imagens (PNG/JPG/JPEG);
- outros formatos apenas se forem necessários.

No formulário atualmente configurado, os campos incluem código da solicitação, nome do cliente, número do processo, tipo de documento, descrição/observação, arquivos e arquivos adicionais. O limite configurado é de até 10 arquivos em cada campo de upload e até 1 GB por arquivo.

## Fluxo 2 — Vinculação manual

Para um arquivo ou pasta que já esteja no Drive:

```text
Solicitação
  → Documentos
  → Adicionar manualmente
  → Nome
  → Categoria
  → Link do Drive
  → Salvar
```

Não será feito upload pelo navegador do Gestão nessa primeira versão.

## Lista unificada

Independentemente da origem, o Gestão deverá exibir os documentos em uma única lista:

| Documento | Categoria | Origem | Ação |
|---|---|---|---|
| CNIS.pdf | Documentos recebidos | FORM | Abrir |
| Print-INSS.png | Prints | FORM | Abrir |
| Memória.xlsx | Cálculos | MANUAL | Abrir |
| Laudo.pdf | Parecer | MANUAL | Abrir |

A origem deve ser registrada como:

- `FORM`
- `MANUAL`

## Relação com o Supabase

O Supabase continua sendo a fonte dos dados estruturados do Gestão Computum.

O banco registra referências aos documentos, não o conteúdo binário do arquivo.

Estrutura já existente:

- `pastas_drive` — referência da pasta da solicitação;
- `arquivos` — referência de cada arquivo;
- `solicitacoes.google_drive_folder_id`;
- `solicitacoes.google_drive_url`.

## Regra importante

O Gestão Computum **não deve armazenar credenciais Google, senhas ou tokens OAuth** no frontend.

Como a API automática foi retirada do escopo da V8, não haverá OAuth do Google Drive nesta etapa.

## Próxima implementação

1. Melhorar o preenchimento do código da solicitação no Forms, se for necessário automatizar o pré-preenchimento.
2. Integrar a lista de documentos do Gestão diretamente aos registros de `arquivos`.
3. Permitir o cadastro manual de arquivos individuais além do vínculo de pasta.
4. Avaliar automações adicionais sem expor credenciais ou tokens no frontend.


## V57 — Navegação mobile

Em dispositivos móveis, tocar em qualquer item do menu lateral fecha o menu imediatamente, inclusive quando o item corresponde à tela que já está aberta. Essa regra evita que a barra lateral permaneça aberta no Dashboard. A correção é exclusivamente de navegação e não altera permissões ou regras de negócio.
