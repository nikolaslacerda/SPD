# Agente escolhido
Claude Code
`specify init --here --integration claude`

# Etapa Constitution

```
/speckit.constitution Projeto Angular versão 20 com TypeScript.
Use standalone components e o padrão de pastas existente em src/app.
Siga os services e interceptors HTTP já existentes; não crie novas libs sem justificar.
Use SCSS para UI. Formulários com Reactive Forms. Testes unitários para componentes e services.
Respeite o lint e o estilo de código já configurados.
```

Arquivo criado no `/memory`

## Modificações no Constitution
- Não foi necessário


# Etapa de Specify

Prompt 
```
/speckit.specify Quero uma página nova de benchmark de modelos LLM, separada do fluxo
principal de conversa com o assistente, onde o usuário possa configurar e executar uma
bateria de testes comparando múltiplos modelos.

O usuário deve poder definir os seguintes atributos antes de rodar o teste:
- Uma lista de modelos LLM (selecionados a partir dos modelos já suportados no produto,
  ex.: compatíveis com WebLLM) para comparar entre si.
- Chunk size usado para dividir o documento de entrada.
- Tamanho máximo do banco vetorial, como quantidade máxima de chunks armazenados.
- Um arquivo de entrada (documento PDF) que serve de base documental para o RAG.
- Um limiar (threshold) de similaridade configurável, usado para decidir se cada resposta
  é aprovada ou reprovada.
- Uma lista de perguntas de teste, cada uma com o texto da pergunta e a resposta esperada
  correspondente, podendo adicionar, editar e remover perguntas.

O modelo de embeddings usado no benchmark NÃO é selecionável pelo usuário: devido a
restrições de compatibilidade dos índices vetoriais, o sistema usa um único modelo de
embeddings fixo (hardcoded). A tela deve exibir de forma transparente, em modo somente
leitura, qual é o modelo de embeddings ativo, sem permitir que o usuário o altere. Uma
arquitetura que permita trocar/re-indexar o modelo de embeddings em background fica para
uma versão futura, fora do escopo desta funcionalidade.

O sistema não deve permitir iniciar a execução se faltar algum atributo obrigatório
(nenhum modelo LLM selecionado, nenhum arquivo de entrada, ou pergunta sem resposta
esperada), mostrando uma mensagem de validação. Se o usuário selecionar mais de 5 modelos
e/ou mais de 20 perguntas, deve aparecer um aviso de que a execução pode demorar mais,
mas ele pode prosseguir mesmo assim.

Ao executar, o sistema carrega os atributos configurados, processa o arquivo de entrada e
gera a base vetorial de acordo com o chunk size, tamanho do banco vetorial e o modelo de
embeddings fixo do sistema. Em seguida, executa cada pergunta contra cada modelo LLM
selecionado, reaproveitando o fluxo de consulta RAG (incluindo guardrails) já existente no
produto, e mede o tempo de resposta de cada execução. Se um modelo falhar ao carregar ou
responder, ele deve ser marcado como falho e os demais modelos/perguntas continuam
normalmente. Se uma pergunta for bloqueada por guardrail, isso deve ficar registrado sem
tentar calcular similaridade para ela. Durante a execução, o usuário deve ver uma
indicação de progresso (qual modelo/pergunta está sendo processado no momento).

A similaridade entre a resposta gerada e a resposta esperada deve ser calculada como um
percentual (0-100%), e comparada com o limiar configurado para gerar um veredito de
aprovação/reprovação.

Ao final, o sistema mostra uma tabela com uma linha por combinação de modelo e pergunta,
contendo a resposta gerada, o percentual de similaridade, o veredito de aprovação/
reprovação, e indicação clara quando o resultado foi bloqueado por guardrail ou falhou.
Além da tabela detalhada, deve haver um resumo de métricas de desempenho agregadas por
modelo: similaridade média, taxa de aprovação, tempo médio de resposta, e quantidade de
perguntas bloqueadas ou falhas — permitindo ao usuário identificar visualmente qual
modelo teve o melhor desempenho.

O usuário deve poder exportar a tabela de resultados completa (incluindo as métricas por
modelo) para um arquivo, uma vez que a bateria de testes tenha sido concluída; a opção de
exportar deve ficar desabilitada enquanto nenhuma bateria tiver sido executada ainda. Não
há necessidade de persistir o histórico de benchmarks entre sessões do navegador.
```

Arquivo criado na `/specs`

