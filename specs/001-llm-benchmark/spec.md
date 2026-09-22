# Feature Specification: Benchmark de Modelos LLM

**Feature Branch**: `[001-llm-benchmark]`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Quero uma página nova de benchmark onde o usuário possa entrar e fazer uma bateria de testes sobre um modelo LLM. O usuário terá diversos atributos diferentes que poderá definir. Ele poderá selecionar uma lista de modelos LLMs, definir chunk size e tamanho do banco vetorial, definir o arquivo de entrada para o RAG, definir o modelo de embeddings, e adicionar perguntas de teste para verificar a similaridade da resposta do modelo. Ao executar os testes, os atributos são carregados no programa e os testes para cada pergunta são executados. Ao final, é mostrado uma tabela com os resultados de cada modelo para cada pergunta e algumas métricas de desempenho. O usuário poderá exportar a tabela."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar e executar uma bateria de testes (Priority: P1)

Um pesquisador/avaliador acessa a nova página de benchmark, define os atributos do teste
(lista de modelos LLM a comparar, chunk size, tamanho máximo do banco vetorial, arquivo de
entrada para o RAG, modelo de embeddings, e uma lista de perguntas de teste com a respectiva
resposta esperada) e inicia a execução. O sistema carrega esses atributos, processa o documento
de entrada, e executa cada pergunta contra cada modelo selecionado, medindo o quão similar é a
resposta gerada em relação à resposta esperada.

**Why this priority**: Sem a capacidade de configurar e disparar a bateria de testes, não existe
benchmark algum — esta é a funcionalidade central que todo o resto depende.

**Independent Test**: Pode ser testada configurando um único modelo, um único arquivo de entrada
e uma única pergunta (com resposta esperada), disparando a execução, e verificando que o sistema
processa o RAG e produz um resultado para aquele par modelo/pergunta.

**Acceptance Scenarios**:

1. **Given** o usuário preencheu ao menos um modelo, um arquivo de entrada, um modelo de
   embeddings e uma pergunta de teste com resposta esperada, **When** o usuário inicia a
   execução, **Then** o sistema processa o documento, gera embeddings, executa a consulta RAG
   para cada modelo selecionado e produz um resultado por par modelo/pergunta.
2. **Given** múltiplos modelos foram selecionados, **When** a bateria de testes é executada,
   **Then** cada modelo é testado contra todas as perguntas configuradas, sem que a falha de um
   modelo impeça a execução dos demais.
3. **Given** um atributo obrigatório não foi preenchido (ex.: nenhum modelo selecionado, nenhuma
   pergunta adicionada, nenhum arquivo de entrada definido), **When** o usuário tenta iniciar a
   execução, **Then** o sistema exibe uma mensagem de validação e impede o início dos testes.
4. **Given** a execução está em andamento, **When** o usuário observa a página, **Then** o
   sistema exibe indicação de progresso (ex.: qual modelo/pergunta está sendo processado no
   momento).

---

### User Story 2 - Visualizar resultados e métricas de desempenho (Priority: P2)

Após a execução da bateria de testes, o usuário visualiza uma tabela consolidada com o
resultado de cada modelo para cada pergunta, incluindo a resposta gerada, o grau de similaridade
com a resposta esperada, e métricas de desempenho agregadas por modelo (ex.: similaridade média,
tempo médio de resposta, quantidade de perguntas bloqueadas por guardrail).

**Why this priority**: A configuração e execução (User Story 1) só geram valor se o usuário
conseguir interpretar os resultados e comparar os modelos entre si.

**Independent Test**: Pode ser testada executando uma bateria simples (1 modelo, 2 perguntas) e
verificando que a tabela final exibe uma linha por par modelo/pergunta com similaridade e que um
resumo de métricas por modelo é exibido.

**Acceptance Scenarios**:

1. **Given** uma bateria de testes concluída, **When** o usuário visualiza a página, **Then** uma
   tabela exibe, para cada combinação de modelo e pergunta, a resposta gerada e o grau de
   similaridade em relação à resposta esperada.
2. **Given** uma bateria de testes concluída, **When** o usuário visualiza a página, **Then** o
   sistema exibe métricas de desempenho agregadas por modelo (similaridade média e tempo médio de
   resposta, no mínimo).
3. **Given** uma pergunta foi bloqueada pelo guardrail para um determinado modelo, **When** o
   usuário visualiza a tabela, **Then** a linha correspondente indica claramente que a resposta
   foi bloqueada, em vez de exibir um valor de similaridade comum.

