---
paths:
  - "src/harness/**"
---
# Regra: harness-puro

**Obrigatório:** sim

Tudo em `src/harness/` é função pura: só usa as entradas, sem efeitos colaterais, sem rede, sem `Date.now()` ou `Math.random()`, sem importar o cliente de LLM. Mesma entrada, mesma saída.

Padrão reducer: `applyTurn(state, rawProposal: unknown, answer, config) -> novoState`.
Ordens de soma e de ordenação fixas (determinismo e replay).

Errado: `if (proposal.isFollowUp) verified++`
Certo: `verified += verifyFollowUp(proposal.nextQuestion, prev.answer) ? 1 : 0`
