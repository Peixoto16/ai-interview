import { test } from "node:test";
import assert from "node:assert/strict";
import { validateConfig, DEFAULT_CONFIG } from "../src/harness/config.ts";

// VC-06: o sistema NÃO DEVE aceitar config inválida.

test("VC-06: a config padrão da spec é válida", () => {
  assert.doesNotThrow(() => validateConfig(DEFAULT_CONFIG));
});

test("VC-06: rejeita máximo menor que o mínimo", () => {
  assert.throws(
    () => validateConfig({ ...DEFAULT_CONFIG, maxQuestions: 5 }),
    /maxQuestions/,
  );
});

test("VC-06: rejeita minFollowUps maior que minQuestions - 1", () => {
  // a 1a pergunta nunca é follow-up, então com 2 perguntas só cabe 1 follow-up
  assert.throws(
    () => validateConfig({ ...DEFAULT_CONFIG, minQuestions: 2, minFollowUps: 2 }),
    /minFollowUps/,
  );
});

test("VC-06: rejeita números que não são números de verdade (entrada hostil)", () => {
  const ruins: [string, object][] = [
    ["max NaN", { maxQuestions: NaN }],
    ["max Infinity", { maxQuestions: Infinity }],
    ["min quebrado", { minQuestions: 6.5 }],
    ["min em texto", { minQuestions: "6" }],
    ["peso NaN", { weights: { ...DEFAULT_CONFIG.weights, role_fit: NaN } }],
    // soma 1, mas tem peso negativo: 0.7 + 0.25 + 0.2 - 0.15 = 1
    ["peso negativo", { weights: { technical_depth: 0.7, problem_solving: 0.25, communication: 0.2, role_fit: -0.15 } }],
  ];
  for (const [nome, troca] of ruins) {
    assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, ...troca } as never), undefined, nome);
  }
});

test("VC-06: rejeita pesos que não somam 1", () => {
  assert.throws(
    () =>
      validateConfig({
        ...DEFAULT_CONFIG,
        weights: { ...DEFAULT_CONFIG.weights, role_fit: 0.5 },
      }),
    /pesos/,
  );
});
