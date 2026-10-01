# Gestão Computum — Especificação Completa do Projeto
## Estado funcional em 01/10/2026 — V59
A especificação abaixo permanece como documento de referência do projeto. As seguintes partes já estão implementadas e validadas no frontend/Supabase:

- autenticação e perfis;
- solicitações e cadastros relacionados;
- calculistas e vínculo com usuários;
- Minha produção;
- revisão e devolução;
- entrega `ENVIADO → AGUARDANDO_PAGAMENTO`;
- encerramento financeiro;
- múltiplos recebimentos e pagamentos parciais;
- Tipo de Serviço dinâmico por Área;
- `Outro` com detalhamento de até 100 caracteres;
- tipos Tributário `Rest. acima TETO` e `Recomposição IR`;
- Google Forms + Apps Script para organização dos documentos;
- vínculo da pasta privada do Google Drive;
- pasta `05 - Financeiro`;
- histórico operacional.

Partes descritas neste documento como futuras permanecem como requisitos/propostas e não devem ser interpretadas como funcionalidades já disponíveis.


## 1. Visão geral

O **Gestão Computum** será um sistema web para controle operacional de solicitações de cálculos judiciais feitas por advogados.

O sistema não será um motor de cálculo. Sua finalidade será controlar a operação completa:

- entrada da solicitação;
- advogado e cliente;
- processo;
- tipo de serviço;
- documentos recebidos;
- responsável pelo cálculo;
- revisão;
- prazo;
- envio;
- cobrança;
- pagamentos;
- retrabalhos;
- impugnações;
- histórico;
- origem do cliente;
- vínculo com sistemas especializados;
- organização dos documentos no Google Drive.

### URL planejada

`https://gestao.computum.com.br`

O sistema fará parte do ecossistema Computum, mas será independente dos sistemas especializados de cálculo.

---

# 2. Ecossistema Computum

Foi definido que o Gestão não incorporará o ContadJus.

O ContadJus é um sistema separado.

Também existem ou poderão existir aplicações especializadas em subdomínios diferentes:

- `abono.computum.com.br`
- `diferencas.computum.com.br`
- `saude.computum.com.br`
- outros sistemas futuros.

O Gestão será a aplicação administrativa/operacional que controla os trabalhos.

### Conceito

**Gestão Computum**
- controla o trabalho;
- controla clientes;
- controla advogados;
- controla processos;
- controla prazos;
- controla financeiro;
- controla retrabalho;
- controla documentos.

**Sistemas especializados**
- executam cálculos ou atividades específicas.

Exemplo:

```text
Gestão
  ↓
Solicitação: Abono de Permanência
  ↓
Sistema vinculado: Abono Computum
  ↓
Abrir sistema especializado
```

Inicialmente, a integração entre sistemas será apenas por URL/vínculo. Uma integração automática poderá ser desenvolvida posteriormente.

---

# 3. Arquitetura tecnológica definida

## Frontend

**GitHub Pages**

O aplicativo será uma aplicação web estática, inicialmente baseada em HTML/CSS/JavaScript.

O GitHub Pages hospedará a interface.

## Backend / banco

**Supabase**

Será usado para:

- PostgreSQL;
- autenticação;
- API;
- regras de acesso;
- Row Level Security;
- dados estruturados;
- histórico;
- usuários;
- solicitações;
- financeiro;
- retrabalho.

O projeto poderá começar no plano gratuito.

## Documentos

**Google Drive privado**

O Google Drive será o repositório dos documentos dos processos:

- PDFs;
- imagens;
- sentenças;
- acórdãos;
- decisões;
- planilhas;
- cálculos;
- pareceres;
- documentos recebidos.

Não será necessário tornar as pastas públicas.

A ideia é autorizar o sistema a acessar uma área privada do Drive por meio da conta do usuário.

## Domínio

O domínio principal é:

`computum.com.br`

O Gestão deverá funcionar como:

`gestao.computum.com.br`

A infraestrutura conceitual:

```text
gestao.computum.com.br
        ↓
   GitHub Pages
        ↓
     Supabase
        ↓
Google Drive privado
```

---

# 4. Princípio importante: banco ≠ documentos

Foi decidido que o Supabase não será utilizado como depósito principal dos documentos.

O banco guardará informações estruturadas e referências aos arquivos.

Exemplo:

```text
Solicitação CJ-2026-00157
    |
    ├── Advogado
    ├── Cliente
    ├── Processo
    ├── Serviço
    ├── Status
    ├── Valor
    ├── Calculista
    └── Google Drive
             |
             ├── sentença.pdf
             ├── acórdão.pdf
             ├── calculo.xlsx
             └── parecer.pdf
```

Vantagens:

- os documentos permanecem sob controle do proprietário;
- não é necessário migrar o acervo existente;
- o Google Drive continua sendo o arquivo principal;
- o banco fica pequeno;
- é possível vincular pastas já existentes;
- o sistema pode criar novas pastas quando necessário.

---

# 5. Google Drive

O sistema deverá trabalhar com pastas privadas.

Não é necessário tornar o Drive público.

A ideia é permitir:

### Criar pasta

Ao criar uma solicitação:

> Criar pasta no Google Drive

Estrutura sugerida:

```text
Computum
└── Gestão
    └── CJ-2026-00157
        ├── 01 - Documentos recebidos
        ├── 02 - Cálculos
        ├── 03 - Parecer
        └── 04 - Retrabalho
```

A estrutura poderá ser ajustada posteriormente.

### Vincular pasta existente

Também será possível:

> Vincular pasta existente

Isso é importante porque já existe um acervo de documentos.

O usuário poderá selecionar uma pasta que já existe no Drive e vinculá-la à solicitação, sem mover arquivos.

---

# 6. Objetivo operacional

O sistema deverá acompanhar a demanda desde a chegada do pedido até a conclusão financeira.

Fluxo principal:

```text
NOVO
  ↓
ANÁLISE
  ↓
AGUARDANDO DOCUMENTOS
  ↓
EM CÁLCULO
  ↓
EM REVISÃO
  ↓
ENVIADO
  ↓
AGUARDANDO PAGAMENTO
  ↓
CONCLUÍDO
```

Fluxos alternativos:

```text
ENTREGUE
  ↓
IMPUGNAÇÃO
  ↓
RETRABALHO
  ↓
NOVA ENTREGA
```

Também haverá:

- pausado;
- cancelado;
- aguardando informação;
- outros estados configuráveis.

---

# 7. Cadastro de solicitação

A solicitação será o objeto central do sistema.

## Dados do advogado

- nome;
- OAB;
- UF da OAB;
- escritório;
- telefone;
- WhatsApp;
- e-mail;
- origem;
- observações.

