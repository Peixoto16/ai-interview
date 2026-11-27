# Loop spec: a entrevista com o Claude (Fase 5, Cap. 3 e 6)

> RASCUNHO escrito pelo Claude para o dono revisar e reescrever com as próprias palavras.

1. **Objetivo:** entrevistar o candidato por texto sobre uma vaga e, ao final, ter perguntas e respostas suficientes para dar uma nota justa.
2. **O que a IA vê a cada turno:** o papel dela (entrevistadora), a vaga, a regra "proponha a próxima pergunta; você pode sugerir encerrar, mas quem decide é o sistema" e a conversa até agora. A fala do candidato vai dentro de um "envelope" marcado como dado, nunca como ordem.
3. **O que a IA NÃO vê:** contadores, mínimo e máximo de perguntas, regra do portão e regra da nota. O que ela não sabe, ela não tenta burlar.
4. **Cada turno:** pergunta no ar → candidato responde → a IA propõe `{nextQuestion, done}` → o harness (`applyTurn`) confere e decide.
5. **Quando para:** só pelo harness: portão (mínimos atingidos e a IA quer encerrar) ou teto de perguntas. A opinião da IA sozinha nunca encerra.
6. **Se o Claude falhar** (erro, demora acima do limite, recusa, resposta fora do formato): entra a pergunta de reserva (plano B) e a entrevista segue. Nunca aparece erro para o candidato.
7. **Freios:** limite de tempo por chamada, poucas novas tentativas e no máximo uma chamada por pergunta. Como o teto de perguntas é fixo, o laço sempre termina.
8. **Registro:** cada chamada tem a saída bruta gravada, junto com o modelo e a versão do prompt, para o replay refazer tudo sem chamar a IA.
