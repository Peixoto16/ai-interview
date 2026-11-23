---
paths:
  - "src/policy/**"
  - "src/judge/**"
---
# Regra: llm-integration

**Obrigatório:** sim

- Policy e judge são os ÚNICOS lugares que chamam o LLM. Todo o resto é determinístico.
- Saída do modelo entra como `unknown` e é validada antes de uso. Inválida ou erro de rede → plano B (`fallbackProposal`), nunca erro para o usuário.
- A policy propõe `{nextQuestion, isFollowUp, signals, done}`; esses campos são auto-relato.
- O judge devolve só notas por dimensão (1 a 5) com evidência citada; a nota final é calculada em código.
- Grave as saídas BRUTAS do modelo (propostas e notas) e `modelVersion`/`promptVersion` em cada sessão, para o replay.
- `temperature: 0` reduz variação mas não garante saída idêntica.
- Janela do entrevistador: papel + vaga + regra de encerramento (sempre); transcrição (por turno, marcada como não confiável). Contadores e regras de nota ficam FORA da janela.
- Antes de usar um recurso novo da API, rode um probe (medir, não supor) e registre em ADR.