## Dados do cliente

- nome;
- CPF;
- e-mail;
- telefone;
- observações.

## Dados do processo

- número do processo;
- tribunal;
- vara;
- comarca;
- cliente;
- observações.

O processo poderá ser opcional, pois pode existir:

- orçamento;
- consulta;
- análise preliminar;
- trabalho extrajudicial;
- solicitação ainda sem número.

---

# 8. Origem do advogado/cliente

O sistema deverá registrar de onde veio a oportunidade.

Opções inicialmente previstas:

- Instagram;
- site;
- WhatsApp;
- indicação;
- cliente antigo;
- LinkedIn;
- outro.

Isso permitirá relatórios como:

- solicitações por origem;
- faturamento por origem;
- quantidade de novos clientes;
- recorrência.

---

# 9. Classificação dos serviços

Foi decidido não usar um único campo genérico para o tipo de cálculo.

Haverá uma hierarquia:

```text
ÁREA
  ↓
TIPO DE SERVIÇO
```

## Áreas iniciais

- Previdenciário;
- Trabalhista;
- Servidor Público;
- Cível;
- Tributário;
- Consumidor;
- Saúde;
- Outro.

## Exemplos de serviços

### Previdenciário
- liquidação;
- revisão de RMI;
- atualização;
- LOAS;
- outros.

### Servidor Público
- abono de permanência;
- verbas remuneratórias;
- 13º;
- férias;
- outros.

### Cível
- dano material;
- dano moral;
- liquidação;
- atualização;
- outros.

### Saúde
- plano de saúde;
- outros.

A estrutura será configurável.

---

# 10. Sistemas especializados

Foi decidido criar uma tabela de sistemas especializados.

Exemplos:

```text
Abono Computum
https://abono.computum.com.br

Diferenças Computum
https://diferencas.computum.com.br

Saúde Computum
https://saude.computum.com.br
```

O sistema especializado será vinculado ao tipo de serviço.

Exemplo:

```text
Área:
Servidor Público

Tipo:
Abono de Permanência

Sistema especializado:
Abono Computum

[Abrir sistema ↗]
```

Assim, ao escolher o tipo de serviço, o sistema poderá mostrar automaticamente o sistema correspondente.

A integração automática entre sistemas fica como possibilidade futura.

---

# 11. Cadastro de sistemas especializados

Tabela conceitual:

```text
sistemas_especializados
```

Campos:

- id;
- nome;
- URL;
- área;
- descrição;
- ativo;
- ícone opcional;
- ordem.

O vínculo com os tipos de serviço poderá ser feito por relacionamento.

---

# 12. Solicitação: conteúdo

A solicitação terá:

- descrição;
- texto enviado pelo advogado;
- prazo;
- prioridade;
- observações.

Prioridades:

- normal;
- alta;
- urgente.

O cadastro deverá ser rápido.

A ideia é que o usuário consiga registrar uma demanda com poucas informações e complementá-la depois.

Exemplo:

```text
Advogado: João
Processo: 000123...
Tipo: Liquidação
Prazo: 30/09
Valor: R$ 800
Arquivo: sentença.pdf
```

Depois os demais campos podem ser preenchidos.

O sistema deve reduzir trabalho administrativo, não aumentar.

---

# 13. Arquivos

A solicitação poderá receber:

- PDF;
- JPG;
- PNG;
- DOCX;
- XLSX;
- outros.

Categorias:

- documento recebido;
- sentença;
- acórdão;
- decisão;
- planilha;
- cálculo;
- parecer;
- imagem;
- outros.

Os arquivos físicos ficarão no Google Drive.

---

# 14. Controle do cálculo

O Gestão não realizará o cálculo.

Ele registrará o trabalho.

Campos:

- sistema utilizado;
- calculista;
- revisor;
- data de início;
- data de conclusão;
- data de envio;
- tipo de entrega.

Tipos de entrega:

- cálculo;
- cálculo + parecer;
- apenas parecer;
- conferência;
- outro.

Também será possível abrir o sistema especializado associado.

---

# 15. Financeiro

O sistema terá controle financeiro completo.

## Na solicitação

- valor cobrado;
- desconto;
- valor final;
- condição de pagamento.

Exemplo:

```text
Valor: R$ 1.000,00
Desconto: R$ 100,00
Total: R$ 900,00
```

## Pagamentos

Não será utilizado apenas um campo "pago".

Uma solicitação poderá ter vários pagamentos.

Exemplo:

```text
Serviço: R$ 1.500

Pagamento 1: R$ 500
Pagamento 2: R$ 500
Pagamento 3: R$ 500
```

O sistema calcula:

- total cobrado;
- total recebido;
- saldo;
- situação financeira.

Formas de pagamento:

- PIX;
- transferência;
- dinheiro;
- cartão;
- outro.

---

# 16. Retrabalho

Retrabalho será tratado como entidade própria.

Motivos:

- impugnação;
- esclarecimento;
- erro identificado;
- novo documento;
- alteração da sentença;
- atualização;
- solicitação do advogado;
- outro.

Campos:

- solicitação original;
- tipo;
- motivo;
- descrição;
- responsável;
- data de solicitação;
- data de início;
- data de conclusão;
- data de envio;
- cobrado;
- valor cobrado;
- valor final;
- status;
- observações.

Exemplo:

```text
Cálculo original: R$ 800

Retrabalho 1:
Impugnação
Não cobrado

Retrabalho 2:
Atualização
R$ 200
```

O sistema poderá calcular:

- faturamento original;
- faturamento de retrabalhos;
- retrabalho não cobrado;
- quantidade de retrabalhos;
- motivos mais frequentes.

---

# 17. Histórico

Será mantido um histórico de eventos.

Tabela:

```text
historico_solicitacao
```

Exemplo:

```text
26/09 09:15
Solicitação criada

26/09 09:18
Documento sentença.pdf anexado

26/09 09:30
Patrick atribuído

27/09 08:12
Cálculo iniciado

28/09 16:40
Cálculo concluído

28/09 17:05
Enviado ao advogado

03/10 10:15
Pagamento recebido
```

O histórico deve registrar:

- usuário;
- tipo de evento;
- descrição;
- data e hora.

---

# 18. Banco de dados proposto

## usuarios

```text
id
nome
email
perfil
ativo
created_at
```

Perfis iniciais:

- administrador;
- calculista;
- revisor;
- administrativo.

A autenticação será feita pelo Supabase Auth.

---

## advogados

```text
id
nome
oab
uf_oab
escritorio
telefone
whatsapp
email
origem
observacoes
ativo
created_at
updated_at
```

---

## clientes

