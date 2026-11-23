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
