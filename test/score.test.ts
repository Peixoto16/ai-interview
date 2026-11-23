import { test } from "node:test";
import assert from "node:assert/strict";
import { finalScore } from "../src/harness/score.ts";
import { DEFAULT_CONFIG as C } from "../src/harness/config.ts";

// Atalho: monta as 4 notas na ordem técnica, problemas, comunicação, vaga.
const notas = (t: unknown, p: unknown, c: unknown, v: unknown) => [
  { dimension: "technical_depth", score: t },
  { dimension: "problem_solving", score: p },
  { dimension: "communication", score: c },
  { dimension: "role_fit", score: v },
];

test("VC-09: o exemplo da Ana (4, 3, 5, 2) dá 66,25", () => {
  assert.equal(finalScore(notas(4, 3, 5, 2), C), 66.25);
});

test("VC-09: tudo 5 dá 100; tudo 1 dá 0", () => {
  assert.equal(finalScore(notas(5, 5, 5, 5), C), 100);
  assert.equal(finalScore(notas(1, 1, 1, 1), C), 0);
});

test("VC-09: a ordem em que as notas chegam não muda o resultado", () => {
  const embaralhado = [...notas(4, 3, 5, 2)].reverse();
  assert.equal(finalScore(embaralhado, C), 66.25);
});

test("VC-09: mesma entrada, mesma nota (sempre)", () => {
  const primeira = finalScore(notas(4, 3, 5, 2), C);
  for (let i = 0; i < 100; i++) assert.equal(finalScore(notas(4, 3, 5, 2), C), primeira);
});

test("VC-09: os pesos vêm da config, não da IA", () => {
  const pesosIguais = {
    ...C,
    weights: { technical_depth: 0.25, problem_solving: 0.25, communication: 0.25, role_fit: 0.25 },
  };
  // média simples de 4,3,5,2 = 3,5 → (3,5 − 1) ÷ 4 × 100 = 62,5
  assert.equal(finalScore(notas(4, 3, 5, 2), pesosIguais), 62.5);
});

test("VC-09: uma 'nota final' que a IA tente mandar é ignorada", () => {
  const comMalandragem = notas(4, 3, 5, 2).map((n) => ({ ...n, finalScore: 100 }));
  assert.equal(finalScore(comMalandragem, C), 66.25);
});

test("VC-09: recusa notas fora das regras (não inventa número)", () => {
  const erradas: [string, unknown][] = [
    ["nota 7", notas(7, 3, 5, 2)],
    ["nota 0", notas(0, 3, 5, 2)],
    ["nota quebrada 3,5", notas(3.5, 3, 5, 2)],
    ["nota em texto", notas("4", 3, 5, 2)],
    ["nota NaN", notas(NaN, 3, 5, 2)],
    ["área faltando", notas(4, 3, 5, 2).slice(0, 3)],
    ["área repetida", [...notas(4, 3, 5, 2).slice(0, 3), { dimension: "technical_depth", score: 2 }]],
    ["área inventada", [...notas(4, 3, 5, 2).slice(0, 3), { dimension: "carisma", score: 5 }]],
    ["lista vazia", []],
    ["não é lista", { technical_depth: 4 }],
  ];
  for (const [nome, entrada] of erradas) {
    assert.throws(() => finalScore(entrada, C), undefined, `deveria recusar: ${nome}`);
  }
});