```text
id
nome
cpf
email
telefone
observacoes
created_at
updated_at
```

---

## processos

```text
id
numero_processo
tribunal
vara
comarca
cliente_id
observacoes
created_at
updated_at
```

---

## areas_servico

```text
id
nome
ativo
ordem
```

---

## tipos_servico

```text
id
area_id
nome
ativo
ordem
```

---

## sistemas_especializados

```text
id
nome
url
area_id
descricao
ativo
ordem
```

O relacionamento entre sistemas e serviços poderá ser expandido posteriormente se um sistema atender vários serviços.

---

## solicitacoes

```text
id
codigo

advogado_id
cliente_id
processo_id

area_id
tipo_servico_id

descricao
prazo
status
prioridade

calculista_id
revisor_id

tipo_entrega

data_solicitacao
data_inicio
data_conclusao
data_envio

valor_cobrado
desconto
valor_final

origem
cliente_antigo

google_drive_folder_id
google_drive_url

observacoes

created_by
created_at
updated_at
```

Código sugerido:

`CJ-2026-000157`

---

## arquivos

```text
id
solicitacao_id
retrabalho_id
nome
categoria
mime_type
tamanho
google_drive_file_id
google_drive_url
uploaded_by
created_at
```

---

## pastas_drive

```text
id
solicitacao_id
google_drive_folder_id
google_drive_url
nome_pasta
created_at
```

---

## retrabalhos

```text
id
solicitacao_id

tipo
motivo
descricao

responsavel_id

data_solicitacao
data_inicio
data_conclusao
data_envio

cobrado
valor_cobrado
valor_final

status

observacoes

created_at
updated_at
```

---

## pagamentos

```text
id
solicitacao_id
retrabalho_id

data_pagamento
valor
forma_pagamento

observacao
created_by
created_at
```

---

## historico_solicitacao

```text
id
solicitacao_id
usuario_id
tipo_evento
descricao
data_hora
```

---

# 19. Por que não criar uma tabela financeira genérica

Foi decidido não criar uma tabela chamada simplesmente `financeiro`.

O financeiro será construído a partir de:

```text
SOLICITAÇÕES
+
PAGAMENTOS
+
RETRABALHOS
```

Isso permite diferentes visões:

### Faturamento
Quanto foi contratado.

### Recebimento
Quanto efetivamente entrou.

### A receber
Quanto ainda falta.

### Retrabalho
Quanto foi produzido sem cobrança.

Evita duplicação de informação.

---

# 20. Gestão de usuários e permissões

A V46 implementa o gerenciamento administrativo das contas de acesso. A conta autenticada em `auth.users` permanece a identidade principal. O registro em `public.usuarios` guarda nome, e-mail, situação e perfil administrativo. A função de Calculista é representada pelo vínculo `public.calculistas.usuario_id`.

O mesmo usuário pode exercer Administrador e Calculista simultaneamente. A administração de contas ocorre pelo painel do sistema e não deve exigir edição manual de `auth.users`.

### Operações

- criar conta;
- editar nome;
- alterar e-mail;
- definir Administrador;
- definir Calculista;
- combinar as duas funções;
- vincular cadastro de calculista;
- ativar/desativar.

A criação e alteração da identidade no Supabase Auth são executadas por uma Edge Function com `service_role`, nunca pelo navegador. A função verifica que o solicitante é administrador antes de executar a operação.

Contas existentes no Auth sem registro em `public.usuarios` são sincronizadas pela migration 008. O perfil inicial dessas contas é `administrativo` até que um administrador defina as funções.

O sistema impede que uma operação administrativa deixe o projeto sem pelo menos um administrador ativo.

# 21. Segurança

Como o sistema poderá conter dados de processos e dados pessoais, a arquitetura deverá utilizar **Row Level Security (RLS)** no Supabase.

Acesso inicial:

- administrador;
- posteriormente outros usuários.

Cada perfil deverá ter permissões adequadas.

O sistema não deverá depender de informações expostas publicamente.

---

# 21. Telas planejadas

## Dashboard

Indicadores:

- solicitações abertas;
- a receber;
- recebido no mês;
- retrabalhos;
- atrasados;
- prazos próximos;
- aguardando documentos.

Também terá lista de solicitações recentes.

---

## Solicitações

Filtros:

- pesquisa;
- status;
- área;
- tipo;
- advogado;
- calculista;
- período;
- origem;
- pago/não pago.

Visualizações:

- lista;
- tabela;
- Kanban.

Status sugeridos para Kanban:

```text
NOVO
EM CÁLCULO
EM REVISÃO
ENVIADO
```

---

## Nova solicitação

Blocos:

1. Solicitante
2. Cliente
3. Processo
4. Serviço
5. Solicitação
6. Documentos
7. Valores
8. Responsáveis

A tela deverá ser especialmente boa no celular.

---

## Detalhes da solicitação

Cabeçalho:

- código;
- serviço;
- status;
- advogado;
- cliente;
- processo.

Abas:

- Resumo;
- Documentos;
- Cálculo;
- Financeiro;
- Retrabalhos;
- Histórico.

---

## Advogados

Mostrar:

- quantidade de solicitações;
- faturamento;
- recebido;
- a receber;
- última solicitação;
- histórico.

---

## Clientes

Mostrar:

- processos;
- solicitações;
- valores;
- histórico.

---

## Processos

Busca pelo número do processo.

Ao abrir:

- cliente;
- advogado;
- solicitações;
- retrabalhos;
- documentos.

---

## Calculistas

Controle operacional:

- trabalhos atribuídos;
- em andamento;
- concluídos;
- atrasados;
- retrabalhos.

Não será usado como ranking de desempenho.

---

## Financeiro

Indicadores:

- faturamento;
- recebimentos;
- a receber;
- atrasados.

Listas:

- contas a receber;
- recebimentos;
- pagamentos.

---

## Relatórios

Produção:

- por período;
- por calculista;
- por área;
- por serviço.

Financeiro:

- faturamento;
- recebimento;
- inadimplência;
- ticket médio.

Origem:

- Instagram;
- site;
- indicação;
- cliente antigo;
- outros.

Retrabalho:

- quantidade;
- motivos;
- cobrado;
- não cobrado.

---

## Configurações

Cadastros:

- áreas;
- tipos de serviço;
- sistemas especializados;
- usuários;
- status;
- formas de pagamento;
- integração Google Drive.

---

# 22. Dashboard conceitual

Exemplo:

```text
┌──────────────┐ ┌──────────────┐
│ 12           │ │ R$ 8.450     │
│ Em aberto    │ │ A receber    │
└──────────────┘ └──────────────┘

┌──────────────┐ ┌──────────────┐
│ R$ 14.200    │ │ 5            │
│ Recebido     │ │ Retrabalhos  │
└──────────────┘ └──────────────┘
```

