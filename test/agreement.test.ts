import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  exactAgreement,
  within1Agreement,
  meanBias,
  quadraticWeightedKappa,
  agreementReport,
  releaseGate,
  KAPPA_MIN,
  MAX_ABS_BIAS,
} from "../src/evals/agreement.ts";
import type { GoldenItem, Scores } from "../src/evals/agreement.ts";
import { DIMENSIONS } from "../src/harness/types.ts";
import { detectInjection } from "../src/harness/injection.ts";

// VC-13: a IA avaliadora (judge) só pode ser usada se concordar com as notas humanas do golden set:
// kappa >= 0,6 (geral e em cada área) E viés médio de no máximo 0,5 ponto.

const golden = JSON.parse(readFileSync(new URL("../evals/golden-set.json", import.meta.url), "utf8")) as {
  itens: GoldenItem[];
};
const itens = golden.itens;

// ---- o gabarito está bem formado --------------------------------------------

test("VC-13: o golden set tem pelo menos 12 entrevistas com nota humana de 1 a 5 em cada área", () => {
  assert.ok(itens.length >= 12);
  for (const it of itens) {
    assert.ok(it.humano, `${it.id} sem nota`);
    assert.deepEqual(Object.keys(it.humano).sort(), [...DIMENSIONS].sort(), `${it.id}: áreas erradas`);
    for (const d of DIMENSIONS) {
      const n = it.humano[d];
      assert.ok(Number.isInteger(n) && n >= 1 && n <= 5, `${it.id}.${d} = ${n}`);
    }
    assert.ok(it.transcricao.length >= 1, `${it.id} sem transcrição`);
  }
});

test("VC-08/VC-13: o golden set tem um caso de manipulação, e o detector da Fase 3 o pega", () => {
  const comBandeira = itens.filter((it) => it.transcricao.some((t) => detectInjection(t.resposta).length > 0));
  assert.ok(comBandeira.length >= 1);
});

// ---- a conta, conferida à mão -------------------------------------------------

test("VC-13: acerto exato e acerto com diferença de até 1 ponto", () => {
  assert.equal(exactAgreement([1, 2, 3, 4], [1, 2, 4, 1]), 0.5);
  assert.equal(within1Agreement([1, 2, 3, 4], [1, 2, 4, 1]), 0.75);
});

test("VC-13: viés médio = em média, quanto a IA dá a mais (+) ou a menos (-) que o humano", () => {
  assert.equal(meanBias([2, 3, 4], [1, 2, 3]), 1);
  assert.equal(meanBias([1, 2, 3], [2, 3, 4]), -1);
  assert.equal(meanBias([1, 5], [2, 4]), 0);
});

test("VC-13: kappa quadrático em casos calculados à mão", () => {
  // concordância perfeita
  assert.equal(quadraticWeightedKappa([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]), 1);
  // discordância total (as notas trocadas)
  assert.equal(quadraticWeightedKappa([1, 2], [2, 1]), -1);
  // quem dá sempre a mesma nota não concorda "de verdade": kappa 0
  assert.equal(quadraticWeightedKappa([4, 4, 4, 4], [1, 2, 4, 5]), 0);
});

test("VC-13: errar por muito pesa mais que errar por pouco (é o 'quadrático')", () => {
  const humano = [1, 2, 3, 4, 5, 3];
  const errouPorPouco = [2, 2, 3, 4, 5, 3]; // 1 → 2
  const errouPorMuito = [5, 2, 3, 4, 5, 3]; // 1 → 5
  assert.ok(quadraticWeightedKappa(errouPorPouco, humano) > quadraticWeightedKappa(errouPorMuito, humano));
});

// ---- 4 avaliadores falsos (no lugar da IA, que só chega na Fase 5) -----------

const limitar = (n: number) => Math.max(1, Math.min(5, n));
const porArea = (it: GoldenItem, f: (humano: number, area: number) => number): Scores =>
  Object.fromEntries(DIMENSIONS.map((d, j) => [d, f(it.humano[d], j)])) as Scores;

