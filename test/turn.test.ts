import { test } from "node:test";
import assert from "node:assert/strict";
import { startInterview, applyTurn } from "../src/harness/turn.ts";
import { DEFAULT_CONFIG as C } from "../src/harness/config.ts";

const VAGA = {
  openingQuestion: "Fale da sua experiência com bancos de dados",
  fallbackQuestion: "Conte sobre um projeto do qual você se orgulha",
};

test("VC-05: a 1a pergunta conta como pergunta, mas nunca como follow-up", () => {
  const s = startInterview(VAGA);
  assert.equal(s.questionCount, 1);
  assert.equal(s.verifiedFollowUps, 0);
  assert.equal(s.current?.followUpVerified, false);
  assert.equal(s.done, false);
});

test("VC-07: follow-up de verdade sobe o placar", () => {
  const s = applyTurn(
    startInterview(VAGA),
    { nextQuestion: "Como você escolheu os índices compostos do Postgres?", done: false },
    "Usei Postgres com índices compostos para relatórios",
    C,
  );
  assert.equal(s.questionCount, 2);
  assert.equal(s.verifiedFollowUps, 1);
  assert.equal(s.turns.length, 1); // a 1a pergunta foi respondida e foi para o histórico
});

test("VC-07: isFollowUp=true da IA numa pergunta sem relação é IGNORADO", () => {
  const s = applyTurn(
    startInterview(VAGA),
    { nextQuestion: "Qual é o seu hobby favorito?", done: false, isFollowUp: true },
    "Usei Postgres com índices compostos para relatórios",
    C,
  );
  assert.equal(s.verifiedFollowUps, 0);
});

test("VC-03: a IA pede para acabar cedo → NÃO acaba, a pergunta dela segue", () => {
  const s = applyTurn(
    startInterview(VAGA),
    { nextQuestion: "Como você lida com prazos?", done: true },
    "Trabalhei com Postgres",
    C,
  );
  assert.equal(s.done, false);
  assert.equal(s.current?.question, "Como você lida com prazos?");
});

test("VC-02: entrevista completa acaba pelo portão", () => {
  // [resposta da pessoa, proposta da IA]
  const roteiro: [string, unknown][] = [
    ["Usei Postgres com índices compostos para relatórios",
      { nextQuestion: "Como você escolheu os índices compostos do Postgres?", done: false }], // follow-up 1
    ["Analisei o plano de execução", { nextQuestion: "Fale de um projeto difícil", done: false }],
    ["Migrei um monolito para filas com RabbitMQ",
      { nextQuestion: "Por que escolheu RabbitMQ para as filas?", done: false }], // follow-up 2
    ["Pela confiabilidade", { nextQuestion: "Como você lida com prazos?", done: true }], // cedo: 4 perguntas
    ["Planejo bem", { nextQuestion: "Conte sobre trabalho em equipe", done: false }],
    ["Gosto de parear", { nextQuestion: "Obrigado pela conversa", done: true }], // 6 perguntas, 2 follow-ups
  ];
  let s = startInterview(VAGA);
  for (const [resposta, proposta] of roteiro) s = applyTurn(s, proposta, resposta, C);

  assert.equal(s.done, true);
  assert.equal(s.endReason, "gate");
  assert.equal(s.incomplete, false);
  assert.equal(s.questionCount, 6);
  assert.equal(s.verifiedFollowUps, 2);
  assert.equal(s.current, null); // nenhuma pergunta no ar
  assert.equal(s.turns.length, 6);
});

test("VC-10: proposta quebrada → plano B (pergunta reserva), não acaba, motivo registrado", () => {
  const s = applyTurn(startInterview(VAGA), "texto solto, não é objeto", "Trabalhei com Postgres", C);
  assert.equal(s.done, false);
  assert.equal(s.current?.question, VAGA.fallbackQuestion);
  assert.equal(s.current?.source, "fallback");
  assert.equal(s.fallbackLog.length, 1);
  assert.equal(s.questionCount, 2);
});

test("VC-10: plano B nunca encerra, mesmo com a IA tentando { done: true } sem pergunta", () => {
  const s = applyTurn(startInterview(VAGA), { done: true }, "Trabalhei com Postgres", C);
  assert.equal(s.done, false);
  assert.equal(s.current?.source, "fallback");
});

test("VC-07/VC-10: a pergunta reserva NUNCA conta como follow-up (mesmo repetindo palavras)", () => {
  // o candidato "sabe" a pergunta reserva e responde com as palavras dela
  const s = applyTurn(startInterview(VAGA), null, "Um projeto do qual me orgulha muito", C);
  assert.equal(s.current?.source, "fallback");
  assert.equal(s.current?.followUpVerified, false);
  assert.equal(s.verifiedFollowUps, 0);
});

test("harness puro: applyTurn não altera o placar antigo (gera um novo)", () => {
  const antes = startInterview(VAGA);
  const copia = structuredClone(antes);
  applyTurn(antes, { nextQuestion: "Qual seu hobby?", done: false }, "Postgres", C);
  assert.deepEqual(antes, copia);
});

test("VC-04: depois que acabou, novos turnos não mudam nada", () => {
  let s = startInterview(VAGA);
  for (let i = 0; i < 12; i++) s = applyTurn(s, { nextQuestion: "Qual seu hobby?", done: false }, "ok", C);
  assert.equal(s.done, true);
  const depois = applyTurn(s, { nextQuestion: "Mais uma?", done: false }, "ok", C);
  assert.deepEqual(depois, s);
});

// O TESTE MAIS IMPORTANTE DO PROJETO (testing-pattern.md).
test("VC-01/VC-04/VC-07: IA MENTINDO em todo turno NÃO fecha a entrevista: só acaba no máximo, incompleta", () => {
  const mentira = { nextQuestion: "Qual é o seu hobby favorito?", isFollowUp: true, done: true };
  let s = startInterview(VAGA);
  for (let i = 0; i < 20; i++) s = applyTurn(s, mentira, "Trabalhei com Postgres e índices", C);

  assert.equal(s.verifiedFollowUps, 0); // nenhum "follow-up" dela era verdade
  assert.equal(s.endReason, "max"); // nunca passou pelo portão
  assert.equal(s.incomplete, true);
  assert.equal(s.questionCount, C.maxQuestions);
});
