# Roteiro: construir o AI Interview aprendendo a escada de 2026

Ordem do livro: **de dentro (determinístico) para fora (modelo e tela)**.
Regra do aprendizado: você escreve os artefatos-chave; eu implemento o resto e reviso.
Ao fim de cada fase, responda em voz alta os "Pare e responda" do capítulo.

| Fase | Degrau (capítulo) | Você escreve | Eu construo | Pronto quando |
|---|---|---|---|---|
| 0 | Prompt + Context (Cap. 2, 3) | orçamento de contexto do entrevistador | CLAUDE.md, rules, hook, subagente, skill | você explica o que é pedido (CLAUDE.md) e o que é garantia (hook) |
| 1 | Spec-driven (Cap. 4) | revisa/ajusta `docs/spec.md` em EARS | `types.ts`, `validateConfig` + testes | VC-06 verde |
| 2 | Harness (Cap. 5) | contrato do harness (texto) | `verifyFollowUp`, `decideEnd`, `applyTurn`, plano B, `finalScore` | VC-01..05, 07, 09, 10 verdes |
| 3 | Harness + Segurança (Cap. 5, 8) | threat model (1 página) | `detectInjection`, `runSession`, `replay` | VC-08, 11 verdes |
| 4 | Eval-driven (Cap. 7) | a suíte de evals; 12+ itens do golden set com nota sua | evals code-based, teste "IA mentindo", `judge-agreement` | "IA mentindo" verde; quebrar o portão de propósito deixa testes vermelhos |
| 5 | Context + Loop (Cap. 3, 6) | loop spec da entrevista | policy (Claude) e judge (Claude) com saída validada | entrevista roda de ponta a ponta no terminal |
| 6 | Segurança de sistema (Cap. 8) | — | `tool-scope`: fábrica com closure, só leitura, args estritos | VC-12 verde |
| 7 | Loop + rotas (Cap. 6) | — | API fina (sessionId da rota), store atrás de interface | rota não decide nada |
| 8 | Tela | — | UI de texto (voz depois) | entrevista no navegador |
| 9 | Decisão (Cap. 10) | ADR + probe | script de probe do gateway | ADR com evidência |
| 10 | Fronteira (Cap. 11) | — | subagentes/graph se fizer sentido | opcional |

## Exercícios de fixação (do livro)
1. Desenhe a escada de memória. 2. Reescreva spec, contrato, loop spec e evals do zero.
3. Quebre o portão de propósito (`aiDone && gateMet` → `aiDone`) e veja os testes vermelhos.
4. Explique "por que a nota é calculada em código" a alguém não técnico.

## Estado atual
- [x] Fase 0: harness do projeto criado
- [x] Fase 1: `types.ts`, `validateConfig`, VC-06 verde (4 testes)
- [x] Fase 2: portão, verifyFollowUp, applyTurn, plano B, finalScore; 41 testes verdes; revisado por verificador
- [ ] Fase 3
