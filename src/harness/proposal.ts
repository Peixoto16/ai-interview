import type { Proposal } from "./types.ts";

export type ParseResult = { ok: true; proposal: Proposal } | { ok: false; reason: string };

// A ALFÂNDEGA: tudo que vem da IA chega como `unknown` ("não sei o que é")
// e só passa se tiver exatamente a forma certa. Senão, volta com o motivo.
export function parseProposal(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: "proposta não é um objeto" };
  }
  // Object.hasOwn: só aceita campos do PRÓPRIO objeto, não herdados (truque de __proto__).
  if (!Object.hasOwn(raw, "nextQuestion") || !Object.hasOwn(raw, "done")) {
    return { ok: false, reason: "faltam os campos nextQuestion e/ou done" };
  }
  const { nextQuestion, done } = raw as Record<string, unknown>;
  if (typeof nextQuestion !== "string" || nextQuestion.trim() === "") {
    return { ok: false, reason: "nextQuestion não é um texto com conteúdo" };
  }
  if (typeof done !== "boolean") {
    return { ok: false, reason: "done não é verdadeiro/falso" };
  }
  // Monta um objeto NOVO só com os 2 campos. Qualquer extra (isFollowUp, score...) fica para trás.
  return { ok: true, proposal: { nextQuestion: nextQuestion.trim(), done } };
}
