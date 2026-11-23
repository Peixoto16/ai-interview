// Os "moldes" dos dados do harness. Só descrevem a forma; não têm lógica.

// As 4 dimensões em que o candidato é avaliado.
export const DIMENSIONS = [
  "technical_depth",
  "problem_solving",
  "communication",
  "role_fit",
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

// O placar da entrevista até agora (só o que o portão precisa ver).
export interface Progress {
  questionCount: number; // perguntas já feitas
  verifiedFollowUps: number; // follow-ups que o CÓDIGO confirmou
}

// Por que a entrevista acabou: "gate" = acabou normal; "max" = bateu o teto.
export type EndReason = "gate" | "max";

export interface EndDecision {
  done: boolean;
  endReason: EndReason | null; // null enquanto não acabou
  incomplete: boolean; // true se acabou por "max" sem ter atingido os mínimos
}

// As regras da entrevista (os números da spec).
export interface InterviewConfig {
  minQuestions: number; // mínimo de perguntas antes de poder encerrar
  minFollowUps: number; // mínimo de follow-ups VERIFICADOS
  maxQuestions: number; // teto: encerra à força
  weights: Record<Dimension, number>; // peso de cada dimensão (somam 1)
}
