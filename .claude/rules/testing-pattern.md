---
paths:
  - "src/**"
  - "test/**"
---
# Regra: testing-pattern

**Obrigatório:** sim

- Runner: `node:test` (sem dependências). Um teste por critério da spec; o nome do teste cita o VC (ex.: `VC-03: ENQUANTO o mínimo não foi atingido, NÃO encerra`).
- Pirâmide de evals: base larga de checagens de código; judge de LLM só para qualidade aberta e só depois de medido no golden set.
- Entrada hostil sempre: `__proto__`, `sessionId` extra, JSON inválido, texto no lugar de número.
- O teste mais importante: "uma IA mentindo em todo turno não fecha a entrevista" (isFollowUp=true e done=true em tudo, perguntas sem relação → 0 follow-ups verificados, fim só por `max`).
- Toda falha real vira novo caso de eval. Toda discordância judge x humano vira item do golden set.
- Nunca altere um teste para fazê-lo passar. Se o teste está errado, diga por quê e peça aprovação.
