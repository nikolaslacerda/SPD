<!--
Sync Impact Report
==================
Version change: (unratified template) → 1.0.0
Rationale: Initial ratification. The prior file was an unfilled template scaffold with no
concrete principles; this is the first substantive constitution for the project, hence MAJOR
version 1.0.0 (not 0.x) per the "initial adoption" convention.

Modified principles: n/a (no prior named principles existed)

Added sections:
- Core Principles: I. Angular 20 Standalone Architecture, II. Convenção de Estrutura de Pastas,
  III. Reuso de Services e Interceptors HTTP, IV. SCSS para Estilização, V. Reactive Forms para
  Formulários, VI. Testes Unitários Obrigatórios, VII. Lint e Estilo de Código Consistente
- Technology Stack Constraints
- Development Workflow & Quality Gates
- Governance

Removed sections: none (template placeholders only)

Follow-up TODOs:
- TODO(RATIFICATION_DATE): original adoption date prior to this session is unknown; set to the
  date this constitution was first drafted with concrete content (2026-09-22). Confirm with the
  project owner if an earlier date should be used.

Templates requiring alignment (checked, no edits needed — they read the constitution at runtime):
- .specify/templates/plan-template.md ✅ (no constitution-specific text to sync)
- .specify/templates/spec-template.md ✅ (no constitution-specific text to sync)
- .specify/templates/tasks-template.md ✅ (no constitution-specific text to sync)
-->

# RAG Takere Constitution

## Core Principles

### I. Angular 20 Standalone Architecture
O projeto DEVE ser desenvolvido em Angular 20 com TypeScript, utilizando exclusivamente
standalone components (sem `NgModule` para features novas). Todo novo componente, diretiva ou
pipe DEVE ser criado como standalone, seguindo a configuração já presente em `app.config.ts`.
Módulos legados encontrados no código existente podem ser mantidos até serem migrados, mas
código novo NÃO DEVE introduzir novos `NgModule`.
**Rationale**: Standalone components é o padrão atual do Angular 20 e já é o padrão adotado no
projeto; misturar abordagens aumenta a complexidade de bootstrap e manutenção.

### II. Convenção de Estrutura de Pastas
Toda nova funcionalidade DEVE seguir o padrão de pastas já existente em `src/app` (ex.:
`app/home`, `app/services`, `app/lib`). Novos arquivos DEVEM ser posicionados na pasta
correspondente à sua responsabilidade (componente de tela, serviço, biblioteca utilitária) em
vez de criar hierarquias paralelas ou pastas ad-hoc na raiz do projeto.
**Rationale**: Consistência estrutural permite que qualquer colaborador (ou agente) localize e
altere código sem precisar redescobrir convenções a cada feature.

### III. Reuso de Services e Interceptors HTTP
Comunicação com APIs externas e lógica de infraestrutura (ex.: chamadas HTTP, interceptors)
DEVE reutilizar os services e interceptors HTTP já existentes no projeto sempre que a
responsabilidade for compatível. A criação de uma nova biblioteca, serviço duplicado ou
interceptor paralelo SOMENTE é permitida quando houver justificativa explícita registrada na
spec ou no plano da feature (ex.: responsabilidade genuinamente distinta, requisito de
isolamento técnico).
**Rationale**: Evita duplicação de lógica de rede/autenticação e mantém um único ponto de
verdade para cross-cutting concerns como headers, erros e retries.

### IV. SCSS para Estilização
Toda estilização de UI DEVE ser feita em arquivos `.scss`, seguindo o padrão já usado no
projeto (ex.: `styles.scss` global e arquivos de estilo por componente). Estilos inline ou
CSS-in-JS NÃO DEVEM ser usados como padrão, exceto para ajustes pontuais e justificados.
**Rationale**: Mantém consistência visual e aproveita variáveis/mixins SCSS já definidos no
projeto.

### V. Reactive Forms para Formulários
Todo formulário DEVE ser implementado utilizando Reactive Forms (`FormGroup`, `FormControl`,
`FormBuilder`) do Angular. Template-driven forms NÃO DEVEM ser usados em código novo.
**Rationale**: Reactive Forms oferece validação, testabilidade e tipagem mais previsíveis,
essenciais em um sistema que lida com dados de cuidado do paciente.

### VI. Testes Unitários Obrigatórios
Toda nova feature ou alteração relevante DEVE incluir testes unitários para os components e
services afetados, utilizando o setup de testes já configurado no projeto (Karma/Jasmine).
Pull requests que adicionam ou alteram lógica de negócio sem cobertura de teste correspondente
NÃO DEVEM ser mesclados.
**Rationale**: Garante confiabilidade do pipeline de RAG e dos guardrails, cuja falha silenciosa
teria impacto direto na segurança das respostas ao paciente.

### VII. Lint e Estilo de Código Consistente
Todo código DEVE respeitar as regras de lint e formatação já configuradas no projeto (ESLint/
Angular lint e Prettier, conforme `package.json`). Código que viole essas regras NÃO DEVE ser
commitado; exceções DEVEM ser explicitamente sinalizadas com justificativa (ex.: comentário de
desabilitação de regra com motivo).
**Rationale**: Padronização automática reduz atrito em revisão de código e evita divergência de
estilo entre contribuições humanas e geradas por agentes.

## Technology Stack Constraints

O projeto é construído sobre a stack já estabelecida e documentada no `README.md`: Angular 20 +
TypeScript 5.9 no frontend, WebLLM (WebGPU) para inferência local do LLM, Transformers.js +
ONNX Runtime Web para embeddings, IndexedDB para armazenamento vetorial local, PDF.js para
processamento de documentos, e RxJS para comunicação de estado assíncrono. Alterações que
troquem um desses componentes de infraestrutura DEVEM ser tratadas como decisão arquitetural
explícita (registrada em spec/plan), não como escolha incidental durante a implementação de uma
feature.

## Development Workflow & Quality Gates

Antes de uma alteração ser considerada pronta para revisão:
- O código DEVE compilar (`ng build`) e passar nos testes (`ng test`) sem falhas novas.
- O código DEVE seguir as convenções de estrutura, estilo e lint definidas nos Core Principles.
- Novas dependências (bibliotecas externas) SOMENTE DEVEM ser adicionadas quando a
  funcionalidade não puder ser razoavelmente obtida com o stack já presente, e a adição DEVE ser
  justificada na spec ou no plano correspondente.
- Revisões de código (humanas ou de agente) DEVEM verificar aderência a esta constituição antes
  de aprovar o merge.

## Governance

Esta constituição tem precedência sobre outras práticas e convenções informais do projeto. Em
caso de conflito entre esta constituição e um guia, template ou preferência individual, a
constituição prevalece.

**Processo de emenda**: alterações a esta constituição DEVEM ser propostas explicitamente (via
`/speckit-constitution` ou revisão manual do arquivo), indicando o racional da mudança. Toda
emenda DEVE atualizar a seção de versão e o Sync Impact Report correspondente.

**Política de versionamento semântico**:
- MAJOR: remoção ou redefinição incompatível de um princípio existente.
- MINOR: adição de um novo princípio ou expansão material de uma seção existente.
- PATCH: correções de redação, esclarecimentos ou ajustes não semânticos.

**Revisão de conformidade**: toda spec, plano e conjunto de tasks gerado pelo Spec Kit DEVE ser
avaliado quanto à conformidade com esta constituição antes da implementação. Complexidade
adicional (novas libs, novos padrões de formulário, novos frameworks de estilo) DEVE ser
justificada explicitamente ou rejeitada.

**Version**: 1.0.0 | **Ratified**: 2026-09-22 | **Last Amended**: 2026-09-22
