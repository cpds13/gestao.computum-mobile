# Manual do Administrador — Gestão Computum

**Versão:** V58  
**Data:** 29/09/2026  
**Status:** Em desenvolvimento

Este manual reúne os procedimentos administrativos do Gestão Computum. Toda alteração estrutural do sistema deve ser refletida nesta documentação antes do encerramento da etapa.

## 1. Acesso administrativo

O perfil **Administrador** controla as rotinas administrativas do sistema. Um mesmo usuário pode também exercer a função de **Calculista**.

## 2. Gerenciar usuários

O menu **Usuários** é a área oficial para administrar as contas de acesso. Ele substitui, para o uso cotidiano, a necessidade de editar manualmente registros de `public.usuarios` no Supabase.

### 2.1 Lista de usuários

A lista apresenta:

- nome;
- e-mail;
- funções;
- calculista vinculado;
- situação ativa/inativa;
- identificador do usuário.

Use **Editar** para alterar uma conta existente.

### 2.2 Adicionar usuário

Em **Usuários → Adicionar usuário**, informe:

1. nome;
2. e-mail;
3. senha inicial com pelo menos 8 caracteres;
4. Administrador, Calculista ou as duas funções;
5. cadastro de calculista, quando aplicável;
6. situação da conta.

A conta é criada no Supabase Auth pela rotina administrativa segura e recebe o registro correspondente em `public.usuarios`. A senha inicial não é armazenada pelo Gestão Computum.

### 2.3 Editar usuário

A edição permite alterar:

- nome;
- e-mail;
- função Administrador;
- função Calculista;
- cadastro de calculista;
- situação ativa/inativa.

A alteração não deve criar uma segunda conta. O mesmo UUID do Supabase Auth é preservado.

### 2.4 Permissões

**Administrador**

Acessa as rotinas administrativas, solicitações, cadastros, revisão, entrega, financeiro, configurações e gerenciamento de usuários.

**Calculista**

Acessa **Minha produção** e trabalha nas solicitações atribuídas ao seu cadastro de calculista.

**Administrador + Calculista**

As duas funções podem ser acumuladas na mesma conta. Não é necessário criar duas contas para a mesma pessoa.

### 2.5 Vínculo com Calculista

A função Calculista é reconhecida pelo perfil `calculista` ou pelo vínculo explícito entre o usuário autenticado e `public.calculistas.usuario_id`. Um cadastro de calculista sem `usuario_id` **não concede acesso como Calculista**, mesmo que o nome seja igual ao nome do usuário.

Ao marcar Calculista, o administrador pode escolher um cadastro existente. Se nenhum for escolhido, o sistema tenta reaproveitar um cadastro pelo nome ou cria um novo cadastro de calculista.

Ao retirar a função Calculista, o vínculo com o cadastro é removido, mas o cadastro histórico do calculista não é apagado.

### 2.6 Alterar e-mail

Use **Editar**, altere o e-mail e salve. A operação preserva:

- UUID do usuário;
- permissões;
- vínculo como calculista;
- solicitações;
- histórico;
- demais referências ao usuário.

Não exclua e recrie a conta apenas para trocar o e-mail.

### 2.7 Ativar e desativar

Um usuário inativo não deve conseguir acessar o sistema. A desativação não apaga solicitações, histórico ou vínculos anteriores.

O sistema impede uma alteração que deixe o projeto sem nenhum administrador ativo.


## 2.8 Perfis e permissões definitivos

O Gestão Computum utiliza três níveis de uso: **Usuário**, **Calculista** e **Administrador**.

### Usuário

O perfil Usuário corresponde ao antigo valor técnico `administrativo`. Ele tem visão geral do sistema e pode:

- criar solicitações;
- visualizar solicitações;
- atribuir e remover o calculista responsável;
- acompanhar o andamento.

O Usuário **não pode**:

- editar solicitações já criadas;
- excluir solicitações;
- revisar cálculos;
- aprovar ou devolver cálculos;
- registrar ou autorizar pagamentos;
- acessar Gerenciar Usuários;
- alterar configurações administrativas.

Na interface, o perfil aparece como **Usuário**, e não como “Administrativo”.

### Administrador

O Administrador possui acesso às rotinas administrativas, incluindo edição/exclusão de solicitações, revisão, entrega, financeiro, configurações e Gerenciar Usuários.

### Calculista

O Calculista executa as demandas atribuídas ao seu cadastro e envia os cálculos para revisão.

### Administrador + Calculista

As duas funções podem coexistir na mesma conta.

## 2.9 Gerenciar Usuários — acesso restrito

O painel **Gerenciar Usuários** é exclusivo do Administrador. O menu não aparece para Usuários ou Calculistas e as operações administrativas também são protegidas no backend.

