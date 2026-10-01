# Manual do Gestão Computum

**Versão:** 0.10  
**Data:** 29/09/2026  
**Status:** Em desenvolvimento  
**Fonte:** documentação funcional oficial do projeto

> Este documento é a referência oficial de uso do Gestão Computum. A cada etapa funcional concluída, o manual deve ser revisado e atualizado antes de a etapa ser considerada encerrada.

---

## 1. Finalidade do sistema

O **Gestão Computum** é o sistema operacional da rotina de cálculos judiciais. Seu objetivo é controlar o trabalho desde a entrada da solicitação até a entrega, o recebimento e o encerramento administrativo.

O sistema organiza:

- solicitações;
- advogados;
- clientes;
- processos;
- serviços;
- documentos;
- calculistas;
- prazos e prioridades;
- revisão;
- entrega;
- pagamentos;
- retrabalhos e impugnações;
- histórico da operação;
- origem das demandas;
- vínculo com sistemas especializados.

O Gestão Computum **não é o motor de cálculo**. Os cálculos são executados nos sistemas especializados vinculados ao serviço.


### Estado funcional da versão 0.7

As etapas atualmente validadas incluem:

- Tipo de Serviço carregado conforme a Área diretamente do Supabase;
- opção `Outro` com especificação livre de até 100 caracteres;
- tipos `Rest. acima TETO` e `Recomposição IR` em Tributário;
- fluxo `ENVIADO → AGUARDANDO_PAGAMENTO`;
- múltiplos recebimentos e recebimentos parciais;
- conclusão financeira somente quando o saldo chega a zero;
- organização de documentos por Google Forms + Apps Script + Google Drive privado;
- pasta financeira `05 - Financeiro`;
- Dashboard com contagem real de retrabalhos registrada em `public.retrabalhos` e exibida no KPI do Dashboard.


---

## 2. Perfis de usuário

### 2.1 Administrador

O administrador controla o ciclo completo da solicitação.

Responsabilidades principais:

- receber e cadastrar solicitações;
- conferir dados e documentos;
- administrar advogados, clientes e processos;
- atribuir solicitações aos calculistas;
- acompanhar produção e prazos;
- realizar ou coordenar a revisão;
- registrar a entrega;
- acompanhar pagamentos;
- encerrar solicitações;
- acompanhar retrabalho, impugnações e histórico;
- administrar cadastros e configurações.

### 2.2 Calculista

O calculista atua na produção dos trabalhos que lhe foram atribuídos.

Responsabilidades principais:

- consultar suas solicitações;
- analisar documentos e orientações;
- executar o cálculo no sistema especializado correspondente;
- registrar o início da produção;
- concluir a produção técnica;
- enviar o trabalho para revisão;
- atender eventuais devoluções para retrabalho.

O calculista **não encerra financeiramente a solicitação**. A entrega, o acompanhamento do pagamento e o status `CONCLUÍDO` são etapas administrativas.

### 2.3 Administrador que também é Calculista

As funções não são mutuamente exclusivas. Um mesmo usuário pode ser administrador e também atuar como calculista. Nesse caso:

- mantém acesso administrativo ao sistema;
- possui a opção **Minha produção**;
- pode receber solicitações atribuídas ao seu cadastro de calculista;
- executa as etapas de produção até `EM_REVISÃO`;
- continua responsável pelas atividades administrativas permitidas ao seu perfil.

A identificação operacional é feita pelo vínculo explícito do cadastro de calculista com o usuário autenticado. Cadastros históricos podem ter sido relacionados por nome em migrações antigas, mas **o nome isoladamente nunca concede a função Calculista**. Para acesso atual, deve existir perfil `calculista` ou vínculo em `public.calculistas.usuario_id`.

### 2.4 Vinculação de acesso

O cadastro operacional do calculista e a conta de acesso são entidades relacionadas, mas distintas. No módulo **Calculistas**, o administrador pode vincular um usuário existente ao cadastro do profissional.

Essa separação permite que: 

- um calculista tenha uma conta de acesso;
- um administrador também seja calculista;
- um mesmo usuário não precise de duas contas para exercer as duas funções.

A conta precisa existir no Supabase Auth e na tabela `public.usuarios` antes de ser vinculada.

---

## 3. Identificação visual dos status

