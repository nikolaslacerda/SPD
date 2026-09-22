# RAG Takere — Assistente Médico Local

Protótipo de um agente de inteligência artificial executado localmente no navegador para auxiliar pacientes recentemente submetidos a transplante cardíaco, desenvolvido como projeto de extensão para o **TAKERE**, no Hospital de Clínicas de Porto Alegre (HCPA).

O objetivo do projeto é explorar uma arquitetura de **RAG (Retrieval-Augmented Generation)** capaz de responder perguntas com base em documentos de referência do plano de cuidado do paciente, mantendo o processamento de IA no próprio dispositivo sempre que possível.

O sistema combina uma interface web em Angular, modelos locais executados no navegador, geração de embeddings, armazenamento vetorial local e mecanismos de guardrail para impedir que perguntas ou respostas sem suporte suficiente na base sejam utilizadas.

> **Importante:** este projeto é um protótipo de pesquisa/extensão e não deve ser considerado um sistema médico de produção ou uma ferramenta de diagnóstico, prescrição ou tomada de decisão clínica.

---

## 1. Objetivo

O projeto busca criar um assistente conversacional que permita ao paciente consultar informações presentes em seu plano de cuidado de maneira simples e natural.

A arquitetura foi pensada especialmente para um cenário em que:

* o agente deve funcionar localmente;
* a aplicação deve continuar utilizável sem depender de um backend de IA;
* os modelos de IA podem ser armazenados no dispositivo;
* os documentos utilizados pelo RAG ficam no armazenamento local do navegador;
* as consultas são realizadas sobre uma base vetorial local;
* o sistema deve possuir mecanismos para bloquear respostas que não tenham suporte suficiente na base.

A ideia central é:

```text
Paciente
   │
   ▼
Interface Angular
   │
   ▼
Pergunta
   │
   ▼
Embedding da pergunta
   │
   ▼
Busca na base vetorial
   │
   ▼
Guardrail da pergunta
   │
   ├── Rejeitada → mensagem padrão
   │
   ▼
Contexto relevante
   │
   ▼
LLM local
   │
   ▼
Resposta
   │
   ▼
Embedding da resposta
   │
   ▼
Nova busca na base vetorial
   │
   ▼
Guardrail da resposta
   │
   ├── Rejeitada → mensagem padrão
   │
   ▼
Resposta apresentada ao usuário
```

---

## 2. Estado atual

O protótipo atualmente possui uma implementação funcional do fluxo principal de RAG.

### Funcionalidades implementadas

* Interface web em Angular.
* Execução de LLM local através do navegador.
* Execução local do modelo de embeddings.
* Armazenamento vetorial utilizando IndexedDB.
* Upload e processamento de arquivos PDF.
* Divisão dos documentos em chunks.
* Geração de embeddings dos chunks.
* Busca semântica por similaridade de cosseno.
* Opção de busca híbrida combinando busca semântica e palavras-chave.
* Geração de respostas utilizando contexto recuperado da base.
* Streaming da resposta token a token.
* Histórico de conversação.
* Citações de páginas dos documentos.
* Cache local dos modelos e recursos utilizados pelo navegador.
* Guardrail para bloquear perguntas com baixa similaridade com a base.
* Guardrail para validar a resposta gerada contra a base vetorial.
* Armazenamento dos documentos e embeddings no dispositivo.

O fluxo principal está concentrado no serviço `RagEngine`, enquanto as responsabilidades de LLM, embeddings, PDF e armazenamento vetorial estão separadas em serviços próprios.

---

# 3. Tecnologias

## Angular

O frontend é desenvolvido utilizando **Angular 20** e TypeScript.

O Angular é responsável pela interface da aplicação, gerenciamento da interação com o usuário e integração dos diferentes serviços responsáveis pelo pipeline de IA.

A configuração do projeto utiliza Angular CLI e TypeScript 5.9.

---

## WebLLM

A execução do modelo de linguagem é realizada através do **WebLLM**, utilizando WebGPU para executar a inferência diretamente no navegador.