---

### User Story 3 - Exportar os resultados (Priority: P3)

O usuário exporta a tabela de resultados consolidada para um arquivo, permitindo análise externa
ou arquivamento dos resultados do benchmark.

**Why this priority**: É um complemento valioso às User Stories 1 e 2, mas o benchmark já entrega
valor (comparação visual na própria página) mesmo sem exportação.

**Independent Test**: Pode ser testada executando uma bateria de testes simples e clicando em
"exportar", verificando que um arquivo contendo os dados da tabela é gerado/baixado.

**Acceptance Scenarios**:

1. **Given** uma tabela de resultados completa, **When** o usuário aciona a opção de exportar,
   **Then** um arquivo é gerado contendo todas as linhas de resultados e as métricas de
   desempenho por modelo.
2. **Given** nenhuma bateria de testes foi executada ainda, **When** o usuário procura a opção de
   exportar, **Then** a opção fica indisponível/desabilitada.

---

### Edge Cases

- O que acontece quando um modelo selecionado falha ao carregar (ex.: WebGPU indisponível ou
  memória insuficiente)? O sistema deve marcar esse modelo como falho e continuar com os demais.
- O que acontece quando o arquivo de entrada não pode ser processado (ex.: PDF corrompido ou sem
  texto extraível)? A execução deve ser interrompida com uma mensagem clara antes de iniciar os
  testes por modelo.
- O que acontece quando o tamanho do banco vetorial definido é menor que o número de chunks
  gerados a partir do arquivo de entrada? O sistema deve aplicar o limite definido (ex.:
  utilizando apenas os chunks mais relevantes) e informar ao usuário que houve truncamento.
- O que acontece quando uma pergunta de teste é bloqueada pelo guardrail de pergunta antes mesmo
  de chegar ao modelo? A linha correspondente deve refletir o bloqueio, sem tentar calcular
  similaridade.
- O que acontece se o usuário navegar para outra página ou fechar a aba enquanto a bateria de
  testes está em execução? A execução em andamento é interrompida; resultados parciais já obtidos
  não são preservados automaticamente.
- O que acontece quando nenhuma pergunta possui resposta esperada preenchida? O sistema deve
  impedir a execução até que toda pergunta de teste tenha uma resposta esperada associada, pois a
  similaridade não pode ser calculada sem ela.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE prover uma página dedicada de benchmark, separada do fluxo principal
  de conversa com o assistente.
- **FR-002**: O sistema DEVE permitir que o usuário selecione uma ou mais modelos LLM, a partir de
  uma lista de modelos suportados, para incluir na bateria de testes.
- **FR-003**: O sistema DEVE permitir que o usuário defina o chunk size utilizado para dividir o
  documento de entrada.
- **FR-004**: O sistema DEVE permitir que o usuário defina um tamanho máximo para o banco vetorial
  (quantidade máxima de chunks armazenados/considerados) utilizado no benchmark.
- **FR-005**: O sistema DEVE permitir que o usuário defina um arquivo de entrada a ser utilizado
  como base documental do RAG durante o benchmark.
- **FR-006**: O sistema DEVE permitir que o usuário selecione o modelo de embeddings a ser
  utilizado durante o benchmark.
- **FR-007**: O sistema DEVE permitir que o usuário adicione, edite e remova perguntas de teste,
  cada uma contendo o texto da pergunta e a resposta esperada correspondente.
- **FR-008**: O sistema DEVE impedir o início da execução caso algum atributo obrigatório esteja
  ausente (nenhum modelo selecionado, nenhum arquivo de entrada, nenhum modelo de embeddings, ou
  nenhuma pergunta de teste com resposta esperada), exibindo uma mensagem de validação.
- **FR-009**: Ao iniciar a execução, o sistema DEVE processar o arquivo de entrada e gerar a base
  vetorial de acordo com os atributos configurados (chunk size, tamanho do banco vetorial, modelo
  de embeddings) antes de executar as perguntas.
- **FR-010**: O sistema DEVE executar cada pergunta de teste contra cada modelo LLM selecionado,
  reutilizando o fluxo de consulta RAG (incluindo guardrails) já existente no produto.
- **FR-011**: O sistema DEVE calcular um grau de similaridade entre a resposta gerada por cada
  modelo e a resposta esperada definida para aquela pergunta.