Área de atenção:

- cálculos atrasados;
- prazos próximos;
- documentos pendentes;
- retrabalhos.

---

# 23. Identidade visual

Foram fornecidos dois projetos existentes para servir de base:

1. `calculojus.app.br`
2. `saude.computum.com.br`

Foi decidido criar um **Computum Design System v1**.

Não será uma cópia integral de nenhum projeto.

Será uma combinação da identidade institucional do CálculoJus com os componentes de aplicação do Saúde Computum.

---

# 24. Identidade visual do CálculoJus

Elementos identificados no projeto:

### Cores

- Azul-marinho: `#172B46`
- Terracota: `#A85F43`
- Creme: `#F3E9DC`
- Cinza: `#6F747A`
- Linhas: `#DEDBD6`
- Fundo suave: `#F8F5F1`

### Tipografia

- títulos: Georgia;
- texto: Arial.

### Características

- estética editorial/jurídica;
- bastante espaço em branco;
- bordas discretas;
- cantos pouco arredondados;
- hierarquia visual clara;
- detalhe vertical terracota na identidade.

---

# 25. Identidade visual do Saúde Computum

Elementos identificados:

### Cores

- fundo: `#F4F7F9`
- branco para cards;
- azul petróleo: `#0C5967`
- azul secundário: `#087F91`
- bordas: `#D8E2E6`

### Tipografia

- `system-ui`.

### Componentes

- cards;
- tabelas;
- abas;
- KPIs;
- formulários;
- alertas;
- estados;
- bordas arredondadas.

Essa estrutura é particularmente adequada ao Gestão.

---

# 26. Computum Design System v1

Componentes que deverão ser padronizados:

1. Cores;
2. Fontes;
3. Botões;
4. Inputs;
5. Selects;
6. Cards;
7. Tabelas;
8. Badges;
9. Status;
10. Alertas;
11. Modais;
12. Menu lateral;
13. Dashboard;
14. Responsividade;
15. Ícones;
16. Espaçamentos;
17. Bordas;
18. Sombras.

Objetivo:

```text
Design System Computum
        |
        ├── Gestão
        ├── Abono
        ├── Diferenças
        ├── Saúde
        └── futuros sistemas
```

Cada sistema pode ter finalidade diferente, mas todos deverão parecer parte da mesma família.

---

# 27. Responsividade

O sistema será desenvolvido com foco em:

- computador;
- tablet;
- celular.

O cadastro de solicitação deverá funcionar muito bem no celular.

A interface desktop poderá utilizar menu lateral.

No celular:

- menu compacto;
- navegação adaptada;
- cards empilhados;
- tabelas adaptadas;
- ações principais acessíveis.

---

# 28. Filosofia de UX

O sistema não deve parecer um ERP pesado.

A experiência deve ser:

- limpa;
- profissional;
- objetiva;
- rápida;
- adequada a trabalho jurídico;
- com poucas ações para registrar uma demanda;
- detalhada quando o usuário quiser aprofundar.

A ação principal deverá estar sempre acessível:

> **+ Nova solicitação**

---

# 29. Fluxo completo

Fluxo principal:

```text
ADVOGADO ENVIA PEDIDO
        ↓
NOVA SOLICITAÇÃO
        ↓
CADASTRO RÁPIDO
        ↓
DOCUMENTOS
        ↓
CLASSIFICAÇÃO
        ↓
SISTEMA ESPECIALIZADO
        ↓
ATRIBUIÇÃO
        ↓
CÁLCULO
        ↓
REVISÃO
        ↓
ENTREGA
        ↓
PAGAMENTO
        ↓
CONCLUÍDO
```

Fluxo de retrabalho:

```text
ENTREGUE
   ↓
IMPUGNAÇÃO
   ↓
RETRABALHO
   ↓
NOVA ENTREGA
```

---

# 30. Métricas futuras

O banco foi pensado para permitir:

### Produção

- cálculos concluídos;
- cálculos por período;
- cálculos por área;
- cálculos por serviço;
- cálculos por responsável.

### Financeiro

- faturamento;
- recebimento;
- saldo;
- inadimplência;
- ticket médio.

### Clientes

- novos advogados;
- clientes recorrentes;
- origem das demandas;
- faturamento por advogado.

### Retrabalho

- quantidade;
- motivo;
- custo operacional;
- cobrado;
- não cobrado.

### Operação

- tempo entre solicitação e início;
- tempo de execução;
- prazo;
- atraso;
- volume por responsável.

---

# 31. Evolução futura

O sistema poderá posteriormente receber:

- notificações;
- alertas de prazo;
- modelos de mensagens;
- geração de recibos;
- relatórios PDF;
- integração mais profunda com Google Drive;
- integração entre Gestão e sistemas especializados;
- preenchimento automático de dados;
- leitura de PDFs;
- classificação automática;
- automações;
- portal para advogados.

Essas funcionalidades não fazem parte da primeira versão obrigatoriamente.

A arquitetura deverá apenas evitar impedir sua implementação futura.

---

# 32. Escopo da primeira versão

A primeira versão funcional deverá priorizar:

### Autenticação
- login;
- usuários;
- perfis.

### Cadastros
- advogados;
- clientes;
- processos;
- áreas;
- tipos de serviço;
- sistemas especializados.

### Operação
- nova solicitação;
- listagem;
- filtros;
- status;
- atribuição;
- prazo;
- detalhes.

### Documentos
- integração com Google Drive;
- criação/vinculação de pasta;
- referência aos arquivos.

### Financeiro
- valor;
- pagamentos;
- saldo;
- status financeiro.

### Retrabalho
- criação;
- cobrança;
- responsável;
- status.

### Histórico
- eventos e alterações.

### Dashboard
- indicadores básicos;
- pendências;
- solicitações recentes.

---

# 33. Fora do escopo inicial

Não faz parte da primeira versão:

- cálculo matemático;
- ContadJus;
- motor previdenciário;
- motor trabalhista;
- motor de saúde;
- motor de abono;
- armazenamento principal de documentos no Supabase;
- portal completo para advogados;
- automação avançada entre todos os sistemas.

Esses sistemas continuam independentes.

---

# 34. Princípio arquitetural final

O Gestão Computum será o **centro administrativo da operação**, não o centro matemático de todos os cálculos.

```text
                 GESTÃO COMPUTUM
                       |
       ┌───────────────┼────────────────┐
       |               |                |
   Operação        Financeiro       Documentos
       |                                |
       |                            Google Drive
       |
       ├── Abono Computum
       ├── Diferenças Computum
       ├── Saúde Computum
       └── outros sistemas
```