Atualmente o projeto utiliza:

```text
Llama-3.2-3B-Instruct-q4f16_1-MLC
```

O modelo possui aproximadamente 1,5 GB e é executado no dispositivo do usuário.

O serviço `LlmClient` inicializa o WebLLM, verifica a disponibilidade do WebGPU e realiza a geração em streaming.

A geração utiliza:

* WebLLM;
* WebGPU;
* streaming de tokens;
* temperatura `0.7`;
* `top_p = 0.9`;
* máximo de 512 tokens.

O streaming permite que a interface mostre a resposta enquanto ela está sendo produzida.

---

## Transformers.js

Os embeddings são produzidos utilizando **Transformers.js**.

O modelo atualmente utilizado é:

```text
Xenova/all-MiniLM-L6-v2
```

O modelo é executado no navegador através do runtime ONNX/WebAssembly.

O embedding utiliza:

```text
pooling: mean
normalize: true
```

A normalização permite utilizar diretamente a similaridade de cosseno para comparar os vetores.

---

## ONNX Runtime Web

O `onnxruntime-web` fornece o runtime necessário para executar modelos compatíveis com ONNX no ambiente do navegador.

Ele é utilizado como parte da infraestrutura de execução do modelo de embeddings.

---

## IndexedDB

A base vetorial é armazenada localmente utilizando **IndexedDB**.

O serviço `VectorStore` cria um banco chamado:

```text
takere-db
```

com um object store chamado:

```text
chunks
```

Cada chunk contém:

```typescript
{
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, any>;
}
```

Os metadados atualmente incluem informações como:

* nome do arquivo;
* índice do chunk;
* número da página.

Isso permite que a base vetorial exista diretamente no dispositivo do usuário, sem a necessidade de um banco de dados remoto.

---

## PDF.js

O processamento dos documentos PDF é realizado através do `pdfjs-dist`.

O `PdfParser`:

1. recebe o arquivo enviado pelo usuário;
2. lê o conteúdo do PDF;
3. percorre suas páginas;
4. extrai o texto;
5. divide o conteúdo em chunks;
6. mantém o número da página como metadado.

Atualmente o chunking utiliza blocos simples de aproximadamente 500 caracteres.

---

## RxJS

O RxJS é utilizado principalmente para comunicação de estado e progresso entre os serviços e a interface.

Por exemplo, o `LlmClient` expõe o progresso de carregamento do modelo através de um `Observable`.

---

# 4. Estrutura do projeto

A estrutura principal atualmente é:

```text
rag-takere/
├── scripts/
│   └── generate-version.js
│
├── src/
│   ├── app/
│   │   ├── home/
│   │   │
│   │   ├── services/
│   │   │   ├── embedder.ts
│   │   │   ├── llm-client.ts
│   │   │   ├── llm-client-weinfer.ts
│   │   │   ├── pdf-parser.ts
│   │   │   ├── rag-engine.ts
│   │   │   ├── rag-engine-weinfer.ts
│   │   │   └── vector-store.ts
│   │   │
│   │   ├── app.ts
│   │   ├── app.config.ts
│   │   ├── app.routes.ts
│   │   └── version.ts
│   │
│   ├── lib/
│   │   └── weinfer/
│   │
│   ├── index.html
│   ├── main.ts
│   └── styles.scss
│
├── angular.json
├── package.json
├── package-lock.json
├── patch-transformers.js
├── tsconfig.json
└── vercel.json
```

A estrutura real do repositório possui atualmente os serviços de embedding, LLM, PDF, RAG e armazenamento vetorial, além de implementações alternativas relacionadas ao WeInfer.

---

# 5. Responsabilidade dos principais serviços

## `RagEngine`

É o principal orquestrador do sistema.

Responsável por:

* inicializar os componentes;
* processar documentos;
* gerar embeddings;
* consultar o Vector Store;
* construir o contexto;
* montar o prompt;
* chamar o LLM;
* executar os guardrails;
* retornar a resposta final.

O fluxo principal de consulta está implementado em `src/app/services/rag-engine.ts`.

