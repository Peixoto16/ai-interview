---
name: add-eval-case
description: Adiciona um caso à suíte de evals ou ao golden set (nova falha real, nova discordância judge x humano, novo ataque). Use quando o usuário relatar um bug da IA ou pedir mais cobertura de avaliação.
---
# Adicionar caso de eval

1. Classifique: code-based (determinístico), golden set (nota humana por dimensão) ou model-graded.
2. Code-based: escreva primeiro o teste que falha em `test/`, citando o VC da spec; depois corrija o harness.
3. Golden set: adicione a transcrição em `evals/golden-set.json` com a nota humana (1 a 5) nas 4 dimensões. A nota é do USUÁRIO; pergunte, não invente.
4. Se o caso revela requisito novo, atualize `docs/spec.md` (EARS) antes do código.
5. Rode `npm test` e registre o resultado.