No painel, o Administrador pode criar contas, alterar nome e e-mail, definir Administrador e/ou Calculista, deixar a conta como Usuário, vincular o cadastro de calculista e ativar/desativar o acesso.

## 2.10 Auditoria das solicitações

A criação de uma solicitação registra no histórico o nome e o e-mail do usuário que a criou. A atribuição de um calculista também registra o responsável pela ação, com nome e e-mail. O histórico preserva a trilha operacional da demanda.

## 3. Contas que já existem no Supabase Auth

É possível que uma conta tenha sido criada diretamente em **Authentication → Users** antes da existência do painel. Nesse caso, pode existir `auth.users` sem o correspondente em `public.usuarios`.

A migration `008_gestao_usuarios.sql` sincroniza essas contas e cria um perfil inicial `administrativo`, que aparece no sistema como **Usuário** até que o Administrador defina uma função específica. Depois disso, o administrador deve entrar no Gestão Computum e definir as funções.

### Exemplo

Se `carlos.patrick@hotmail.com` já existir no Supabase Auth:

1. execute as migrations 008 e 009;
2. faça login com uma conta administrativa;
3. abra **Usuários**;
4. localize Carlos Patrick;
5. clique em **Editar**;
6. marque **Administrador**, **Calculista** ou as duas funções;
7. se Calculista estiver marcado, selecione ou crie o cadastro de calculista;
8. salve;
9. teste o login da conta.

Não crie uma segunda conta para o mesmo e-mail.

## 4. Implantação técnica da V46

### 4.1 Migration

As migrations 008 e 009 já fazem parte da base consolidada da V45.2. **Não execute novamente migrations já aplicadas.** A V46 não acrescenta uma migration obrigatória para o gerenciamento de usuários.

Essa migration:

- cria `updated_at` em `public.usuarios`;
- sincroniza contas já existentes em `auth.users`;
- cria trigger para novas contas;
- restringe alterações diretas de `public.usuarios` ao administrador;
- cria a função auxiliar de verificação administrativa.

### 4.2 Edge Function

Publique:

`supabase/functions/gerenciar-usuario/index.ts`

No Supabase Web, abra **Edge Functions → gerenciar-usuario → Code**, substitua o código pelo arquivo `supabase/functions/gerenciar-usuario/index.ts` e clique em **Deploy**.

A V46 não exige uma nova migration para esta correção; as migrations 008 e 009 já executadas permanecem válidas.

A Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente seguro do Supabase. **Nunca coloque essa chave no frontend.**

### 4.3 Testes obrigatórios

Após a implantação, testar:

- login de usuário existente;
- visualização do menu Usuários apenas para administrador;
- edição de um usuário;
- mudança de Administrador para Calculista;
- combinação Administrador + Calculista;
- vínculo com cadastro de calculista;
- alteração de e-mail;
- desativação e reativação;
- criação de uma nova conta;
- login da nova conta;
- preservação do histórico de uma conta editada.

## 5. Regra de manutenção da documentação

Toda alteração futura de usuários, permissões, autenticação ou vínculo com calculistas deve ser documentada neste manual e no `docs/MANUAL_DO_SISTEMA.md`.


### Permissão do perfil Usuário — V51
O perfil Usuário pode consultar os painéis de Advogados, Clientes, Processos, Calculistas e Relatórios. Esses painéis são somente leitura para esse perfil: criação, edição, exclusão e vínculo administrativo permanecem restritos ao Administrador.


## Exclusão de usuário

No painel **Usuários**, o Administrador pode usar o botão **Excluir**. A exclusão é definitiva somente quando a conta não possui registros vinculados. O sistema verifica solicitações, retrabalhos, arquivos, pagamentos, histórico e vínculo como calculista.

Quando houver qualquer vínculo, a exclusão é bloqueada e a conta deve ser **desativada**. A desativação impede novos acessos sem apagar a atribuição histórica.

O sistema também impede a exclusão do próprio administrador logado e do último administrador ativo.


## V54 — Cadastro e atribuição de calculistas

Ao alterar o nome de um usuário que exerce a função Calculista, o cadastro de calculista vinculado ao mesmo usuário deve acompanhar o nome atual. A atribuição de solicitações usa o vínculo por ID, nunca a busca por nome. Cadastros de calculista sem usuário vinculado não aparecem nas listas operacionais.


## V57 — Navegação mobile

Em dispositivos móveis, tocar em qualquer item do menu lateral fecha o menu imediatamente, inclusive quando o item corresponde à tela que já está aberta. Essa regra evita que a barra lateral permaneça aberta no Dashboard. A correção é exclusivamente de navegação e não altera permissões ou regras de negócio.