Isso permite crescer o ecossistema sem transformar o Gestão em um sistema monolítico.

---

# 35. Próxima etapa

Após esta especificação, a sequência recomendada é:

### Etapa 1 — Design System
Formalizar CSS, cores, fontes, componentes e responsividade.

### Etapa 2 — Banco Supabase
Criar tabelas, relacionamentos, índices, constraints e RLS.

### Etapa 3 — Autenticação
Login e perfis.

### Etapa 4 — Dashboard
Primeira tela visual.

### Etapa 5 — Solicitações
Cadastro, listagem, filtros e detalhes.

### Etapa 6 — Google Drive
Autorização, criação/vinculação de pastas e arquivos.

### Etapa 7 — Financeiro
Cobrança e pagamentos.

### Etapa 8 — Retrabalho
Controle completo.

### Etapa 9 — Relatórios
Indicadores e gráficos.

### Etapa 10 — Integrações
Vínculo e, futuramente, integração com os sistemas especializados.

---

# 36. Decisões já tomadas

As seguintes decisões são consideradas definidas:

- [x] Nome: Gestão Computum
- [x] Subdomínio: `gestao.computum.com.br`
- [x] GitHub Pages como frontend/hospedagem
- [x] Supabase como banco/backend
- [x] Google Drive privado para documentos
- [x] Não tornar pastas do Drive públicas
- [x] Possibilidade de vincular pastas existentes
- [x] ContadJus não será incorporado
- [x] Sistemas especializados permanecem independentes
- [x] URL dos sistemas especializados será cadastrável
- [x] Tipos de serviço poderão apontar para sistemas especializados
- [x] Financeiro será baseado em serviços + pagamentos + retrabalhos
- [x] Pagamentos múltiplos serão permitidos
- [x] Retrabalho será entidade própria
- [x] Histórico será registrado
- [x] Usuários terão perfis
- [x] RLS será considerado desde o início
- [x] Interface será responsiva
- [x] CálculoJus e Saúde Computum serão referências para o Design System
- [x] Gestão não será um motor de cálculo
- [x] Primeira versão priorizará operação e controle

---

# 37. Resumo executivo

O **Gestão Computum** será uma plataforma web privada para administrar a operação de cálculos judiciais.

O advogado solicita um trabalho. O usuário registra a demanda, classifica o serviço, vincula advogado, cliente e processo, recebe documentos pelo Google Drive, atribui o responsável, acompanha o prazo, registra a execução, entrega o resultado, controla cobrança e pagamento e registra eventuais retrabalhos ou impugnações.

O sistema será independente dos motores de cálculo e poderá apontar para aplicações especializadas como:

- Abono Computum;
- Diferenças Computum;
- Saúde Computum;
- futuros sistemas.

A arquitetura será:

```text
GitHub Pages
      ↓
gestao.computum.com.br
      ↓
Supabase
      ↓
Google Drive privado
```

O projeto será construído dentro de uma identidade visual comum aos produtos Computum, tomando como referências os projetos existentes do CálculoJus e do Saúde Computum.

O objetivo final é que o Gestão seja o **painel central da operação de cálculos judiciais**, mantendo separados os sistemas responsáveis pelos cálculos propriamente ditos.

---

# 18. Baseline implementado — V6

Esta seção registra o estado efetivamente implementado e testado em 27/09/2026. Ela complementa as definições conceituais das seções anteriores.

## 18.1 Hospedagem e repositório

- Repositório GitHub: `cpds13/gestao-computum`
- Branch de produção: `main`
- Hospedagem: GitHub Pages
- Domínio: `https://gestao.computum.com.br`
- Integração GitHub ↔ Supabase configurada.

## 18.2 Autenticação efetivamente implementada

A aplicação utiliza Supabase Auth.

O fluxo de inicialização é:

```text
Supabase Auth
   ↓
recupera sessão
   ↓
consulta public.usuarios pelo UUID do usuário autenticado
   ↓
verifica ativo = true
   ↓
carrega interface
```

O usuário administrativo utilizado nos testes é `gestao@computum.com.br`.

O registro de `public.usuarios` precisa utilizar o mesmo UUID de `auth.users`.

## 18.3 Banco efetivamente utilizado

Além das tabelas previstas originalmente, foi criada a tabela própria de calculistas:

```text
calculistas
├── id
├── nome
├── ativo
├── created_at
└── updated_at
```

A tabela possui índice único case-insensitive para `nome`.

A tabela está protegida por RLS e usuários autenticados possuem as permissões necessárias para a operação atual.

## 18.4 Separação entre usuários e calculistas

Foi definida uma separação funcional importante:

**Usuários (`usuarios`)**

Representam pessoas que podem acessar o Gestão Computum.

**Calculistas (`calculistas`)**

Representam pessoas responsáveis pela execução dos cálculos, sem necessidade de possuir conta ou senha no sistema.

Portanto, Patrick, Ana Clara e Ericka **não precisam ser criados no Supabase Authentication** apenas para aparecerem como calculistas.

## 18.5 Relação da solicitação com o calculista

A coluna `solicitacoes.calculista_id` foi ajustada para referenciar:

```text
public.calculistas(id)
```

em vez de:

```text
public.usuarios(id)
```

O comportamento atual é:

```text
Nova solicitação
      ↓
Calculista selecionado
      ↓
consulta public.calculistas
      ↓
solicitacoes.calculista_id
```

## 18.6 Cadastro atual de calculistas

Os registros ativos atuais são:

1. Patrick
2. Ana Clara
3. Ericka

O formulário de nova solicitação consulta esses registros no Supabase. Os nomes não são mais mantidos como lista fixa no código.

## 18.7 Criação real de solicitação

A função `createRequest()` deixou de utilizar `localStorage` para persistir novas solicitações.

O fluxo atual é:

1. valida campos obrigatórios;
2. localiza ou cria advogado;
3. localiza ou cria cliente;
4. localiza ou cria processo quando informado;
5. localiza área de serviço;
6. localiza ou cria tipo de serviço;
7. localiza calculista na tabela `calculistas`;
8. converte prioridade e tipo de entrega;
9. gera código sequencial anual;
10. insere em `solicitacoes`;
11. registra `CRIACAO` em `historico_solicitacao`;
12. recarrega os dados do Supabase;
13. atualiza a interface.

## 18.8 Testes reais realizados

Foram realizados testes de integração com o projeto Supabase utilizado pelo sistema.

### Teste de autenticação

Resultado: **aprovado**.