As etiquetas de status utilizam cores diferentes para facilitar a leitura do fluxo. A cor não substitui o texto do status; ela funciona como um sinal visual complementar.

| Status | Cor visual | Significado operacional |
|---|---|---|
| **NOVO** | Azul claro | Solicitação recém-cadastrada e ainda não iniciada. |
| **ANÁLISE** | Índigo | Demanda em conferência administrativa. |
| **AGUARDANDO DOCUMENTOS** | Âmbar | A produção depende de documentação pendente. |
| **EM CÁLCULO** | Azul | Produção técnica em andamento. |
| **EM REVISÃO** | **Amarelo/âmbar** | Cálculo produzido e aguardando conferência administrativa. |
| **ENVIADO** | Azul acinzentado | Cálculo aprovado e entregue ao solicitante. |
| **AGUARDANDO PAGAMENTO** | Roxo | Entrega realizada, aguardando recebimento. |
| **CONCLUÍDO** | **Verde** | Serviço encerrado administrativamente após as etapas previstas. |
| **IMPUGNADO** | Vermelho | Houve impugnação ou ocorrência que exige tratamento específico. |
| **RETRABALHO** | Terracota | Trabalho retornado para correção ou nova execução. |
| **PAUSADO** | Cinza | Fluxo temporariamente interrompido. |
| **CANCELADO** | Cinza escuro | Solicitação encerrada sem continuidade. |

### Regra visual importante

- **Verde é reservado para `CONCLUÍDO`.**
- **Amarelo/âmbar identifica `EM REVISÃO` e situações de espera que exigem atenção.**
- **Azul identifica produção ou estados informativos.**
- **Vermelho identifica ocorrência problemática ou excepcional.**
- **Terracota identifica retrabalho.**
- **Cinza identifica estados interrompidos ou cancelados.**

A interface deve manter essa convenção em tabelas, painéis, detalhes, kanban e demais pontos em que o status seja exibido.

---

## 3. Ciclo de vida de uma solicitação

Fluxo operacional principal:

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

### 3.1 NOVO

A solicitação foi registrada e ainda precisa ser analisada ou encaminhada para a próxima etapa.

### 3.2 ANÁLISE

A demanda está sendo conferida quanto a dados, documentos, serviço, prazo e condições de execução.

### 3.3 AGUARDANDO DOCUMENTOS

A produção não pode avançar porque existem documentos ou informações necessários ainda não recebidos.

### 3.4 EM CÁLCULO

A solicitação está em produção técnica. É a principal etapa de execução do calculista.

### 3.5 EM REVISÃO

A produção foi finalizada pelo calculista e aguarda conferência.

### 3.6 ENVIADO

O resultado do trabalho foi entregue ao solicitante. Entrega e pagamento são eventos diferentes.

### 3.7 AGUARDANDO PAGAMENTO

O serviço foi entregue e existe valor pendente de recebimento.

### 3.8 CONCLUÍDO

O serviço foi encerrado administrativamente após a entrega e a confirmação do recebimento conforme o fluxo financeiro adotado.

### 3.9 Fluxos excepcionais

O sistema também contempla:

- `IMPUGNAÇÃO` — ocorrência relacionada a questionamento posterior da entrega;
- `RETRABALHO` — necessidade de nova produção ou ajuste;
- `PAUSADO` — atividade temporariamente interrompida;
- `CANCELADO` — solicitação encerrada sem conclusão do fluxo normal.

---

## 4. Fluxo de responsabilidades

A divisão entre gestão e produção deve permanecer clara:

```text
ADMINISTRADOR
    ↓
Recebe / analisa / organiza
    ↓
Atribui ao calculista
    ↓
CALCULISTA
    ↓
Em cálculo
    ↓
Em revisão
    ↓
ADMINISTRADOR / REVISOR
    ↓
Enviado
    ↓
Aguardando pagamento
    ↓
Concluído
```

O calculista pode executar a produção e enviá-la para revisão, mas não deve marcar a solicitação como `CONCLUÍDO` apenas porque terminou o arquivo de cálculo.

---

## 5. Administrador — operação

### 5.1 Receber uma solicitação

Conferir ou cadastrar:

- advogado;
- cliente;
- processo;
- área;
- tipo de serviço;
- documentos;
- prazo;
- prioridade;
- valor;
- origem;
- observações.

### 5.2 Analisar a demanda

