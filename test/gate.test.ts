import { test } from "node:test";
import assert from "node:assert/strict";
import { gateMet, decideEnd } from "../src/harness/gate.ts";
import { DEFAULT_CONFIG as C } from "../src/harness/config.ts";

// Atalho para montar o placar nos testes.
const p = (questionCount: number, verifiedFollowUps: number) => ({ questionCount, verifiedFollowUps });

test("VC-01: gateMet só é verdadeiro com 6 perguntas E 2 follow-ups verificados", () => {
  assert.equal(gateMet(p(6, 2), C), true);
  assert.equal(gateMet(p(5, 2), C), false); // falta pergunta
  assert.equal(gateMet(p(6, 1), C), false); // falta follow-up
});

test("VC-01/VC-03: a IA pede para acabar cedo demais → NÃO encerra", () => {
  assert.deepEqual(decideEnd(p(3, 0), true, C), { done: false, endReason: null, incomplete: false });
  assert.equal(decideEnd(p(6, 1), true, C).done, false); // 6 perguntas mas só 1 follow-up
  assert.equal(decideEnd(p(5, 2), true, C).done, false); // 2 follow-ups mas só 5 perguntas
});

test("VC-02: IA quer acabar E mínimos atingidos → encerra com motivo 'gate'", () => {
  assert.deepEqual(decideEnd(p(6, 2), true, C), { done: true, endReason: "gate", incomplete: false });
});

test("VC-02: mínimos atingidos mas a IA NÃO quer acabar → segue perguntando", () => {
  assert.equal(decideEnd(p(8, 3), false, C).done, false);
});

test("VC-02/VC-04: IA quer acabar na pergunta 12 com mínimos ok → motivo 'gate' (terminou completa)", () => {
  assert.deepEqual(decideEnd(p(12, 2), true, C), { done: true, endReason: "gate", incomplete: false });
});

test("VC-04: bateu o máximo → encerra com 'max'; incompleta se faltaram mínimos", () => {
  assert.deepEqual(decideEnd(p(12, 0), false, C), { done: true, endReason: "max", incomplete: true });
  assert.deepEqual(decideEnd(p(12, 5), false, C), { done: true, endReason: "max", incomplete: false });
});
