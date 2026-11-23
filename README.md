# AI Interview

Um entrevistador de IA: a IA conduz a entrevista de uma vaga e, no final, o sistema dá uma nota de 0 a 100 com pontos fortes e preocupações.

> **A IA propõe; o código decide.** Agente = Modelo + Harness.

O projeto é construído **fase a fase**, como exercício de aprendizado de engenharia de IA, seguindo o livro *Se você não é o modelo, você é o harness* (Lucas Albuquerque, DEVSMAFIA, 2026).

## A ideia central

Uma IA é criativa, mas não é confiável: ela pode querer encerrar a entrevista cedo, dizer que uma pergunta é de aprofundamento sem ser, ou devolver um texto quebrado. Por isso as decisões **não ficam com a IA**. Ficam em funções puras de código (o *harness*), testadas uma a uma.

> **Regra de Ouro:** requisito mora no código (determinístico), nunca no pedido à IA (prompt).

| A IA (policy) faz | O código (harness) faz |
| --- | --- |
| propõe a próxima pergunta | valida que a proposta tem a forma certa |
| diz "acho que podemos acabar" | só deixa acabar com 6 perguntas e 2 follow-ups **verificados** |
| diz "isso é um follow-up" | confere por conta própria, pelas palavras em comum |
| dá notas de 1 a 5 por dimensão | calcula a nota final de 0 a 100 |

## Estado atual

| Fase | O que é | Estado |
| --- | --- | --- |
| 0 | Harness do projeto (CLAUDE.md, regras, hook do `.env`, subagente, skills) | feito |
| 1 | Spec em EARS, tipos e `validateConfig` | feito |
| 2 | Portão de fim, verificação de follow-up, `applyTurn`, plano B, nota final | feito |
| 3 | Detector de injeção e replay de sessões | próximo |
| 4 a 10 | Evals, integração com Claude, ferramentas, API, tela, ADR | planejado |

Hoje o projeto tem **só o harness** (a parte determinística). Ainda **não** chama nenhum modelo de IA, não tem API nem tela. O roteiro completo está em [docs/ROADMAP.md](docs/ROADMAP.md).

## Como rodar os testes

Requisitos: [Node.js](https://nodejs.org) 22 ou mais novo (testado na v26). Não há dependências para instalar.

```bash
npm test
```

Os testes rodam TypeScript direto no Node (`--experimental-strip-types`) com o `node:test`. Hoje são **41 testes**, incluindo o mais importante do projeto: *uma IA mentindo em todo turno não consegue encerrar a entrevista cedo*.

## Estrutura

```
ai-interview/
├── src/harness/        # decisões: funções puras, sem rede, sem relógio, sem LLM
│   ├── types.ts        # formato dos dados
│   ├── config.ts       # números padrão (6 / 2 / 12) e validateConfig
│   ├── gate.ts         # o portão: pode encerrar agora?
│   ├── followup.ts     # confere se uma pergunta aprofunda a resposta anterior
│   ├── proposal.ts     # valida a proposta da IA (entra como `unknown`)
│   ├── turn.ts         # applyTurn: um turno da entrevista (padrão reducer) e plano B
│   └── score.ts        # nota final calculada em código
├── test/               # um teste por critério da spec (nome cita o VC)
├── docs/
│   ├── spec.md         # as 12 regras da entrevista (VC-01 a VC-12)
│   ├── contrato-harness.md
│   └── ROADMAP.md      # as fases do projeto
└── .claude/            # regras, hook e agentes para o Claude Code trabalhar no projeto
```

## As regras da entrevista

Escritas em [docs/spec.md](docs/spec.md) como frases testáveis (formato EARS). Em resumo:

- **6** perguntas no mínimo, **2** follow-ups verificados no mínimo, **12** perguntas no máximo.
- A primeira pergunta nunca é follow-up.
- Se a resposta da IA vier inválida, entra uma pergunta de reserva da vaga, que nunca encerra.
- A nota final é uma conta sobre notas de 1 a 5 por dimensão (profundidade técnica 40%, resolução de problemas 25%, comunicação 20%, adequação à vaga 15%). A IA nunca informa a nota final.

## Segurança

- A resposta do candidato é **dado não confiável**: nunca é seguida como instrução.
- A chave da API fica só em `.env` (use `.env.example` como modelo). O arquivo `.env` nunca vai para o git.
- Saída de IA entra como `unknown` e é validada antes de ser usada.

## Como contribuir

A branch `main` é protegida: toda mudança entra por Pull Request. Siga o fluxo da spec: regra na spec, teste que falha, código mínimo, `npm test` verde.