Verificar se a solicitação está suficientemente documentada para produção. Se faltar documentação, utilizar `AGUARDANDO_DOCUMENTOS`.

Quando estiver pronta, atribuir ao calculista e encaminhar para produção.

### 5.3 Atribuir ao calculista

O administrador seleciona o profissional responsável pela produção. A solicitação passa a aparecer no painel de produção desse calculista.

### 5.4 Acompanhar a produção

O administrador acompanha:

- calculista responsável;
- status;
- prazo;
- prioridade;
- documentos;
- histórico;
- sistema especializado;
- situação financeira.

### 5.5 Revisar e entregar

Quando a solicitação entra em `EM_REVISAO`, o administrador/revisor dispõe de duas ações:

- **Aprovar e marcar como enviado** — registra o usuário revisor e a data de envio e altera o status para `ENVIADO`;
- **Devolver para cálculo** — retorna a solicitação para `EM_CALCULO` e exige um motivo para que o calculista saiba o que precisa ser ajustado.

As duas ações ficam registradas no histórico da solicitação. O usuário Patrick, por possuir as funções Administrador e Calculista, pode revisar inclusive cálculos produzidos por ele próprio.

### 5.6 Acompanhar pagamento

Depois da entrega, a solicitação pode permanecer em `AGUARDANDO_PAGAMENTO` até que o recebimento seja registrado.

### 5.7 Encerrar

Após a confirmação do recebimento, a solicitação pode ser encerrada como `CONCLUÍDO`.

---

## 6. Calculista — operação

### 6.1 Minha produção

O painel **Minha produção** apresenta somente as solicitações atribuídas ao profissional correspondente. Usuários que também são administradores podem acessar esse painel sem perder o acesso administrativo.

Os principais indicadores são:

- **Novas** — solicitações atribuídas ainda não iniciadas;
- **Em cálculo** — trabalhos em produção;
- **Em revisão** — trabalhos enviados para conferência;
- **Atrasadas** — trabalhos cujo prazo já foi ultrapassado e que ainda estão abertos;
- **Concluídas** — histórico da produção atribuída ao calculista.

### 6.2 Receber a demanda

Antes de iniciar, conferir:

- cliente;
- processo;
- serviço;
- área;
- prazo;
- prioridade;
- orientações;
- documentos;
- sistema especializado indicado.

### 6.3 Iniciar o cálculo

Ao iniciar efetivamente a produção, utilizar `EM_CÁLCULO`.

### 6.4 Executar o trabalho

Os documentos são consultados no Google Drive privado. O cálculo é realizado no sistema especializado correspondente ao serviço.

### 6.5 Enviar para revisão

Quando a produção estiver pronta, alterar para `EM_REVISÃO`.

Essa ação representa o término da **produção técnica**, não o encerramento do serviço.

### 6.6 Devolução para retrabalho

Se o trabalho retornar para ajuste, a solicitação poderá voltar ao fluxo de produção conforme a ocorrência registrada pelo administrador ou revisor.

---

## 7. Documentos e Google Drive

Os documentos permanecem em uma estrutura privada do Google Drive.

Estrutura definida:

```text
Computum
└── Gestão
    └── CJ-2026-xxxxx
        ├── 01 - Documentos recebidos
        ├── 02 - Cálculos
        ├── 03 - Parecer
        └── 04 - Retrabalho
```

O Google Forms recebe os documentos e o Apps Script organiza os arquivos na pasta da solicitação. O Gestão mantém o vínculo com a pasta para acesso rápido.

Os arquivos não devem ser tornados públicos apenas para permitir o funcionamento do fluxo.

---

## 8. Sistemas especializados

O Gestão Computum funciona como ponto de controle e encaminhamento.

Exemplos de sistemas especializados:

- Abono Computum — `abono.computum.com.br`;
- Diferenças Computum — `diferencas.computum.com.br`;
- Saúde Computum — `saude.computum.com.br`.

A solicitação pode indicar o sistema correspondente. Inicialmente, o vínculo é realizado por URL; integração automática poderá ser adicionada em etapas futuras.

---

## 9. Histórico

As mudanças relevantes devem permanecer registradas no histórico da solicitação, permitindo acompanhar:

- evento;
- descrição;
- usuário responsável;
- data e hora.

O histórico é parte da rastreabilidade operacional do serviço.