## Modificações no Specify
- Não foi necessário

# Etapa de Clarify

## Claude Questions

Foram realizadas 3 perguntas para esclarecimento pelo modelo:

### Question: How should the similarity score be presented to the user in the results table — as a raw numeric score, a percentage, or a pass/fail verdict against a threshold?

| Option | Description |
| --- | --- |
| **A** | Raw numeric score (e.g., 0.0–1.0 cosine similarity), unrounded |
| **B** | Percentage (0–100%), derived from the similarity score |
| **C** | Pass/fail verdict only, based on a similarity threshold (numeric score hidden) |
| **D** | Both a percentage AND a pass/fail verdict against a configurable threshold |
| **Short** | Provide a different short answer (<=5 words) |

- Recommended: Option B - a percentage (0–100%) is the most intuitive for non-technical stakeholders comparing models at a glance, while still being derived from the same underlying cosine-similarity calculation already used by the product's guardrails.

Foi escolhida a opção recomendada

### Question: Should there be a limit on how many LLM models and test questions a user can include in a single benchmark run?

| Option | Description |
| --- | --- |
| **A** | No enforced limit — user can select as many models/questions as they want, at their own risk |
| **B** | Soft cap with a warning (e.g., recommend ≤5 models and ≤20 questions) but still allow proceeding |
| **C** | Hard cap that blocks execution beyond a fixed limit (e.g., max 5 models, max 20 questions) |
| **Short** | Provide a different short answer (<=5 words) |

- Recommended: Option B - cap at a modest number (e.g., 5 models × 20 questions) with a clear warning if exceeded; this keeps a full run within a few minutes-to-tens-of-minutes on typical hardware while still allowing meaningful comparisons.

Foi escolhida a opção recomendada

### Question: When the user defines "vector database size," is that a limit on the number of chunks stored, or a limit on storage size (e.g., MB)?

| Option | Description |
| --- | --- |
| **A** | Maximum number of chunks (count-based limit) |
| **B** | Maximum storage size in MB (size-based limit) |
| **Short** | Provide a different short answer (<=5 words) |

Recommended: Option A - a maximum chunk count is simpler to reason about, matches how the existing VectorStore service already models entries (one row per chunk), and keeps the truncation behavior already described in the Edge Cases section consistent.

Foi escolhida a opção recomendada

### Observação

Modelo retornou que deixou de fazer mais questões pois inferiu:

All three clarifications have addressed the highest-impact ambiguities (similarity presentation, run-size limits, vector DB size unit). Remaining gaps (e.g., data-privacy handling of exported patient-document content) are lower-impact and already covered implicitly by the existing local-only architecture assumption, so I'll stop questioning here.

## Report do Clarify

Coverage summary:

| Category | Status |
| --- | --- |
| **Functional Scope & Behavior** | Clear |
| **Domain & Data Model** | Resolved (vector DB size unit) |
| **Interaction & UX Flow** | Clear |
| **Non-Functional: Performance/Scale** | Resolved (run-size soft cap) |
| **Non-Functional: Security/Privacy** | Outstanding (low impact — covered implicitly by existing local-only architecture assumption) |
| **Integration & External Dependencies** | Clear |
| **Edge Cases & Failure Handling** | Clear |
| **Constraints & Tradeoffs** | Clear |
| **Terminology & Consistency** | Clear |
| **Completion Signals** | Resolved (similarity presentation) |

# Etapa de Plan

