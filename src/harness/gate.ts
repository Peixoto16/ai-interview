import type { EndDecision, InterviewConfig, Progress } from "./types.ts";

// O PORTÃO: os mínimos foram atingidos? (os dois cadeados)
// Conta só follow-ups VERIFICADOS pelo código, nunca o que a IA disse.
export function gateMet(p: Progress, c: InterviewConfig): boolean {
  return p.questionCount >= c.minQuestions && p.verifiedFollowUps >= c.minFollowUps;
}

// O JUIZ: a entrevista acaba agora?
// aiDone é só a OPINIÃO da IA ("acho que podemos acabar"). O código decide.
export function decideEnd(p: Progress, aiDone: boolean, c: InterviewConfig): EndDecision {
  const mins = gateMet(p, c);

  // Portão: a IA quer acabar E os mínimos foram atingidos.
  // Vem primeiro: se as duas coisas valem na pergunta 12, a entrevista terminou COMPLETA ("gate").
  if (aiDone && mins) {
    return { done: true, endReason: "gate", incomplete: false };
  }
  // Teto de segurança: bateu o máximo, acaba de qualquer jeito.
  if (p.questionCount >= c.maxQuestions) {
    return { done: true, endReason: "max", incomplete: !mins };
  }
  // Qualquer outro caso: continua.
  return { done: false, endReason: null, incomplete: false };
}