---

## 9.1 Tipo de Serviço

O campo **Tipo de Serviço** é carregado conforme a Área selecionada e utiliza os registros existentes em `public.tipos_servico`.

Quando o tipo selecionado for **Outro**, o sistema apresenta o campo **Especifique o tipo de serviço**, com limite de 100 caracteres. A especificação é armazenada em `solicitacoes.tipo_servico_outro` e exibida junto ao tipo.

Na área **Tributário**, os tipos atualmente previstos incluem:

- Atualização;
- Cálculo tributário;
- Rest. acima TETO;
- Recomposição IR;
- Outro.

Os cadastros existentes de Área e Tipo de Serviço não devem ser substituídos ou apagados para implementar esse detalhamento.

---

## 10. Financeiro

O financeiro acompanha o valor cobrado, os recebimentos registrados e o saldo pendente.

A sequência operacional é:

```text
Valor do serviço
      ↓
Entrega
      ↓
AGUARDANDO_PAGAMENTO
      ↓
Um ou mais recebimentos
      ↓
Saldo = 0
      ↓
CONCLUÍDO
```

### 10.1 Recebimentos parciais

Uma solicitação pode receber vários pagamentos.

Exemplo:

```text
Valor do serviço: R$ 5.000,00

Recebimento 1: R$ 3.000,00
Saldo:         R$ 2.000,00
Status:        AGUARDANDO_PAGAMENTO

Recebimento 2: R$ 1.000,00
Saldo:         R$ 1.000,00
Status:        AGUARDANDO_PAGAMENTO

Recebimento 3: R$ 1.000,00
Saldo:         R$ 0,00
Status:        CONCLUÍDO
```

Cada recebimento permanece como registro independente em `public.pagamentos`. O saldo é calculado a partir do total acumulado.

A solicitação **não deve ser concluída enquanto existir saldo pendente**.

### 10.2 Dados registrados

Cada recebimento pode registrar:

- valor recebido;
- data do recebimento;
- conta de recebimento;
- forma de pagamento;
- recibo emitido ou não;
- número/identificação do recibo;
- data do recibo;
- informações do recibo;
- link do recibo no Google Drive.

### 10.3 Regra de encerramento

A solicitação não deve ser marcada manualmente como `CONCLUÍDO` no cadastro comum.

O encerramento ocorre pelo fluxo financeiro quando:

1. a solicitação está em `AGUARDANDO_PAGAMENTO`;
2. um recebimento é registrado;
3. o saldo pendente chega a zero.

O calculista não encerra financeiramente a solicitação.

### 10.4 Google Drive financeiro

O recibo deve ser armazenado na pasta privada da solicitação, preferencialmente em:

`05 - Financeiro`

A pasta da solicitação permanece sujeita às permissões privadas do Google Drive.

---

## 11. Retrabalho e impugnação

Retrabalho e impugnação são situações posteriores ou excepcionais e devem permanecer vinculados à solicitação original, preservando o histórico do serviço.

A operação de retrabalho deve permitir distinguir:

- motivo;
- responsável;
- data;
- necessidade de nova produção;
- eventual cobrança;
- resultado.

Detalhamentos adicionais serão incorporados ao manual conforme o módulo de retrabalho for concluído.

---

## 12. Regra de documentação do projeto

Este manual acompanha a evolução do sistema.

Sempre que uma etapa funcional for finalizada:

1. implementar;
2. testar;
3. validar;
4. atualizar este manual;
5. registrar a alteração no histórico de versões;
6. considerar a etapa concluída.

A documentação do repositório e a ajuda contextual da aplicação devem permanecer coerentes com o comportamento efetivamente validado.

---


## 13. Manual dentro do sistema

A documentação interna do Gestão Computum deve funcionar como uma **central de documentação**, e não apenas como uma página longa de texto.

A interface do manual é organizada em capítulos internos, com conteúdo filtrado de acordo com o perfil do usuário.

### 13.1 Capítulos

Os capítulos previstos são:

- **Visão geral** — finalidade, perfis e regras de documentação;
- **Operação** — solicitações, atribuição, acompanhamento e cadastros;
- **Minha produção** — procedimentos específicos do calculista;
- **Fluxo de trabalho** — significado e responsabilidade de cada status;
- **Revisão** — aprovação, devolução, justificativa e novo ciclo;
- **Usuários** — perfis, permissões, cadastro, ativação e alteração de e-mail;
- **Financeiro** — valores, pagamentos e encerramento;
- **Documentos** — Google Forms, Google Drive e organização dos arquivos;
- **Integrações** — Supabase, Google e sistemas especializados;
- **Histórico** — rastreabilidade e auditoria.

O conteúdo deve ser apresentado somente quando fizer sentido para o perfil. O administrador vê os capítulos administrativos; o calculista vê os capítulos relacionados à produção; o usuário Administrador + Calculista pode consultar ambos.

### 13.2 Busca no manual

O manual deve possuir busca interna para localizar rapidamente procedimentos como:

- devolver cálculo;
- enviar para revisão;
- usuário;
- alteração de e-mail;
- pagamento;
- Google Drive;
- histórico.

A busca filtra os tópicos do capítulo atualmente selecionado.

### 13.3 Ajuda contextual

As páginas operacionais podem possuir um botão discreto de **Como funciona esta área**. Essa ajuda é complementar ao manual e explica somente a função da tela atual.

O tutorial contextual não substitui a documentação completa.

### 13.4 Regra de atualização

Sempre que uma funcionalidade for concluída, a documentação correspondente deve ser atualizada na mesma etapa. O manual não deve descrever comportamento que ainda não foi validado no sistema.

---

## 14. Revisão e devolução — documentação operacional

A revisão possui dois resultados principais:

### Aprovar

```text
EM REVISÃO
    ↓
Aprovar e marcar como enviado
    ↓
ENVIADO
```

A aprovação deve registrar o revisor e a data de envio.

### Devolver

```text
EM REVISÃO
    ↓
Devolver para cálculo
    ↓
Motivo obrigatório
    ↓
EM CÁLCULO
```

O motivo da devolução deve:

- ser obrigatório;
- ficar registrado no histórico;
- identificar quem realizou a devolução;
- permitir que o calculista saiba o que precisa corrigir;
- permanecer disponível para rastreabilidade mesmo após uma nova revisão.

Depois da correção:

```text
EM CÁLCULO
    ↓
Enviar para revisão
    ↓
EM REVISÃO
```

A nova revisão não deve apagar os eventos anteriores.

---

## 15. Gestão de usuários — requisitos documentados

A Gestão Computum deverá possuir uma área administrativa de **Usuários** para permitir que o administrador gerencie os acessos sem depender de alterações manuais no banco.

### 15.1 Cadastro

O cadastro deverá permitir, no mínimo:

- nome;
- e-mail de acesso;
- perfil;
- situação ativo/inativo;
- vínculo com calculista, quando aplicável.

### 15.2 Perfis

O sistema deve permitir:

- Administrador;
- Calculista;
- Administrador + Calculista.

As funções acumuladas não devem exigir duas contas para a mesma pessoa.

### 15.3 Alteração de e-mail

A alteração de e-mail deverá preservar o mesmo usuário e seus vínculos. Não deve ser necessário excluir a conta e criar outra apenas para trocar o e-mail.

Devem ser preservados:

- identificador do usuário;
- permissões;
- vínculo como calculista;
- solicitações relacionadas;
- histórico;
- demais registros vinculados.

A operação de alteração do e-mail de autenticação deve utilizar o mecanismo apropriado do provedor de autenticação, sem expor credenciais administrativas no navegador.

### 15.4 Ativação e desativação

Desativar um usuário deve impedir novo acesso sem apagar seu histórico ou suas relações com solicitações anteriores.

### 15.5 Painel Gerenciar usuários

A partir da V46, o administrador deve utilizar o menu **Usuários** do Gestão Computum para administrar as contas. O objetivo é retirar do fluxo cotidiano a necessidade de editar manualmente `auth.users` e `public.usuarios` no Supabase.

Na lista de usuários, o administrador visualiza:

- nome;
- e-mail;
- funções;
- cadastro de calculista vinculado;
- situação ativa/inativa;
- identificador do usuário.

A ação **Editar** permite alterar o nome, o e-mail, as funções, o vínculo como calculista e a situação da conta.

### 15.6 Funções acumuladas

As funções são tratadas separadamente:

- **Administrador:** define acesso às rotinas administrativas;
- **Calculista:** é reconhecido pelo perfil `calculista` ou por vínculo explícito do usuário com um cadastro em `public.calculistas.usuario_id`;
- **Administrador + Calculista:** o mesmo usuário pode possuir as duas funções, sem necessidade de duas contas.

Quando a função Calculista é marcada e não existe cadastro vinculado, o sistema pode criar ou reaproveitar um cadastro pelo nome. O administrador também pode escolher um cadastro de calculista existente. Depois que a função é retirada, um cadastro histórico sem `usuario_id` não devolve automaticamente a permissão Calculista ao usuário.

### 15.7 Criar uma nova conta

Use **Usuários → Adicionar usuário**.

Informe:

1. nome;
2. e-mail;
3. senha inicial com pelo menos 8 caracteres;
4. uma ou ambas as funções;
5. cadastro de calculista, quando aplicável;
6. situação da conta.

A criação é executada pela rotina administrativa segura do Supabase. A senha inicial é utilizada somente para criar a conta e não é armazenada pelo Gestão Computum.

### 15.8 Alterar o e-mail

Abra **Usuários → Editar**. Altere o e-mail e salve.

A operação mantém o mesmo identificador da conta. Devem permanecer preservados:

- permissões;
- vínculo como calculista;
- solicitações atribuídas ou relacionadas;
- histórico;
- demais referências ao usuário.

Não se deve excluir a conta para trocar o e-mail.

### 15.9 Usuário já existente no Supabase Auth

Contas criadas anteriormente diretamente no Supabase Auth podem existir sem um registro correspondente em `public.usuarios`. A migration **008_gestao_usuarios.sql** sincroniza essas contas e cria um perfil inicial `administrativo`.

Depois da sincronização, o administrador entra em **Usuários**, localiza a pessoa e define as funções adequadas.

Exemplo: se `carlos.patrick@hotmail.com` já estiver em `auth.users`, não deve ser criada uma segunda conta. O registro existente deve ser configurado pelo painel e receber **Administrador**, **Calculista** ou as duas funções.

### 15.10 Implantação técnica do módulo

A implantação desta etapa exige duas ações no projeto Supabase:

1. executar `supabase/migrations/008_gestao_usuarios.sql` no SQL Editor;
2. publicar a Edge Function `supabase/functions/gerenciar-usuario`.

A Edge Function utiliza a `service_role` somente no ambiente seguro do Supabase. Essa chave **não pode** ser colocada no `app.js`, `supabase-client.js` ou em qualquer arquivo público do frontend.

Exemplo com Supabase CLI:

```bash
supabase functions deploy gerenciar-usuario
```

Depois da implantação, testar no Gestão Computum:

- abrir **Usuários**;
- editar um usuário existente;
- alterar uma função;
- verificar o vínculo com Calculista;
- alterar o e-mail em uma conta de teste;
- criar uma nova conta;
- confirmar o login da nova conta.

### 15.11 Regra de proteção administrativa

O sistema deve manter pelo menos um administrador ativo. A rotina de gerenciamento bloqueia uma alteração que deixaria o projeto sem nenhum administrador ativo.

---

## 16. Cores e significado dos status

Os status devem ser visualmente distinguíveis e não depender apenas do texto.

| Status | Significado visual esperado |
|---|---|
| Novo | Azul |
| Análise | Azul |
| Aguardando documentos | Âmbar |
| Em cálculo | Azul-petróleo |
| **Em revisão** | **Amarelo/âmbar** |
| Enviado | Azul-escuro |
| Aguardando pagamento | Âmbar |
| **Concluído** | **Verde** |
| Impugnação | Vermelho |
| Retrabalho | Terracota |
| Pausado | Cinza |
| Cancelado | Cinza escuro |

A finalidade das cores é permitir leitura rápida da situação sem substituir o texto do status.

---

## Histórico de atualizações

