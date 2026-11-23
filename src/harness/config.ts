import { DIMENSIONS } from "./types.ts";
import type { InterviewConfig } from "./types.ts";

// Os números da spec ("Prior decisions").
export const DEFAULT_CONFIG: InterviewConfig = {
  minQuestions: 6,
  minFollowUps: 2,
  maxQuestions: 12,
  weights: {
    technical_depth: 0.4,
    problem_solving: 0.25,
    communication: 0.2,
    role_fit: 0.15,
  },
};

// VC-06: recusa config que não faz sentido. Se algo estiver errado, joga um erro.
export function validateConfig(c: InterviewConfig): void {
  if (!(c.minQuestions >= 1 && c.minFollowUps >= 0)) {
    throw new Error("mínimos inválidos");
  }
  if (c.maxQuestions < c.minQuestions) {
    throw new Error("maxQuestions < minQuestions");
  }
  if (c.minFollowUps > c.minQuestions - 1) {
    throw new Error("minFollowUps impossível: a 1a pergunta nunca é follow-up");
  }
  const soma = DIMENSIONS.reduce((total, d) => total + c.weights[d], 0);
  if (Math.abs(soma - 1) > 1e-9) {
    throw new Error(`pesos devem somar 1 (somam ${soma})`);
  }
}