```
/speckit.plan Implementar como uma nova feature com rota lazy-loaded em
src/app/benchmark, acessível a partir do menu principal, separada da tela de chat.

Reaproveitar a infraestrutura já existente no produto para:
- Carregamento e execução dos modelos LLM localmente via WebLLM (o mesmo serviço/wrapper
  usado no fluxo principal de chat.
- Os modelos selecionáveis devem ser: Phi-4-mini, Google Gemma 4 e Qwen3-8B
- Processamento de documentos PDF e chunking, reaproveitando o código existente.
- Geração de embeddings e banco vetorial, reaproveitando o código existente.
- Fluxo de consulta RAG e guardrails, reaproveitando o código existente.

Estrutura de componentes sugerida:
- BenchmarkConfigComponent: formulário reativo (Reactive Forms) para os atributos da
  configuração — seleção múltipla de modelos, chunk size, tamanho máximo do banco vetorial
  (número de chunks), upload/seleção do arquivo PDF, seleção do modelo de embeddings,
  threshold de similaridade, e uma lista editável de perguntas de teste (pergunta +
  resposta esperada), com validação bloqueando o início da execução quando campos
  obrigatórios estiverem ausentes e um aviso (não bloqueante) acima de 5 modelos ou 20
  perguntas.
- BenchmarkRunnerService: orquestra a execução — processa o PDF e gera a base vetorial uma
  vez, depois itera sequencialmente sobre cada modelo selecionado e, para cada um, executa
  todas as perguntas configuradas contra o fluxo RAG existente, capturando resposta gerada,
  tempo de resposta e status (ok / bloqueado por guardrail / falho). Deve emitir progresso
  (ex.: via Observable/Signal) para a UI, e isolar falhas por modelo sem interromper os
  demais.
- SimilarityService: calcula o percentual de similaridade (0–100%) entre resposta gerada e resposta esperada, e deriva
  o veredito aprovado/reprovado comparando com o threshold configurado.
- BenchmarkResultsComponent: exibe a tabela de resultados (uma linha por par
  modelo/pergunta) usando [componente de tabela do projeto, ex.: mat-table], mostrando
  resposta gerada, similaridade, veredito, e status de bloqueio/falha destacado
  visualmente; e um bloco de resumo por modelo (similaridade média, taxa de aprovação,
  tempo médio de resposta, contagem de bloqueios/falhas).
- Botão de exportação (CSV) na tela de resultados, habilitado somente após uma execução
  concluída, gerando um arquivo com todas as linhas de resultado e o resumo por modelo.

Estado da execução (configuração, progresso, resultados) deve viver em um service/store do
próprio módulo de benchmark, sem persistência entre sessões do navegador (não usar
localStorage nem backend para isso).

Seguir o padrão de standalone components, TypeScript estrito e organização de pastas já
usados em src/app, e usar SCSS para os componentes visuais.
```

research
quickstart	data-model plan

# Tasks

Completion Report
Generated: specs/001-llm-benchmark/tasks.md

Total tasks: 49 (T001–T049)

Breakdown:

| Phase | Tasks | Count |
| --- | --- | --- |
| **Setup** | T001–T003 | 3 |
| **Foundational (blocking)** | T004–T015 | 12 |
| **US1 — Configurar e executar (P1, MVP)** | T016–T034 | 19 (17 impl + 2 test) |
| **US2 — Visualizar resultados e métricas (P2)** | T035–T042 | 8 (6 impl + 2 test) |
| **US3 — Exportar resultados (P3)** | T043–T045 | 3 (2 impl + 1 test) |
| **Polish & cross-cutting** | T046–T049 | 4 |

Parallel opportunities: nav setup (T002/T003), the three independent Foundational edits (T004/T008/T009), the four Foundational test tasks (T012–T015), five independent form-field tasks within US1 (T018–T022), and both US1/US2/US3 test tasks within their own phases.

Independent test criteria: stated per story in tasks.md — US1: one model/one question run produces a result row (inspectable pre-UI); US2: results table + per-model summary render correctly; US3: Export is disabled pre-run and produces a valid CSV post-run.

Suggested MVP scope: Phases 1–3 (Setup + Foundational + User Story 1) — this alone proves the highest-risk mechanics (sequential model swapping via the now-fixed LlmClient.setModel, an isolated benchmark vector store, and similarity scoring against a user-supplied expected answer).

Format validation: All 49 tasks follow - [ ] T### [P?] [Story?] Description with exact file path — checkbox, sequential ID, [P] only where the task's files don't conflict with an incomplete task, [US1]/[US2]/[US3] labels present only on Phase 3–5 tasks (absent from Setup/Foundational/Polish), and every task names its concrete file path(s).

Ready for /speckit-analyze to cross-check spec.md, plan.md, and tasks.md for consistency, or directly for /speckit-implement.

# Analyze 

No primeiro analyze foram encontradas as seguintes issues:

Total Requirements: 24 (19 FR incl. FR-006a/FR-008a, 5 SC)
Total Tasks: 49
Coverage %: 100% have ≥1 task, but 3 requirements (FR-006, FR-009, FR-010) carry a Partial flag due to I1/I2/U1
Ambiguity Count: 1
Duplication Count: 0
Critical Issues Count: 2