- **FR-012**: O sistema DEVE exibir uma tabela de resultados com uma entrada por combinação de
  modelo e pergunta, incluindo a resposta gerada e o grau de similaridade calculado.
- **FR-013**: O sistema DEVE indicar na tabela quando uma pergunta foi bloqueada por um guardrail
  (de pergunta ou de resposta), distinguindo esse caso de um resultado de similaridade normal.
- **FR-014**: O sistema DEVE exibir métricas de desempenho agregadas por modelo, incluindo, no
  mínimo, a similaridade média e o tempo médio de resposta.
- **FR-015**: O sistema DEVE exibir uma indicação de progresso durante a execução da bateria de
  testes (ex.: modelo/pergunta atualmente em processamento).
- **FR-016**: O sistema DEVE continuar a execução dos demais modelos/perguntas caso um modelo
  específico falhe ao carregar ou ao gerar uma resposta, marcando o(s) resultado(s) afetado(s)
  como falho.
- **FR-017**: O sistema DEVE permitir que o usuário exporte a tabela de resultados (incluindo as
  métricas de desempenho por modelo) para um arquivo, uma vez que a bateria de testes tenha sido
  concluída.

### Key Entities

- **Configuração de Benchmark**: representa os atributos definidos pelo usuário para uma bateria
  de testes — chunk size, tamanho máximo do banco vetorial, arquivo de entrada, modelo de
  embeddings e a lista de modelos LLM selecionados.
- **Pergunta de Teste**: representa uma pergunta configurada pelo usuário, contendo o texto da
  pergunta e a resposta esperada usada como referência para o cálculo de similaridade.
- **Resultado de Benchmark**: representa o resultado de uma combinação específica de modelo e
  pergunta — resposta gerada, grau de similaridade, tempo de resposta, e status (concluído,
  bloqueado por guardrail, ou falho).
- **Resumo de Desempenho por Modelo**: representa as métricas agregadas de um modelo ao longo de
  toda a bateria de testes — similaridade média, tempo médio de resposta, e quantidade de
  perguntas bloqueadas ou falhas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um usuário consegue configurar uma bateria de testes válida (ao menos um modelo, um
  arquivo de entrada e uma pergunta com resposta esperada) e iniciar a execução em menos de 2
  minutos.
- **SC-002**: Ao final de uma execução bem-sucedida, 100% das combinações válidas de modelo e
  pergunta configuradas aparecem na tabela de resultados, com resposta gerada e similaridade (ou
  status de bloqueio/falha) preenchidos.
- **SC-003**: Um usuário consegue exportar a tabela de resultados completa em até 5 segundos após
  o fim da execução, sem necessidade de recarregar a página.
- **SC-004**: A falha de carregamento ou de execução de um modelo específico não impede a
  conclusão dos testes para os demais modelos selecionados na mesma bateria.
- **SC-005**: Um usuário consegue, a partir da tabela e das métricas exibidas, identificar qual
  modelo teve a melhor similaridade média sem precisar de explicação adicional.

## Assumptions

- O arquivo de entrada do benchmark é um documento no mesmo formato já suportado pelo fluxo
  principal do RAG (PDF), reaproveitando o processamento de documentos já existente no produto.
- Cada pergunta de teste deve ter uma resposta esperada associada, e o grau de "similaridade da
  resposta do modelo" mencionado na solicitação é calculado comparando a resposta gerada por cada
  modelo com essa resposta esperada.
- O benchmark testa uma lista de modelos LLM contra uma única configuração de chunk size, tamanho
  de banco vetorial, modelo de embeddings e arquivo de entrada por execução (não é necessário
  testar múltiplas combinações desses atributos na mesma bateria).
- Como o ambiente executa os modelos localmente no navegador, os modelos selecionados são testados
  um de cada vez (sequencialmente), reaproveitando a infraestrutura de carregamento de modelo já
  existente no produto.
- A lista de modelos LLM disponíveis para seleção corresponde a modelos já suportados/testados no
  produto (ex.: modelos compatíveis com WebLLM), não modelos arbitrários informados livremente
  pelo usuário.
- O formato de exportação padrão é um arquivo tabular de uso comum (ex.: CSV), adequado para
  análise externa em planilhas.
- Resultados de uma bateria de testes não precisam ser persistidos entre sessões do navegador
  além do necessário para exibição e exportação imediatas; não há requisito de histórico de
  benchmarks nesta funcionalidade.