---

## `LlmClient`

Responsável pela comunicação com o modelo de linguagem local.

Principais responsabilidades:

* verificar WebGPU;
* inicializar WebLLM;
* carregar o modelo;
* acompanhar o progresso de carregamento;
* gerar respostas;
* transmitir tokens para a interface.

---

## `Embedder`

Responsável por transformar texto em vetores.

É utilizado tanto para:

* indexação dos documentos;
* representação vetorial das perguntas;
* validação das respostas produzidas pelo agente.

---

## `VectorStore`

Responsável pelo armazenamento e recuperação dos chunks.

Atualmente utiliza IndexedDB e calcula a similaridade de cosseno entre embeddings.

A busca padrão calcula:

```text
cosineSimilarity(queryEmbedding, chunkEmbedding)
```

e retorna os chunks com maior similaridade.

---

## `PdfParser`

Responsável pela ingestão de documentos PDF.

Atualmente utiliza uma estratégia simples:

```text
PDF
 ↓
páginas
 ↓
texto
 ↓
chunks de ~500 caracteres
 ↓
embedding
 ↓
IndexedDB
```

---

# 6. Ingestão de documentos

Quando um PDF é enviado para a aplicação, o processo é:

```text
Arquivo PDF
    │
    ▼
PdfParser
    │
    ├── extrai texto
    ├── identifica páginas
    └── cria chunks
    │
    ▼
Embedder
    │
    ▼
Embedding de cada chunk
    │
    ▼
VectorStore
    │
    ▼
IndexedDB
```

Cada chunk é armazenado junto com seu embedding e seus metadados.

Isso permite posteriormente recuperar não apenas o conteúdo, mas também informações como a página de origem.

---

# 7. Pipeline de uma pergunta

Quando o usuário realiza uma pergunta:

### 1. Embedding

A pergunta é transformada em um vetor utilizando o mesmo modelo utilizado para indexar os documentos.

### 2. Busca

O vetor é comparado com os embeddings armazenados no IndexedDB.

### 3. Guardrail da pergunta

O maior score retornado é comparado com `QUERY_THRESHOLD`.

Se o score estiver abaixo do limite, a pergunta é bloqueada:

```text
Não encontrei informações suficientes no plano de cuidado para responder a essa pergunta.
```

Atualmente esse threshold está diretamente no `RagEngine`.

### 4. Construção do contexto

Os chunks mais relevantes são concatenados e enviados ao modelo como contexto.

### 5. Geração

O LLM local gera a resposta com base no contexto recuperado.

### 6. Guardrail da resposta

Após a geração completa:

1. a resposta é transformada em embedding;
2. o embedding é consultado novamente no Vector Store;
3. o melhor score é comparado com `ANSWER_THRESHOLD`.

Se a resposta não atingir o threshold:

```text
Não foi possível validar a resposta com base no plano de cuidado.
```

Caso seja aprovada, a resposta é retornada normalmente.

---

# 8. Guardrails

Os guardrails são atualmente baseados em similaridade vetorial.

Existem dois pontos de controle:

```text
QUERY_THRESHOLD
```

Controla se a pergunta possui relação suficiente com o conteúdo disponível.

E:

```text
ANSWER_THRESHOLD
```

Controla se a resposta gerada possui relação suficiente com o conteúdo disponível.

A arquitetura atual é:

```text
Pergunta
   │
   ▼
Vector Search
   │
   ▼
QUERY_THRESHOLD
   │
   ├── FAIL → bloqueia
   │
   ▼
LLM
   │
   ▼
Resposta completa
   │
   ▼
Embedding
   │
   ▼
Vector Search
   │
   ▼
ANSWER_THRESHOLD
   │
   ├── FAIL → bloqueia
   │
   ▼
Resposta
```

Os thresholds atuais são valores experimentais e **não devem ser considerados valores finais ou clinicamente validados**.

---

# 9. Execução local e privacidade

Uma das características centrais do projeto é executar a IA diretamente no navegador.

