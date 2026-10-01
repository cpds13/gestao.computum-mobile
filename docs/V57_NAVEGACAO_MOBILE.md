# V57 — Navegação mobile

## Correção
Em telas com largura inferior a 801px, o menu lateral agora é fechado sempre que um item de navegação é tocado. Isso inclui o caso em que o usuário toca no **Dashboard** enquanto já está no Dashboard.

## Comportamento esperado
1. Abrir o menu lateral.
2. Tocar em qualquer item.
3. O menu fecha imediatamente.
4. Se a tela for diferente, a navegação ocorre normalmente.
5. Se a tela for a mesma, a tela permanece aberta e o menu continua fechado.

## Escopo
A alteração não modifica permissões, autenticação, Supabase, Edge Functions ou fluxo operacional. Não há nova migration.


## V57 — Fechamento robusto da barra lateral

No mobile, qualquer toque em item de navegação fecha imediatamente a barra lateral, inclusive Dashboard e Solicitações. O fechamento usa um listener em fase de captura para ocorrer antes dos handlers de navegação e também funcionar quando a tela atual é a mesma ou quando o conteúdo é renderizado novamente.


## Ajuste adicional da V57

Foi reforçado o fechamento da barra lateral em dispositivos móveis. O sistema agora trata `pointerdown`, `touchstart` e `click` em itens de navegação e aplica o recolhimento visual explicitamente. Isso cobre também toques em **Dashboard** e **Solicitações** quando a tela atual já é a mesma.