Inicialmente o Auth funcionava, mas faltava o registro correspondente em `public.usuarios`. O registro foi criado utilizando o mesmo UUID de `auth.users`, e o carregamento do perfil passou a funcionar.

### Teste de criação de solicitação

Resultado: **aprovado**.

Foi criada a solicitação:

```text
CJ-2026-00001
```

### Teste de calculista

Resultado: **aprovado**.

Foi criada a solicitação:

```text
CJ-2026-00002
```

com:

```text
Calculista: Patrick
```

A listagem da aplicação confirmou o vínculo.

## 18.9 Estado dos documentos

O campo de documento inicial já existe na interface, mas o upload ainda não está conectado ao Google Drive.

Portanto, na V6:

- o campo de seleção de arquivo existe;
- o arquivo ainda não é enviado ao Drive;
- a tabela `arquivos` existe no banco;
- a tabela `pastas_drive` existe no banco;
- a integração OAuth/Google Drive ainda não foi implementada.

## 18.10 Estado do workflow

O banco já possui os status definidos para a operação, mas o workflow completo de alteração de status ainda não foi implementado na interface.

Status definidos:

```text
NOVO
ANALISE
AGUARDANDO_DOCUMENTOS
EM_CALCULO
EM_REVISAO
ENVIADO
AGUARDANDO_PAGAMENTO
CONCLUIDO
IMPUGNACAO
RETRABALHO
PAUSADO
CANCELADO
```

## 18.11 Estado financeiro

A estrutura de pagamentos já existe no banco e a interface possui leitura básica dos valores, mas o CRUD financeiro completo ainda será desenvolvido.

A próxima etapa financeira deverá permitir múltiplos pagamentos por solicitação, saldo e histórico.

## 18.12 Próxima etapa oficial

A integração com Google Drive já faz parte da base consolidada; o próximo requisito estrutural definido é Backup e Restauração GCOMP.

Objetivo:

```text
Nova solicitação
       ↓
Criar pasta no Drive
       ↓
CJ-AAAA-NNNNN
       ├── 01 - Documentos recebidos
       ├── 02 - Cálculos
       ├── 03 - Parecer
       └── 04 - Retrabalho
       ↓
Enviar documento inicial
       ↓
Registrar arquivo no Supabase
       ↓
Registrar pasta no Supabase
```

Credenciais privadas e segredos não deverão ser colocados no frontend GitHub Pages.

---

# V8 — Modelo de documentos com Google Forms + vinculação manual

A integração direta com a Google Drive API não faz parte da implementação imediata.

O recebimento de documentos será dividido em duas modalidades:

- **FORM:** arquivos recebidos por Google Forms;
- **MANUAL:** arquivos ou pastas já existentes no Google Drive vinculados pelo usuário.

Ambas alimentam a mesma área de documentos da solicitação e devem permanecer associadas ao código `CJ-AAAA-NNNNN`.

O detalhamento operacional está em `docs/GOOGLE_DRIVE_FORMS.md`.


### V45 — ajustes funcionais

- Ampliação dos Tipos de Serviço de Servidor Público e Saúde, preservando os tipos existentes.
- `Outro` continua sendo opção especial com detalhamento de até 100 caracteres.
- Código das solicitações pode ser copiado diretamente pelas tabelas.
- Financeiro separado em `Contas a receber` e `Histórico financeiro` para solicitações concluídas.


## Regra consolidada — V51

A função Calculista não é inferida pelo nome. O sistema reconhece a função apenas pelo perfil `calculista` ou por vínculo explícito em `public.calculistas.usuario_id`. Cadastros de calculistas sem vínculo permanecem como registros operacionais/históricos e não concedem acesso ao painel de produção.


### Permissão do perfil Usuário — V51
O perfil Usuário pode consultar os painéis de Advogados, Clientes, Processos, Calculistas e Relatórios. Esses painéis são somente leitura para esse perfil: criação, edição, exclusão e vínculo administrativo permanecem restritos ao Administrador.
---

# 38. Estado consolidado — V58

A **V58** é a versão oficial consolidada após a estabilização das funcionalidades administrativas, operacionais, financeiras, de permissões, navegação mobile e da migração histórica de dados.

## 38.1 Gestão de usuários e permissões

Funcionalidades implementadas e validadas:

- gerenciamento de usuários exclusivamente pelo Administrador;
- criação, edição, ativação e desativação de contas;
- alteração de nome e e-mail preservando o UUID;
- funções Administrador e Calculista podendo coexistir;
- perfil técnico `administrativo` apresentado na interface como **Usuário**;
- proteção contra exclusão do próprio usuário;
- proteção contra exclusão ou desativação do último administrador ativo;
- exclusão segura de usuários sem vínculos históricos;
- bloqueio da exclusão quando existem vínculos ou histórico;
- preservação do histórico mesmo quando a conta é desativada;
- desconexão efetiva de usuário desativado ao atualizar a sessão;
- vínculo explícito entre usuário e cadastro de calculista.

A identificação operacional do calculista utiliza o relacionamento por ID/`usuario_id`. **Nome não é identificador de função ou de vínculo.**

## 38.2 Calculistas

A regra operacional consolidada é:

```text
public.usuarios
       │
       │ usuario_id
       ▼
public.calculistas
       │
       │ calculistas.id
       ▼
solicitacoes.calculista_id
```

O cadastro de calculista sem vínculo válido com um usuário não deve aparecer nas listas de atribuição operacional.

A alteração do nome do usuário calculista atualiza o nome corrente do cadastro vinculado, sem alterar os nomes históricos já registrados nos eventos anteriores.

## 38.3 Solicitações — regra de unicidade

**Uma solicitação nunca é identificada pela combinação de advogado, cliente, área ou tipo de serviço.**

O mesmo:

- advogado pode ter várias solicitações;
- cliente pode ter várias solicitações;
- advogado + cliente pode ter várias solicitações;
- advogado + cliente + área pode ter várias solicitações;
- advogado + cliente + área + tipo de serviço pode inclusive ter mais de uma solicitação.

Cada solicitação é um registro próprio e possui seu próprio `id` e `codigo`.

Na migração histórica, o identificador externo utilizado foi `MIG-xxx`.

Exemplo:

```text
CONDOMÍNIO BAIA DE TOLOUSE
        │
        ├── MIG-068 → Cível → Atualização
        │
        └── MIG-069 → Cível → Taxas de condomínio
```

O cliente é compartilhado quando é o mesmo cadastro, mas as solicitações permanecem independentes.

Essa regra deve ser preservada em qualquer futura importação, migração, consulta ou funcionalidade de deduplicação.

## 38.4 Migração histórica consolidada

Em 01/10/2026 foi realizada a migração histórica para a Gestão Computum.

