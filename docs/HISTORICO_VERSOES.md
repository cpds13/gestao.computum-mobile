# Histórico de versões


## V60 — 01/10/2026

- Mantida a correção de foco da pesquisa introduzida na V59.
- Mantida a abertura de solicitação somente pelo código.
- Removida a duplicação visual do código na tabela de Solicitações.
- O ícone de cópia permanece como ação independente ao lado do código.

## V61 — 01/10/2026

- Criado ajuste financeiro excepcional para solicitações concluídas.
- A função é exclusiva para Administradores.
- Acesso protegido por atalho `Ctrl + Shift + E` (ou `Cmd + Shift + E` no macOS).
- O ajuste abre um modal protegido com valor atual, novo valor e motivo obrigatório.
- Existe confirmação final antes da gravação.
- O pagamento já registrado não é alterado automaticamente.
- O novo saldo financeiro é recalculado a partir do novo valor.
- O ajuste é registrado no histórico com usuário, data/hora, valor anterior, novo valor e motivo.
- A operação no banco é atômica por meio da função `ajustar_valor_financeiro`.

## V62 — 01/10/2026

- Corrigido o atalho do ajuste financeiro excepcional.
- `Ctrl + Shift + E` agora funciona mesmo quando o foco estiver em um campo do drawer da solicitação.
- O atalho exige que o drawer de uma solicitação esteja aberto.
- Continua restrito a Administradores.
- Continua impedindo a abertura quando outro modal já estiver ativo.
- A aba Financeiro foi alinhada ao comportamento da aba Solicitações: somente o código abre a solicitação; as demais células da linha não são clicáveis.
- Corrigida a validação do status do ajuste financeiro para usar o valor real do banco (`CONCLUIDO`).
- O campo `Valor cobrado` bloqueado de uma solicitação concluída agora pode ser clicado pelo Administrador para abrir diretamente o modal de ajuste financeiro excepcional; o atalho permanece disponível.
- Tornado o acionamento do ajuste financeiro por clique no campo bloqueado independente do ciclo de vida do modal de edição, usando delegação global de eventos.


## V63 — 01/10/2026

- O ajuste financeiro excepcional passou a ser acionado por um cadeado discreto ao lado do valor cobrado bloqueado.
- O atalho `Ctrl + Shift + E` foi ampliado para funcionar também quando a solicitação estiver aberta a partir da aba Financeiro.
- A aba Financeiro recebeu filtros de pesquisa, status e área.
- A pesquisa financeira considera código, advogado, cliente, processo e serviço.
- Os filtros não recriam o campo de pesquisa durante a digitação, preservando o foco.
- A área financeira passa a mostrar quantidade de trabalhos e totais filtrados de faturamento, recebimento e saldo.


## V64 — 01/10/2026

- O Financeiro ganhou quatro indicadores compactos de Faturado, Recebido, A receber e Em atraso, com destaque intermediário e menor escala que os indicadores do Dashboard.
- O campo `Valor cobrado` de solicitações concluídas permanece somente leitura e não abre mais o ajuste financeiro ao ser clicado.
- O cadeado ao lado do campo é o acionamento visual do ajuste financeiro excepcional para Administradores.
- O atalho `Ctrl + Shift + E` permanece disponível.


## V65 — 01/10/2026

- Reestruturado o fechamento do menu mobile para evitar captura antecipada de `pointerdown`, `touchstart` e `click`.
- A navegação do menu passa a ocorrer pelo clique do próprio item e o menu é fechado depois da navegação.
- Criado overlay mobile explícito para impedir interação com o conteúdo atrás do menu.
- Ajustada a largura do menu mobile para no máximo 280px, preservando a identidade visual.
- Garantida área de toque mínima nos itens do menu.
- Corrigido o comportamento responsivo de modais/drawers e formulários no mobile, evitando overflow horizontal e garantindo uma coluna nos grids.
- Desktop e demais módulos não foram alterados intencionalmente.
\n\n## V66 — 01/10/2026\n\n- O menu mobile passou a permanecer fixo e visível durante a navegação.\n- A área selecionada continua sendo renderizada normalmente por trás do menu, sem overlay de captura de toque.\n- Removidos os fechamentos automáticos por `pointerdown`, `touchstart` e `click` que interferiam na navegação mobile.\n- Adicionado botão `«` para recolher o menu; quando recolhido, o mesmo controle passa a permitir sua expansão.\n- No estado recolhido, o menu mantém os ícones e libera praticamente toda a área da tela para o conteúdo.\n- A alteração é restrita ao comportamento mobile; desktop e demais funcionalidades permanecem com a estrutura anterior.\n

## V67 — 01/10/2026

- No mobile, o menu continua fixo e aberto durante a navegação.
- Ao recolher o menu, a barra lateral desaparece completamente e não ocupa espaço horizontal.
- O botão `☰` existente no topbar volta a ser o controle para reabrir o menu.
- O botão interno `«` permanece como controle para recolher o menu.
- A mudança é restrita ao comportamento mobile; desktop e demais funcionalidades permanecem inalterados.