Constitution Alignment Issues: None found beyond I1/I2 above, which are architecture-level (DI/singleton) gaps rather than direct principle violations — no MUST principle is textually contradicted, but I2 specifically threatens the plan's own stated constraint ("não pode regredir o comportamento existente do fluxo de chat"), which functions as a self-imposed gate.

Unmapped Tasks: None outside expected Setup (T001) and Polish (T046–T049), which by design don't map 1:1 to a single FR.

CRITICAL issues (I1, I2) exist and should be resolved before /speckit-implement — both concern the same root cause (shared Angular singletons VectorStore/RagEngine/LlmClient being reused by both chat and benchmark without a defined isolation strategy), and both risk silently corrupting the existing chat experience, which the plan explicitly promises not to regress.

Suggested paths:

Re-run /speckit-plan (or manually edit research.md + plan.md + tasks.md T026–T028) to pin down the DI isolation strategy for VectorStore/RagEngine/LlmClient during a benchmark run.
For U1 (HIGH, not blocking), either amend spec.md FR-006/Assumptions to document the single-embedding-model scope reduction, or expand tasks.md T021 into a real selector — your call.
A1 (LOW) can be left as-is or tightened later; not blocking.

Foram realizadas manualmente as correções nos arquivos research.md + plan.md + tasks.md T026–T028 (conforme sugestão) incluindo os pontos solicitados.

## Plan 2.0
 
Executei novamente o plan e o modelo identificou que eu ajustei manualmente:

```
You'd manually added three new decisions to research.md since the last /speckit-analyze — they directly resolve the two CRITICAL and one HIGH findings from that report:

#11: VectorStore/RagEngine isolation via component-level DI providers + an InjectionToken<string> for dbName (resolves I1)
#12: LlmClient snapshot → lock → restore pattern around model swaps, since it stays a strict singleton (resolves I2)
#13: Embedding model is fixed/read-only for the MVP, with an explicit rationale (switching would invalidate the whole vector DB) — resolves U1
```

Dessa forma ele atualizou mais alguns arquivos

```
I updated the design artifacts to match:
```

## Tasks 2.0

Executei novamente o tasks e o modelo identificou que eu ajustei manualmente e modificou o tasks

# Analyse 2.0

No segundo analyze foram encontradas as seguintes issues relativas ao que foi incluido na nova versão:

Total Requirements: 24 (19 FR incl. FR-006a/FR-008a, 5 SC)
Total Tasks: 51
Coverage %: 100% have ≥1 task (up from the prior pass's 3 Partial flags — all now Yes, modulo I3/U2 above)
Ambiguity Count: 1 (A2)
Duplication Count: 0
Critical Issues Count: 0 (down from 2 — I1/I2 are closed)

Novamente, foram realizadas manualmente as correções nos arquivos research.md + plan.md + tasks.md T026–T028 (conforme sugestão) incluindo os pontos solicitados.

Apesar de retornar apenas uma ambiguidade no contador, na tabela de issues ele trouxe uma issue critica também.

Aqui ele sugeriu descartar uma feature devido a complexidade, feature de mudar o modelo de embedding, pois a cada teste teria que rodar todo o banco vetorial novamente, segui a sugestão.

# Plan 3.0 e Tasks 3.0

Foram executados novamente o plan e tasks para refletir as modificações, o modelo identificou que ajustei manualmente e só incluiu informações complementares.

# Analyze 3.0

Por fim, após as 2 modificações, não foram mais encontradas inconscistencias: 

Total Requirements: 24 (19 FR incl. FR-006a/FR-008a, 5 SC)
Total Tasks: 55
Coverage %: 100%
Ambiguity Count: 0
Duplication Count: 0
Critical Issues Count: 0

# Implement

O Implement foi executado com sucesso:

```
All tasks in tasks.md are now complete (T001–T055).
```

O processo foi bastante demorado (~45m) e travou uma vez, mas como ele vai marcando a lista de tasks, ele seguiu de onde tinha parado.

## Converge

Retornou apenas questões de nomenclatura

- [ ] T057 Rename the `"Phi-4-mini"` and `"Google Gemma 4"` display labels in `LlmClient.availableModels` (`src/app/services/llm-client.ts`) to accurately reflect the actual model families being run (`Phi-3.5-mini-instruct` and `gemma-2-2b-it` — the closest available in the installed `@mlc-ai/web-llm` package, since no Phi-4 or Gemma-3/4 build exists yet), so benchmark results are not misattributed to a model family that never actually ran, per FR-002/SC-005 (contradicts)