Resultado consolidado:

| Indicador | Resultado |
|---|---:|
| Solicitações migradas | **82** |
| Total cobrado | **R$ 14.850,00** |
| Total recebido | **R$ 13.800,00** |
| Saldo a receber | **R$ 1.050,00** |
| Pagamentos registrados | **77** |
| Forma dos pagamentos migrados | **PIX** |

Regra de status utilizada na migração:

- com pagamento registrado → `CONCLUIDO`;
- sem pagamento registrado → `AGUARDANDO_PAGAMENTO`.

Datas desconhecidas não foram inventadas.

As datas de entrega que eventualmente forem recuperadas posteriormente poderão ser atualizadas sem refazer a migração. Datas de pagamento desconhecidas devem permanecer sem preenchimento até que sejam comprovadas.

### Identificador da migração

Os registros históricos possuem código `MIG-xxx`, preservado como identificador operacional da migração.

O código não substitui o UUID interno da solicitação.

## 38.5 Financeiro

O financeiro consolidado da V58 utiliza:

```text
SOLICITAÇÕES
      +
PAGAMENTOS
      +
RETRABALHOS
```

Indicadores principais:

- faturado;
- recebido;
- a receber;
- em atraso.

Uma solicitação pode possuir múltiplos pagamentos. O saldo é calculado a partir dos valores efetivamente registrados.

Os pagamentos históricos migrados foram registrados como **PIX**.

## 38.6 Histórico e auditoria

Eventos relevantes devem preservar o contexto histórico do momento em que ocorreram.

Quando uma pessoa altera posteriormente seu nome ou e-mail:

- novos eventos usam os dados atuais;
- eventos antigos preservam os dados históricos registrados na época.

A alteração do cadastro atual não deve reescrever a autoria histórica.

## 38.7 Navegação mobile

A navegação mobile foi estabilizada.

Em telas com largura inferior a aproximadamente 801px:

1. o menu lateral pode ser aberto normalmente;
2. qualquer item de navegação fecha imediatamente o menu;
3. isso também ocorre quando o usuário toca na tela que já está aberta;
4. a regra se aplica a Dashboard, Solicitações e demais itens;
5. a correção não altera permissões, autenticação ou regras de negócio.

## 38.8 Segurança e banco

A estrutura consolidada utiliza:

- Supabase Auth;
- PostgreSQL;
- Row Level Security;
- Edge Function para operações administrativas sensíveis;
- vínculo por UUID entre usuários e entidades relacionadas;
- histórico operacional;
- proteção contra exclusões indevidas.

As migrations consolidadas existentes permanecem como parte da estrutura do projeto:

```text
001_initial_schema.sql
002_calculistas.sql
003_documentos_forms_manual.sql
004_calculistas_usuarios.sql
005_encerramento_financeiro.sql
006_tipo_servico_detalhamento.sql
007_tipos_servico_areas.sql
008_gestao_usuarios.sql
009_permissoes_usuario_operacional.sql
010_paineis_usuario_somente_leitura.sql
011_exclusao_segura_usuarios.sql
```

**Não executar novamente migrations já aplicadas.**

---

# 39. Backup e restauração — requisito definido para a próxima versão

A próxima alteração estrutural planejada será o sistema próprio de **Backup e Restauração**.

O Supabase continuará sendo o **banco principal**. O objetivo não é substituir o Supabase, mas criar uma cópia independente e recuperável dos dados da Gestão Computum.

## 39.1 Formato oficial

O formato será:

```text
GES-COMPUTUM-DDMMAAAAHHMMSS.gcomp
```

Exemplo:

```text
GES-COMPUTUM-01102026010235.gcomp
```

A extensão `.gcomp` representa o formato próprio do Gestão Computum.

Internamente, o arquivo será um **JSON estruturado**.

## 39.2 Conteúdo do GCOMP

O backup deverá preservar, conforme aplicável:

- usuários;
- advogados;
- clientes;
- processos;
- áreas;
- tipos de serviço;
- calculistas;
- solicitações;
- pagamentos;
- retrabalhos;
- histórico;
- arquivos/metadados vinculados;
- IDs e relacionamentos necessários;
- metadados do próprio backup.

O arquivo deverá conter, no mínimo:

```text
formato
versao_formato
sistema
versao_sistema
data_backup
quantidades
dados
```

## 39.3 Versão do formato

O formato GCOMP terá versionamento próprio e independente da versão do sistema.

Exemplo:

```text
GCOMP 1
GCOMP 2
```

Uma nova versão da Gestão não deverá inutilizar automaticamente backups antigos.

Quando houver mudança estrutural, o sistema deverá identificar a versão do formato e, quando possível, executar a migração necessária antes da restauração.

## 39.4 Exportação

A área **Configurações → Backup e Restauração** deverá oferecer:

**Exportar backup completo**

O arquivo será baixado com o nome:

```text
GES-COMPUTUM-DDMMAAAAHHMMSS.gcomp
```

A exportação deve ser independente do formato de apresentação utilizado em Excel ou outros relatórios.

## 39.5 Importação e restauração

A importação deverá ocorrer em etapas:

```text
Selecionar GCOMP
       ↓
Ler arquivo
       ↓
Validar formato
       ↓
Validar versão
       ↓
Validar estrutura
       ↓
Validar IDs e relacionamentos
       ↓
Mostrar prévia
       ↓
Confirmar restauração
       ↓
Restaurar em transação
```

A validação deverá identificar, entre outros:

- arquivo inválido;
- versão incompatível;
- IDs duplicados;
- códigos duplicados;
- referências inexistentes;
- pagamentos sem solicitação;
- solicitações com relações inválidas;
- conflitos com dados atuais.

## 39.6 Princípio transacional

A restauração deve ser **atômica**:

> ou todos os dados válidos são restaurados, ou nenhuma alteração permanece.

Não deve existir restauração parcialmente concluída por causa de um erro no meio do processo.

## 39.7 Backup antes da restauração

Antes de uma restauração que possa alterar dados existentes, o sistema deverá oferecer a possibilidade de gerar um backup do estado atual.

Fluxo previsto:

```text
Backup atual
     ↓
Validação do GCOMP
     ↓
Prévia
     ↓
Confirmação
     ↓
Restauração
```

## 39.8 GCOMP x Excel

Os dois formatos terão finalidades diferentes.

### GCOMP

Uso principal:

- backup;
- restauração;
- preservação de IDs;
- preservação de relacionamentos;
- recuperação de banco.

### Excel

Uso principal:

- análise;
- conferência;
- edição de dados;
- migrações controladas;
- relatórios;
- intercâmbio de dados tabulares.