O LLM é executado através de WebLLM/WebGPU e os embeddings são produzidos no ambiente do cliente. A base vetorial é armazenada no IndexedDB do navegador.

Isso permite uma arquitetura na qual o processamento principal do RAG pode ocorrer sem um servidor de inferência remoto.

Além disso, o projeto possui mecanismos relacionados ao cache de modelos e recursos do navegador, necessários porque modelos de IA podem possuir tamanho considerável.

Essa característica é especialmente relevante para o contexto do projeto, pois permite investigar uma arquitetura de assistente local sem depender continuamente de serviços externos de IA.

---

# 10. Requisitos

Para executar o agente localmente, é necessário um ambiente compatível com WebGPU.

O `LlmClient` atualmente recomenda:

* Chrome 113+ ou Edge 113+;
* suporte a WebGPU;
* GPU compatível;
* pelo menos 4 GB de RAM disponíveis.

A disponibilidade real de WebGPU depende do hardware, navegador, sistema operacional e drivers utilizados.

Também é necessário Node.js compatível com o ambiente atual do Angular 20.

---

# 11. Como executar

Clone o repositório:

```bash
git clone https://github.com/lucas4c/rag-takere.git
cd rag-takere
```

Instale as dependências:

```bash
npm install
```

O `postinstall` do projeto executa automaticamente o script `patch-transformers.js`.

Depois, execute o servidor de desenvolvimento:

```bash
npm start
```

O script de desenvolvimento está configurado como:

```text
ng serve --host 0.0.0.0
```

Após iniciar, abra a aplicação no navegador.

Na primeira execução, o navegador poderá precisar baixar os modelos utilizados pelo sistema.

---

# 14. Estado atual e próximos passos

O projeto já possui os principais componentes do protótipo funcional:

* base de dados vetorial local;
* agente executando localmente;
* geração de respostas utilizando LLM local;
* perguntas respondidas através de RAG;
* upload e processamento de PDFs;
* embeddings locais;
* armazenamento local;
* guardrail de entrada;
* guardrail de saída;
* streaming da resposta.

O próximo ciclo de desenvolvimento deve priorizar principalmente **avaliação, validação e melhoria da confiabilidade do RAG**.

## 14.1 Avaliação dos guardrails

O principal trabalho pendente é testar sistematicamente:

```text
QUERY_THRESHOLD
ANSWER_THRESHOLD
```

O objetivo é encontrar valores que produzam um equilíbrio adequado entre:

* rejeitar perguntas fora do escopo;
* permitir perguntas legítimas;
* evitar respostas sem suporte suficiente;
* não bloquear respostas corretas por excesso de restrição.

É recomendável criar um conjunto de perguntas de teste classificadas, por exemplo:

```text
Pergunta claramente relacionada
Pergunta parcialmente relacionada
Pergunta ambígua
Pergunta fora do escopo
Pergunta perigosa
```

e registrar os scores produzidos pelo Vector Store.

O mesmo deve ser feito com respostas:

```text
Resposta corretamente fundamentada
Resposta parcialmente fundamentada
Resposta com informação adicional não presente na base
Resposta alucinada
Resposta completamente fora do contexto
```

A partir desses dados será possível escolher os thresholds de maneira empírica, em vez de simplesmente definir um valor arbitrário.

---

## 14.2 Melhoria do guardrail da resposta

Existe atualmente uma característica importante no pipeline:

```text
LLM
 ↓
streaming token a token
 ↓
resposta completa
 ↓
embedding
 ↓
guardrail
```

Isso significa que a interface começa a apresentar a resposta enquanto o LLM ainda está gerando.

O `ANSWER_THRESHOLD`, porém, só pode ser executado depois que a resposta inteira foi produzida, porque o embedding utilizado na validação é gerado sobre a resposta completa.

Consequentemente, uma resposta pode começar a aparecer para o usuário e somente depois ser bloqueada.

Esse comportamento é conhecido e deve ser tratado como um ponto de decisão para a próxima etapa do projeto.

Possíveis caminhos incluem:

* manter o comportamento atual por simplicidade;
* gerar a resposta completamente antes de apresentá-la;
* criar uma interface de resposta provisória;
* executar verificações intermediárias durante a geração;
* desenvolver uma estratégia de validação por sentenças ou blocos;
* combinar o threshold final com outros mecanismos de avaliação.

A decisão deve considerar o impacto na experiência do usuário e, principalmente, a confiabilidade necessária para o contexto médico.

---

# 15. Possíveis melhorias futuras

Além dos guardrails, alguns pontos podem ser explorados futuramente:

### Recuperação

* melhorar a estratégia de chunking;
* testar tamanhos diferentes de chunks;
* utilizar overlap entre chunks;
* avaliar reranking;
* melhorar a busca híbrida;
* avaliar diferentes modelos de embedding.

### Geração

* testar diferentes modelos locais;
* avaliar diferentes parâmetros de geração;
* melhorar o prompt;
* melhorar o tratamento do histórico de conversação.

### Avaliação

* criar dataset de perguntas reais/anotadas;
* medir precisão da recuperação;
* medir taxa de rejeição;
* medir falsos positivos e falsos negativos dos guardrails;
* registrar scores para análise;
* criar testes automatizados do pipeline RAG.

### Interface

* melhorar feedback durante carregamento dos modelos;
* melhorar feedback durante ingestão de documentos;
* melhorar comportamento do streaming;
* melhorar tratamento de respostas bloqueadas;
* melhorar gerenciamento de cache;
* melhorar experiência de primeiro carregamento.

---

# 16. Considerações para quem assumir o projeto

O ponto mais importante para continuar o desenvolvimento é entender que o projeto atualmente é um **protótipo de RAG local**, e não um sistema médico pronto para utilização clínica.

As decisões futuras devem preservar três objetivos principais:

1. **Confiabilidade:** o agente deve responder com base no material fornecido.
2. **Segurança:** perguntas e respostas sem suporte suficiente devem ser bloqueadas.
3. **Execução local:** sempre que possível, manter modelos, embeddings e dados no dispositivo.

Antes de adicionar novas funcionalidades, é recomendável entender primeiro:

```text
RagEngine
   ↓
Embedder
   ↓
VectorStore
   ↓
LlmClient
```

Esses quatro componentes formam o núcleo do sistema.

O `RagEngine` coordena o fluxo, enquanto os demais serviços implementam as partes individuais do pipeline.

---

# 17. Referência rápida

### Desenvolvimento

```bash
npm install
npm start
```

### Build

```bash
npm run build
```

### Testes

```bash
npm test
```

### Principais componentes

| Componente       | Tecnologia                    | Responsabilidade       |
| ---------------- | ----------------------------- | ---------------------- |
| Frontend         | Angular 20                    | Interface              |
| Linguagem        | TypeScript 5.9                | Implementação          |
| LLM              | WebLLM                        | Geração local          |
| Modelo LLM       | Llama 3.2 3B                  | Geração                |
| GPU              | WebGPU                        | Inferência local       |
| Embeddings       | Transformers.js               | Vetorização            |
| Modelo embedding | all-MiniLM-L6-v2              | Embeddings             |
| Runtime          | ONNX Runtime Web              | Execução do embedder   |
| PDF              | PDF.js                        | Extração de documentos |
| Vector Store     | IndexedDB                     | Persistência local     |
| Similaridade     | Cosine Similarity             | Busca semântica        |
| Busca híbrida    | Semântica + BM25 simplificado | Recuperação            |
| Frontend reativo | RxJS                          | Estado/progresso       |

---

## Projeto

**RAG Takere**
Projeto de extensão desenvolvido para o **TAKERE — Hospital de Clínicas de Porto Alegre (HCPA)**.

Repositório: [github.com/lucas4c/rag-takere](https://github.com/lucas4c/rag-takere?utm_source=chatgpt.com)

O projeto tem como objetivo servir como base experimental para o desenvolvimento de um assistente médico local utilizando RAG, modelos de linguagem executados no navegador e mecanismos de segurança baseados em recuperação de conhecimento.
