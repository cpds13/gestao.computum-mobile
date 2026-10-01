# Gestão Computum — Histórico de Migração e Backup

## Migração histórica — 01/10/2026

Foi realizada uma migração histórica para a Gestão Computum a partir de uma planilha estruturada.

A migração resultou em 82 solicitações e 77 pagamentos registrados.

Durante a migração foram identificados e corrigidos problemas de modelagem e importação, incluindo:

- diferenciação entre cadastro de cliente e solicitação;
- possibilidade de múltiplas solicitações para o mesmo advogado e cliente;
- possibilidade de múltiplos tipos de serviço para o mesmo cliente;
- normalização de tipos de serviço;
- vínculo correto entre usuário e cadastro de calculista;
- preservação dos IDs e códigos de migração;
- preservação de datas desconhecidas sem inferência;
- correção da forma de pagamento dos registros migrados para PIX.

Um caso relevante foi o cliente aparecer em mais de uma solicitação. A regra consolidada é que advogado, cliente, área e tipo de serviço não constituem, isoladamente ou em conjunto, o identificador único de uma solicitação. Cada solicitação possui seu próprio ID e código.

## Limitações de backup encontradas

O projeto utiliza o Supabase como banco principal. Durante a preparação da migração foi verificado que o ambiente utilizado não oferecia o mecanismo de backup de banco que atendia à necessidade operacional do projeto.

Por isso foi definida uma solução própria de backup e restauração, independente do formato de backup do provedor.

## Formato GCOMP

Foi definido o formato:

`GES-COMPUTUM-DDMMAAAAHHMMSS.gcomp`

O arquivo terá conteúdo JSON estruturado e deverá preservar dados, IDs, relacionamentos e metadados necessários para recuperação.

O GCOMP é um requisito arquitetural definido na V58 e **não é uma funcionalidade implementada nesta versão**.

A implementação de exportação, validação, prévia e restauração transacional está planejada para a próxima versão oficial, V59.

## Segurança

Backups reais, dados financeiros, nomes de clientes, processos, pagamentos, credenciais, chaves secretas e outros dados operacionais não devem ser armazenados no repositório público.

Este documento registra o processo técnico sem expor dados reais do negócio.


## V59 — Correção da pesquisa e abertura de solicitações

Durante a validação da V58 foi identificado que o campo de pesquisa perdia o foco a cada caractere, tanto no computador quanto no celular. Também foi identificado que tocar em qualquer célula da linha podia abrir a solicitação.

A V59 passa a atualizar somente a lista filtrada durante a digitação e restringe a abertura ao código da solicitação.