| Versão | Data | Alteração |
|---|---|---|
| 0.5 | 29/09/2026 | Reestruturação do manual interno em capítulos/abas; inclusão de busca; documentação detalhada do fluxo de revisão e devolução; requisitos da futura Gestão de Usuários; regras de cores dos status e ajuda contextual. |
| 0.8 | 29/09/2026 | Atualização para o estado funcional da V42: Tipo de Serviço/Outro, tipos Tributário, entrega e aguardando pagamento, recebimentos parciais e múltiplos, documentação Forms + Apps Script + Drive, pasta 05 - Financeiro e contagem real de retrabalhos no Dashboard. |
| 0.9 | 29/09/2026 | V45: ampliação dos Tipos de Serviço de Servidor Público e Saúde, cópia rápida do código das solicitações e Histórico financeiro separado de Contas a receber. |
| 0.10 | 29/09/2026 | V46: implementação do painel Gerenciar usuários, criação/edição de contas, permissões Administrador e Calculista, vínculo usuário↔calculista, alteração de e-mail, ativação/desativação e sincronização de contas existentes no Supabase Auth. |


### Devolução para ajuste

Quando o administrador devolver um cálculo, o status interno permanece `EM_CÁLCULO`, mas a área do calculista apresenta a identificação **Devolvido** e mostra o motivo informado pelo revisor em um bloco próprio. A devolução também permanece registrada no histórico.


## Encerramento financeiro

### Regra
A solicitação não deve ser marcada manualmente como `CONCLUIDO`. O encerramento ocorre pelo fluxo **Registrar recebimento e concluir** quando a demanda estiver em **Aguardando pagamento**.

### Dados registrados
- valor recebido;
- data do recebimento;
- conta de recebimento, para identificação em eventual consulta;
- forma de pagamento;
- recibo emitido ou não;
- número/identificação, data e informações do recibo, quando houver;
- link do recibo no Google Drive, quando registrado.

### Efeito financeiro
Ao concluir, o valor recebido passa a compor **Recebido** e reduz o saldo de **A receber**. O registro permanece vinculado à solicitação e aparece no histórico.

### Google Drive
O recibo deve ser armazenado na pasta privada da solicitação, preferencialmente em `05 - Financeiro`. O sistema disponibiliza um acesso direto à pasta vinculada.


## V37 — Entrega administrativa e aguardando pagamento

Após a aprovação do cálculo pelo administrador, a solicitação permanece em `ENVIADO` até que a entrega seja registrada administrativamente. A ação **Registrar entrega e aguardar pagamento** altera o status para `AGUARDANDO_PAGAMENTO` e registra o evento no histórico. A partir desse estado, o administrador pode utilizar o encerramento financeiro para registrar o recebimento e concluir a solicitação.


## Atualização V45 — Tipos de Serviço e Financeiro

- **Servidor Público:** foram acrescentados `1/3 de férias`, `Licença-prêmio` e `Valores devidos pela Administração Pública`.
- **Saúde:** foram acrescentados `Reajuste de plano de saúde`, `Danos morais` e `Danos materiais`.
- **Outro:** permanece como opção especial e abre campo de detalhamento de até 100 caracteres.
- **Código da solicitação:** o ícone discreto `⧉` permite copiar o código diretamente nas tabelas.
- **Financeiro:** `Contas a receber` continua mostrando somente saldos em aberto; abaixo dela, `Histórico financeiro` mostra as solicitações concluídas financeiramente.


### Permissão do perfil Usuário — V51
O perfil Usuário pode consultar os painéis de Advogados, Clientes, Processos, Calculistas e Relatórios. Esses painéis são somente leitura para esse perfil: criação, edição, exclusão e vínculo administrativo permanecem restritos ao Administrador.


## Perfil Usuário

O perfil Usuário possui acesso de consulta aos painéis de Advogados, Clientes, Processos, Calculistas e Relatórios, além de Dashboard e Solicitações. Pode registrar novas solicitações e, quando permitido pelo fluxo, atribuir novas solicitações a calculistas. Não pode editar ou excluir registros existentes, revisar cálculos, operar o financeiro ou gerenciar usuários. O manual exibido dentro do sistema é o Manual do Usuário quando essa função estiver ativa.


## V54 — Calculistas e identificação por vínculo

As listas operacionais exibem somente calculistas ativos com vínculo explícito a um usuário que exerce a função Calculista. A identificação é feita por ID; nomes são apenas informação de apresentação. A atribuição de solicitações usa o `calculista_id`.


## V57 — Navegação mobile

Em dispositivos móveis, tocar em qualquer item do menu lateral fecha o menu imediatamente, inclusive quando o item corresponde à tela que já está aberta. Essa regra evita que a barra lateral permaneça aberta no Dashboard. A correção é exclusivamente de navegação e não altera permissões ou regras de negócio.
