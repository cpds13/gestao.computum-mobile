# Gestão Computum

Sistema web de gestão operacional de solicitações de cálculos judiciais.

O Gestão Computum **não é um motor de cálculo**. Ele controla a operação da demanda: entrada, advogado, cliente, processo, área, tipo de serviço, calculista, prazo, documentos, produção, revisão, entrega, financeiro, retrabalho e histórico.

## Estado atual — V60

A V54 consolida a identificação de calculistas por vínculo explícito de ID e elimina cadastros órfãos das listas operacionais. A V53 adiciona exclusão segura de usuários pelo painel administrativo. A V52 corrige a apresentação do menu e do manual do perfil Usuário. O Usuário consulta Advogados, Clientes, Processos, Calculistas e Relatórios sem permissões de edição, e recebe um manual específico de consulta e acompanhamento.

A V53 mantém o painel Gerenciar usuários, permissões, vínculo usuário↔calculista, alteração de e-mail e administração segura das contas de acesso.


A V57 reforça a navegação do menu lateral em dispositivos móveis: ao tocar em qualquer item do menu, inclusive no Dashboard e em Solicitações quando a tela já está aberta, a barra lateral é recolhida de forma explícita antes da permanência ou troca de tela. A correção usa eventos de interação antecipados e fechamento visual forçado no mobile, sem alterar a navegação desktop nem as permissões.

### Arquitetura

- **Frontend:** HTML, CSS e JavaScript estáticos
- **Hospedagem:** GitHub Pages
- **Repositório:** `cpds13/gestao-computum`
- **Domínio:** `https://gestao.computum.com.br`
- **Banco/Auth:** Supabase
- **Banco:** PostgreSQL
- **Autenticação:** Supabase Auth
- **Documentos:** Google Forms + Google Apps Script + Google Drive privado
- **Sistemas especializados:** aplicações independentes acessadas por vínculo/URL

### Perfis

- **Administrador:** controla o ciclo administrativo, revisão, entrega, financeiro e configurações.
- **Calculista:** trabalha nas solicitações atribuídas em **Minha produção**.
- **Administrador + Calculista:** um mesmo usuário pode exercer as duas funções.

O vínculo entre conta de acesso e cadastro de calculista é mantido por `public.calculistas.usuario_id`.

## Fluxo operacional validado

```text
NOVO
  ↓
ANÁLISE / conferência
  ↓
AGUARDANDO DOCUMENTOS (quando necessário)
  ↓
EM CÁLCULO
  ↓
EM REVISÃO
  ├── Devolver para cálculo → EM CÁLCULO
  └── Aprovar
          ↓
       ENVIADO
          ↓
Registrar entrega
          ↓
AGUARDANDO PAGAMENTO
          ↓
Recebimentos parciais ou total
          ↓
CONCLUÍDO
```

O calculista não encerra financeiramente a solicitação. O `CONCLUÍDO` é alcançado pelo fluxo financeiro administrativo.

## Funcionalidades validadas

### Solicitações

- criação e edição;
- advogado, cliente e processo;
- área e tipo de serviço;
- atribuição de calculista;
- prazo e prioridade;
- valor cobrado;
- histórico;
- exclusão administrativa com registros relacionados conforme as regras do banco.

### Tipo de Serviço

O tipo é carregado dinamicamente do Supabase de acordo com a Área.

Para `Outro`:

- aparece o campo de especificação;
- limite de 100 caracteres;
- valor armazenado em `solicitacoes.tipo_servico_outro`;
- a exibição utiliza `Outro — [especificação]`.

Na área **Tributário**, estão cadastrados:

- `Atualização`
- `Cálculo tributário`
- `Rest. acima TETO`
- `Recomposição IR`

Os cadastros existentes de áreas e tipos são preservados.

### Produção e revisão

- painel **Minha produção**;
- solicitações atribuídas ao calculista;
- `NOVO → EM CÁLCULO → EM REVISÃO`;
- devolução pelo revisor com justificativa;
- aprovação pelo administrador;
- administrador que também é calculista pode atuar nas duas funções.