Excel não deve ser tratado como substituto do backup GCOMP.

## 39.9 Escopo da próxima implementação

A primeira implementação do GCOMP deverá priorizar:

1. exportação integral;
2. importação integral;
3. validação;
4. prévia;
5. restauração transacional;
6. preservação dos relacionamentos;
7. compatibilidade por versão do formato.

Importações parciais, restauração seletiva por tabela e outras funções avançadas poderão ser adicionadas posteriormente.

**O GCOMP é um requisito definido, mas ainda não deve ser descrito como funcionalidade implementada na V58.**

---

# 40. Regra de versionamento do projeto

O Gestão Computum utiliza **versionamento sequencial inteiro**.

A cada nova versão oficial:

```text
V57
↓
V58
↓
V59
↓
V60
...
```

Não utilizar versões intermediárias como:

```text
V58.1
V58.2
V57.1
```

Correções feitas durante o desenvolvimento de uma versão podem ser incorporadas à mesma versão enquanto ela ainda não tiver sido considerada oficialmente encerrada. Uma nova versão oficial somente deve receber o próximo número inteiro.

A V58 é a versão oficial atual.

A próxima alteração funcional planejada, Backup e Restauração GCOMP, será **V59** quando efetivamente implementada.

---

# 41. Estado atual do projeto

Em 01/10/2026, o Gestão Computum possui como base consolidada:

```text
Frontend
    ↓
Gestão Computum
    ↓
Supabase Auth
    ↓
PostgreSQL / Supabase
    ↓
Google Drive / Google Forms
    ↓
Sistemas especializados Computum
```

O Supabase permanece como banco principal.

O Google Drive permanece como repositório privado de documentos.

O Gestão Computum permanece como centro administrativo e operacional, não como motor matemático dos cálculos.

O formato GCOMP será a camada independente de backup e recuperação, sem substituir o Supabase.

# 42. V59 — Pesquisa e abertura segura de solicitações

A V59 corrige dois comportamentos da tela **Solicitações** identificados durante a validação da V58:

- a pesquisa não reconstrói mais toda a página a cada caractere digitado; somente a lista filtrada e o contador de resultados são atualizados, preservando o foco do campo;
- uma solicitação só é aberta ao clicar no **código** da solicitação; as demais células da linha não funcionam como área de abertura, reduzindo aberturas acidentais e alterações indevidas.

A regra se aplica à tabela principal de solicitações em desktop e mobile.


## 42. V60 — Apresentação do código nas solicitações

A tabela de Solicitações exibe o código apenas uma vez. O próprio código é a ação para abrir a solicitação e o ícone de cópia permanece como ação independente. As demais colunas da linha não abrem a solicitação, reduzindo aberturas acidentais, especialmente em telas sensíveis ao toque.

A correção da pesquisa da V59 é preservada: o campo de pesquisa mantém o foco durante a digitação e a atualização dos resultados não recria o input.


# 42. V61 — Ajuste financeiro excepcional

A V61 introduz uma forma protegida de corrigir o valor cobrado de uma solicitação já encerrada financeiramente.

- disponível exclusivamente para Administradores;
- não é apresentado como botão comum de edição;
- acesso por `Ctrl + Shift + E` (ou `Cmd + Shift + E`);
- funciona quando uma solicitação concluída está aberta;
- exige novo valor;
- exige motivo obrigatório;
- apresenta uma confirmação final;
- não altera automaticamente os pagamentos já registrados;
- recalcula o valor financeiro da solicitação;
- registra o ajuste em `historico_solicitacao` como `AJUSTE_FINANCEIRO`;
- a operação é executada de forma atômica por função PostgreSQL protegida por verificação de administrador.

A V60 permanece a base anterior; a V61 é a versão oficial após esta implementação.


# 43. V62 — Correção do atalho financeiro

O atalho `Ctrl + Shift + E` foi ajustado para funcionar enquanto o drawer da solicitação estiver aberto, inclusive quando o foco estiver em campos editáveis do formulário. O contexto do drawer substitui a antiga restrição que bloqueava atalhos disparados a partir de `input`, `textarea` ou `select`.

A restrição de Administrador e as proteções do modal financeiro permanecem.

### V62 — comportamento da aba Financeiro

Na aba Financeiro, as linhas de Contas a receber e Histórico financeiro não são mais clicáveis integralmente. Assim como em Solicitações, somente o código da solicitação abre o drawer; o ícone ao lado apenas copia o código.

### Fluxo do ajuste financeiro na V62

Ao editar uma solicitação concluída, o campo `Valor cobrado` permanece bloqueado para edição direta. Para Administradores, clicar nesse campo abre o modal de ajuste financeiro excepcional. O atalho `Ctrl + Shift + E` permanece como alternativa.

### V63 — consulta financeira e ajuste protegido

A aba Financeiro possui filtros por pesquisa, status e área. A pesquisa permite localizar trabalhos por código, advogado, cliente, processo ou serviço e exibe os totais correspondentes ao conjunto filtrado.

O ajuste financeiro excepcional continua exclusivo para Administradores. Em solicitações concluídas, o campo de valor permanece bloqueado e o acesso ao ajuste é indicado por um cadeado discreto. O atalho `Ctrl + Shift + E` continua disponível quando o drawer da solicitação estiver aberto, inclusive quando a solicitação foi acessada pela aba Financeiro.

### V64 — indicadores financeiros e bloqueio do valor

A aba Financeiro apresenta indicadores compactos de Faturado, Recebido, A receber e Em atraso. A escala visual é deliberadamente menor que a do Dashboard.

Em solicitações concluídas, `Valor cobrado` permanece somente leitura. Clicar no campo não abre qualquer modal. Para Administradores, o ajuste financeiro excepcional é acessado pelo cadeado ao lado do campo ou pelo atalho `Ctrl + Shift + E`.

### V65 — menu e formulários mobile

No mobile, o menu lateral utiliza um overlay próprio e um fluxo único de navegação: o item recebe o toque, executa a navegação e somente então o menu é fechado. O conteúdo atrás do menu não recebe interação enquanto ele estiver aberto. A largura máxima do menu é 280px.

Formulários e drawers no mobile usam largura disponível, `box-sizing: border-box`, proteção contra overflow horizontal e grids de uma coluna. A identidade visual permanece a mesma.
\n\n### V66 — navegação mobile com menu fixo\n\nNo mobile, o menu lateral permanece fixo e sobreposto ao conteúdo, sem bloquear a área de conteúdo com um overlay de captura. A seleção de uma opção navega diretamente para a view correspondente, mantendo o menu aberto. O botão `«` recolhe o menu; no estado recolhido, o mesmo controle permite expandi-lo novamente.\n