// CALIBRADO: concorda com o humano, mas erra por 1 ponto em ~1 de cada 5 notas.
const calibrado = (it: GoldenItem) => {
  const i = itens.indexOf(it);
  return porArea(it, (h, j) => ((i * 4 + j) % 5 === 0 ? limitar(h + ((i + j) % 2 ? 1 : -1)) : h));
};
// BONZINHO: infla as notas, e infla mais quem foi mal.
const bonzinho = (it: GoldenItem) => porArea(it, (h) => limitar(h + (h <= 3 ? 2 : 1)));
// MAIS UM: +1 em tudo. Mantém a ordem dos candidatos, então o kappa engana.
const maisUm = (it: GoldenItem) => porArea(it, (h) => limitar(h + 1));
// PREGUIÇOSO: dá 4 para todo mundo.
const preguicoso = (it: GoldenItem) => porArea(it, () => 4);

test("VC-13: o avaliador CALIBRADO passa no portão", () => {
  const r = releaseGate(agreementReport(itens, calibrado));
  assert.equal(r.ok, true, r.reasons.join("; "));
});

test("VC-13: o avaliador BONZINHO reprova", () => {
  const r = releaseGate(agreementReport(itens, bonzinho));
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((m) => m.includes("viés")));
});

test("VC-13: o '+1 em tudo' passa no kappa, mas reprova no viés (por isso o viés é medido à parte)", () => {
  const rel = agreementReport(itens, maisUm);
  assert.ok(rel.kappa >= KAPPA_MIN, `kappa ${rel.kappa}`);
  const r = releaseGate(rel);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((m) => m.includes("viés")));
  assert.ok(!r.reasons.some((m) => m.startsWith("kappa geral")), "o kappa geral passou; quem reprova é o viés");
});

test("VC-13: o PREGUIÇOSO (sempre 4) reprova com kappa 0, mesmo acertando algumas notas", () => {
  const rel = agreementReport(itens, preguicoso);
  assert.ok(rel.exact > 0, "ele acerta algumas por sorte");
  assert.equal(rel.kappa, 0);
  assert.equal(releaseGate(rel).ok, false);
});

test("VC-13: o portão olha CADA área, não só o geral", () => {
  // bom em tudo, mas chuta 3 na adequação à vaga
  const ruimNaVaga = (it: GoldenItem) => ({ ...it.humano, role_fit: 3 });
  const r = releaseGate(agreementReport(itens, ruimNaVaga));
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((m) => m.includes("role_fit")));
});

test("VC-13: viés que se CANCELA entre as áreas reprova (+1 em umas, −1 em outras)", () => {
  // viés geral ≈ 0, mas a IA erra para cima em técnica/problemas e para baixo em comunicação/vaga
  const cancelado = (it: GoldenItem) =>
    porArea(it, (h, j) => limitar(j < 2 ? h + 1 : h - 1));
  const rel = agreementReport(itens, cancelado);
  assert.ok(Math.abs(rel.meanBias) <= MAX_ABS_BIAS, `o viés geral sozinho passaria: ${rel.meanBias}`);
  const r = releaseGate(rel);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((m) => m.startsWith("viés de ")), r.reasons.join("; "));
});

test("VC-13: a IA 'efeito halo' (mesma nota nas 4 áreas, sem avaliar cada uma) reprova", () => {
  // Dá a todas as áreas a média arredondada do candidato. Só reprova se o gabarito tiver
  // candidatos bons numa área e fracos em outra (por isso existem os itens g13 a g16).
  const halo = (it: GoldenItem) => {
    const media = Math.round(DIMENSIONS.reduce((s, d) => s + it.humano[d], 0) / DIMENSIONS.length);
    return porArea(it, () => media);
  };
  const r = releaseGate(agreementReport(itens, halo));
  assert.equal(r.ok, false, "a régua deveria pegar quem não avalia cada área");
});

test("VC-13: o gabarito tem candidatos com áreas bem diferentes (diferença de 3+ pontos)", () => {
  const contrastantes = itens.filter((it) => {
    const notas = DIMENSIONS.map((d) => it.humano[d]);
    return Math.max(...notas) - Math.min(...notas) >= 3;
  });
  assert.ok(contrastantes.length >= 4, `só ${contrastantes.length} itens com áreas contrastantes`);
});

test("VC-13: os limites são os do livro", () => {
  assert.equal(KAPPA_MIN, 0.6);
  assert.equal(MAX_ABS_BIAS, 0.5);
});
