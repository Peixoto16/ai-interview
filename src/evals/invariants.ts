// EVALS EM CÓDIGO (Cap. 7): a base da pirâmide.
//
// "Invariante" = regra que TEM de valer em QUALQUER entrevista, não importa o que a IA ou o
// candidato fizeram. Se uma delas quebrar, o harness tem um bug.
// Checagem barata, rápida e exata: roda em milhares de entrevistas simuladas sem custo de IA.

import type { InterviewConfig, InterviewState, OpenQuestion } from "../harness/types.ts";
import { gateMet } from "../harness/gate.ts";

// Todas as perguntas feitas: as já respondidas + a que está no ar (se houver).
function perguntas(s: InterviewState): OpenQuestion[] {
  return s.current ? [...s.turns, s.current] : [...s.turns];
}

// Devolve a lista de regras quebradas (vazia = tudo certo).
export function structureProblems(s: InterviewState, c: InterviewConfig): string[] {
  const problemas: string[] = [];
  const todas = perguntas(s);
  const minimos = gateMet(s, c);

  // contagem de perguntas
  if (s.questionCount < 1 || s.questionCount > c.maxQuestions) {
    problemas.push(`questionCount ${s.questionCount} fora de 1..${c.maxQuestions}`);
  }
  if (todas.length !== s.questionCount) {
    problemas.push(`questionCount ${s.questionCount} diferente das perguntas registradas (${todas.length})`);
  }

  // follow-ups
  if (s.verifiedFollowUps < 0 || s.verifiedFollowUps > s.questionCount - 1) {
    problemas.push(`verifiedFollowUps ${s.verifiedFollowUps} fora de 0..${s.questionCount - 1} (a 1ª nunca é follow-up)`);
  }
  const marcadas = todas.filter((q) => q.followUpVerified).length;
  if (marcadas !== s.verifiedFollowUps) {
    problemas.push(`verifiedFollowUps ${s.verifiedFollowUps} diferente das perguntas marcadas (${marcadas})`);
  }
  if (todas.length > 0 && todas[0].followUpVerified) problemas.push("a 1ª pergunta está marcada como follow-up");
  if (todas.some((q) => q.source === "fallback" && q.followUpVerified)) {
    problemas.push("pergunta reserva marcada como follow-up");
  }

  // fim da entrevista
  if (s.done !== (s.current === null)) problemas.push("done e pergunta no ar não combinam");
  if (s.done !== (s.endReason !== null)) problemas.push("done e endReason não combinam");
  if (!s.done && s.incomplete) problemas.push("marcada como incompleta sem ter acabado");
  if (s.endReason === "gate" && !minimos) problemas.push("encerrou pelo portão sem os mínimos");
  if (s.endReason === "gate" && s.incomplete) problemas.push("encerrou pelo portão mas está incompleta");
  if (s.endReason === "max" && s.questionCount !== c.maxQuestions) {
    problemas.push(`motivo "max" com ${s.questionCount} perguntas (teto é ${c.maxQuestions})`);
  }
  if (s.endReason === "max" && s.incomplete !== !minimos) problemas.push("'incompleta' não bate com os mínimos");

  // bandeiras (VC-08)
  let anterior = 0;
  for (const f of s.flags) {
    if (f.turn < 1 || f.turn > s.turns.length) problemas.push(`bandeira no turno ${f.turn}, que não existe`);
    if (f.turn <= anterior) problemas.push("bandeiras fora de ordem ou repetidas");
    if (f.patterns.length === 0) problemas.push(`bandeira no turno ${f.turn} sem padrão`);
    anterior = f.turn;
  }

  // plano B (VC-10): cada pergunta reserva tem um motivo registrado
  const reservas = todas.filter((q) => q.source === "fallback").length;
  if (reservas > s.fallbackLog.length) problemas.push("pergunta reserva sem motivo registrado");

  return problemas;
}

export function structureOk(s: InterviewState, c: InterviewConfig): boolean {
  return structureProblems(s, c).length === 0;
}

// Métrica: que fração das perguntas veio do plano B? Alta = a IA está mandando lixo.
export function fallbackRate(s: InterviewState): number {
  const todas = perguntas(s);
  return todas.length === 0 ? 0 : todas.filter((q) => q.source === "fallback").length / todas.length;
}
