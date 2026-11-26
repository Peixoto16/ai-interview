# SPEC: Entrevista conduzida por IA (v1)

Fonte da verdade para o comportamento da entrevista. Critérios em EARS; cada um vira teste.

## Outcomes
- Uma pessoa é entrevistada por uma IA sobre uma vaga escolhida e recebe, ao final, uma nota (0 a 100) com pontos fortes e preocupações.

## Scope boundaries
- DENTRO: entrevista por turnos de texto, follow-ups, nota final com evidência, sessão salva como registro reproduzível.
- FORA (v1): voz, vídeo, vários entrevistadores, banco de dados persistente (usar memória atrás de uma interface).

## Constraints
- A chave da API nunca chega ao navegador.
- A resposta do candidato é NÃO CONFIÁVEL (superfície de prompt injection).
- Reprodutibilidade: a mesma sessão salva, com as saídas da IA gravadas, produz a mesma nota.

## Prior decisions
- A IA é a policy (só propõe). O código é o harness (decide e impõe).
- A nota final é calculada em código, nunca pela IA.
- Config padrão: minQuestions=6, minFollowUps=2, maxQuestions=12; pesos: technical_depth 0.40, problem_solving 0.25, communication 0.20, role_fit 0.15.

## Verification criteria (EARS)
- VC-01 O sistema NÃO DEVE aceitar pedido de encerramento da IA antes de registrar pelo menos 6 perguntas e 2 follow-ups VERIFICADOS.
- VC-02 QUANDO a IA propõe encerrar E os mínimos foram atingidos, o sistema DEVE encerrar e registrar o motivo "gate".
- VC-03 ENQUANTO os mínimos não foram atingidos, o sistema NÃO DEVE encerrar por pedido da IA.
- VC-04 SE a entrevista atingir o máximo de perguntas, ENTÃO o sistema DEVE encerrar, registrar o motivo "max" e marcar como incompleta se os mínimos não foram atingidos. Se no mesmo turno valer o VC-02 (IA quer encerrar E mínimos atingidos), o motivo é "gate".
- VC-05 O sistema DEVE tratar a primeira pergunta como não follow-up.
- VC-06 O sistema NÃO DEVE aceitar config com máximo < mínimo, nem minFollowUps > minQuestions - 1, nem pesos que não somam 1.
- VC-07 Um follow-up é VERIFICADO se a pergunta compartilha >= 2 palavras de conteúdo com a resposta anterior E elas somam >= 20% das palavras de conteúdo da pergunta. O campo `isFollowUp` da IA DEVE ser ignorado. A pergunta de reserva (VC-10) NUNCA conta como follow-up.
- VC-08 SE a resposta do candidato contém padrão de injeção, ENTÃO o sistema DEVE levantar uma bandeira que a opinião da IA não derruba. O detector só lê falas do candidato. A bandeira não encerra a entrevista (alarme, não muro), e o follow-up de um turno com bandeira NÃO conta como verificado.
- VC-09 O sistema DEVE calcular a nota final por função determinística sobre notas por dimensão (inteiros de 1 a 5, sem repetir nem faltar) e NÃO DEVE aceitar nota final vinda da IA.
- VC-10 SE a proposta da IA vier inválida, ENTÃO o sistema DEVE usar a pergunta de reserva ligada à vaga, que nunca encerra, e registrar o motivo.
- VC-11 O replay de uma sessão salva DEVE recalcular contadores, motivo de fim, bandeiras e nota sem chamar a IA e obter os valores gravados. Qualquer diferença entre o gravado e o recalculado DEVE ser apontada campo a campo.
- VC-12 As ferramentas da IA DEVEM ser só de leitura, sem parâmetro de ID, e argumentos fora do schema DEVEM ser rejeitados com erro registrado.
- VC-13 A IA avaliadora (judge) NÃO DEVE ser usada a menos que, no golden set (12+ entrevistas com nota humana), tenha kappa quadrático >= 0,6 no geral E em cada área, E viés médio de no máximo 0,5 ponto no geral E em cada área.

## Task breakdown
Fase 1 tipos + spec do harness → 2 follow-up/portão/nota/plano B → 3 detector + replay → 4 evals + golden set
→ 5 policy e judge (LLM) → 6 segurança/ferramentas → 7 rotas + loop → 8 tela → 9 ADR/probe.