### Entrega e financeiro

Após a aprovação, a solicitação pode passar de `ENVIADO` para `AGUARDANDO_PAGAMENTO`.

O financeiro suporta:

- valor do serviço;
- múltiplos recebimentos;
- recebimentos parciais;
- saldo pendente;
- conta de recebimento;
- forma de pagamento;
- recibo;
- link do recibo no Drive;
- conclusão somente quando o saldo chega a zero.

Exemplo:

```text
Valor:       R$ 5.000,00
1º pagamento R$ 3.000,00
2º pagamento R$ 1.000,00
Saldo:       R$ 1.000,00
             ↓
3º pagamento R$ 1.000,00
             ↓
Saldo:       R$ 0,00
             ↓
CONCLUÍDO
```

### Retrabalhos

O Dashboard consulta a tabela `public.retrabalhos` para apresentar a quantidade real de retrabalhos. O número não é mais fixo no frontend.

### Documentos

O fluxo atualmente utilizado é:

1. **Google Forms** para recebimento;
2. **Google Apps Script** para organização;
3. **Google Drive privado** como armazenamento;
4. **Gestão Computum** para vincular e abrir a pasta da solicitação.

Estrutura:

```text
Computum
└── Gestão
    └── CJ-2026-xxxxx
        ├── 01 - Documentos recebidos
        ├── 02 - Cálculos
        ├── 03 - Parecer
        ├── 04 - Retrabalho
        └── 05 - Financeiro
```

O `05 - Financeiro` é utilizado para documentos de recibo e outros documentos financeiros.

Não há dependência de Google Cloud ou cartão para o fluxo Forms + Apps Script adotado.

## Gestão de usuários

A V52 inclui o painel administrativo **Gerenciar usuários**. Ele permite criar e editar contas, alterar e-mail, definir Administrador, Calculista ou as duas funções, vincular um cadastro de calculista e ativar/desativar usuários.

Contas que já existiam no Supabase Auth são sincronizadas pela migration `008_gestao_usuarios.sql`. A criação e alteração da conta de autenticação usam a Edge Function `gerenciar-usuario`; a `service_role` fica exclusivamente no ambiente seguro do Supabase e nunca no frontend.

## Banco e migrations

Migrations incluídas no projeto:

- `001_initial_schema.sql` — estrutura inicial;
- `002_calculistas.sql` — cadastro operacional de calculistas;
- `003_documentos_forms_manual.sql` — origem dos documentos e vínculo com Forms;
- `004_calculistas_usuarios.sql` — vínculo calculista/usuário;
- `005_encerramento_financeiro.sql` — dados de recebimento e recibo;
- `006_tipo_servico_detalhamento.sql` — `tipo_servico_outro` e tipos Tributário.

As migrations devem ser executadas conforme o estado atual do projeto Supabase, evitando reaplicar alterações já executadas sem necessidade.

## Sistemas especializados

- `abono.computum.com.br`
- `diferencas.computum.com.br`
- `saude.computum.com.br`

O Gestão permanece separado desses sistemas. A integração inicial é por vínculo/URL.

## Documentação

- `docs/MANUAL_DO_SISTEMA.md` — manual operacional oficial;
- `docs/MANUAL_DO_ADMINISTRADOR.md` — manual administrativo de usuários, permissões e manutenção de acesso;
- `docs/GESTAO_COMPUTUM_ESPECIFICACAO.md` — especificação funcional;
- `docs/GOOGLE_DRIVE_FORMS.md` — fluxo de documentos por Forms/Apps Script/Drive.

A documentação deve ser atualizada sempre que uma etapa funcional for validada.

## Segurança

Nunca colocar no frontend:

- `service_role` key;
- senhas;
- client secret do Google;
- tokens privados;
- outros segredos de backend.

O Google Drive deve permanecer privado/restrito.

## Histórico de versões

### V45
- Tipos de Serviço, cópia rápida de código e histórico financeiro.

