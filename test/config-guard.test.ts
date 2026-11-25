import { test } from "node:test";
import assert from "node:assert/strict";
import { finalScore } from "../src/harness/score.ts";
import { decideEnd } from "../src/harness/gate.ts";
import { DEFAULT_CONFIG as C } from "../src/harness/config.ts";

// Warning 4: as funções que USAM a config não podem confiar que alguém validou antes.
// Config quebrada tem que dar ERRO na hora, nunca um número inventado (NaN) ou entrevista sem fim.

const notas = [
  { dimension: "technical_depth", score: 4 },
  { dimension: "problem_solving", score: 3 },
  { dimension: "communication", score: 5 },
  { dimension: "role_fit", score: 2 },
];

test("VC-06/VC-09: config sem um peso → finalScore dá erro, não NaN", () => {
  const { role_fit, ...semRoleFit } = C.weights;
  const quebrada = { ...C, weights: semRoleFit } as never;
  assert.throws(() => finalScore(notas, quebrada));
});

test("VC-06/VC-04: config sem maxQuestions → decideEnd dá erro, não entrevista infinita", () => {
  const { maxQuestions, ...semMax } = C;
  const quebrada = semMax as never;
  assert.throws(() => decideEnd({ questionCount: 30, verifiedFollowUps: 0 }, false, quebrada));
});

test("VC-06: config válida continua funcionando normalmente", () => {
  assert.equal(finalScore(notas, C), 66.25);
  assert.equal(decideEnd({ questionCount: 12, verifiedFollowUps: 0 }, false, C).endReason, "max");
});
