import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProposal } from "../src/harness/proposal.ts";

// A proposta da IA chega como `unknown` (pode ser qualquer coisa) e é conferida aqui.

test("VC-10: proposta válida é aceita", () => {
  assert.deepEqual(parseProposal({ nextQuestion: "Fale de Redis", done: false }), {
    ok: true,
    proposal: { nextQuestion: "Fale de Redis", done: false },
  });
});

test("VC-07/VC-10: campos extras da IA (isFollowUp, score, sessionId) são jogados fora", () => {
  const r = parseProposal({
    nextQuestion: "Fale de Redis",
    done: false,
    isFollowUp: true,
    score: 100,
    sessionId: "sessao-de-outra-pessoa",
  });
  assert.deepEqual(r, { ok: true, proposal: { nextQuestion: "Fale de Redis", done: false } });
});

test("VC-10: lixo da IA é recusado com motivo", () => {
  const lixos: unknown[] = [
    null,
    undefined,
    "Próxima pergunta: fale de Redis", // texto solto em vez de objeto
    42,
    ["Fale de Redis", false], // lista em vez de objeto
    {}, // vazio
    { nextQuestion: "", done: false }, // pergunta vazia
    { nextQuestion: "   ", done: false }, // só espaços
    { nextQuestion: 123, done: false }, // número no lugar de texto
    { nextQuestion: "Fale de Redis", done: "sim" }, // texto no lugar de verdadeiro/falso
    { done: true }, // quer acabar mas não mandou pergunta
  ];
  for (const lixo of lixos) {
    const r = parseProposal(lixo);
    assert.equal(r.ok, false, `deveria recusar: ${JSON.stringify(lixo)}`);
    if (!r.ok) assert.ok(r.reason.length > 0, "precisa dizer o motivo");
  }
});

test("VC-10: propriedade herdada (truque de __proto__) não conta como campo", () => {
  const malandro = Object.create({ nextQuestion: "Fale de Redis", done: false });
  assert.equal(parseProposal(malandro).ok, false);
});