### V52
- Painel Gerenciar usuários.
- Criação e edição de contas.
- Funções Administrador, Calculista e Administrador + Calculista.
- Alteração de e-mail preservando o mesmo UUID.
- Ativação/desativação.
- Sincronização de contas já existentes no Supabase Auth.
- Edge Function segura para operações administrativas de autenticação.
- Validação do access token diretamente pelo endpoint Auth do Supabase, sem depender de sessão interna do cliente supabase-js na Edge Function.
- Chamada administrativa do frontend com access token explícito, renovação de sessão e tratamento de HTTP 401/403/400/500.

- Ampliação dos Tipos de Serviço de Servidor Público e Saúde.
- `Outro` continua com detalhamento de até 100 caracteres.
- Cópia rápida do código das solicitações pelo ícone `⧉`.
- Histórico financeiro separado de Contas a receber.

### V42
- correção do fluxo de **Tipo de Serviço**;
- `Outro` exibido por último;
- abertura do campo de especificação com limite de 100 caracteres;
- preservação dos tipos cadastrados no Supabase;
- conclusão financeira com múltiplos recebimentos validada.

### V39
- correção da relação Área → Tipo de Serviço.

### V38
- recebimentos parciais e múltiplos pagamentos.

### V37
- `ENVIADO → AGUARDANDO_PAGAMENTO`.

### V36
- Tipo de Serviço dinâmico;
- `tipo_servico_outro`;
- tipos Tributário adicionais.

### V29
- encerramento financeiro e dados de recibo.

### V24
- fluxo administrativo de revisão e devolução.

### V23
- administrador também pode atuar como calculista.

### V22
- manual interno e Minha produção.



### Permissão do perfil Usuário — V52
O perfil Usuário pode consultar os painéis de Advogados, Clientes, Processos, Calculistas e Relatórios. Esses painéis são somente leitura para esse perfil: criação, edição, exclusão e vínculo administrativo permanecem restritos ao Administrador.


### Exclusão segura de usuários — V53

O Administrador pode excluir uma conta pelo painel **Usuários**. Antes da exclusão, a Edge Function verifica se a conta possui referências em solicitações, retrabalhos, arquivos, pagamentos, histórico ou cadastro de calculista.

- Sem vínculos: remove a conta do Supabase Auth, o registro em `public.usuarios` e o cadastro de calculista vinculado, quando existir.
- Com vínculos: a exclusão é bloqueada e o usuário deve ser desativado para preservar o histórico.
- O próprio administrador logado não pode excluir a própria conta.
- O último administrador ativo não pode ser excluído.

A migration `011_exclusao_segura_usuarios.sql` deve ser executada no Supabase antes de usar a exclusão.


## V54 — identidade e listas de calculistas

- A função Calculista é identificada por perfil/vínculo explícito, nunca por nome.
- Listas operacionais de calculistas exibem somente cadastros ativos vinculados a usuários ativos que exercem a função Calculista.
- Usuários do perfil Usuário e cadastros órfãos de calculista não aparecem para atribuição de solicitações.
- A atribuição de novas solicitações usa `calculista_id`, e não o nome do profissional.
- A alteração do nome de um usuário calculista deve refletir no cadastro de calculista vinculado pelo mesmo ID; históricos permanecem com a identificação registrada no momento da ação.

## Backup e restauração

A V58 define o formato independente GCOMP (`.gcomp`) para backup e restauração. A implementação operacional está planejada para a V59. Backups reais e dados de produção não devem ser publicados no repositório.


### V60 — Solicitações

A V60 mantém as correções de pesquisa e navegação da V59 e ajusta a apresentação do código na tabela de Solicitações. O código passa a aparecer uma única vez, funcionando como a ação para abrir a solicitação, com o ícone de cópia ao lado. Advogado, cliente, serviço e demais células permanecem sem ação de abertura.

## V61 — ajuste financeiro excepcional

Administradores podem corrigir valores de solicitações concluídas por meio de atalho protegido (`Ctrl + Shift + E`), com motivo obrigatório, confirmação e registro no histórico.
