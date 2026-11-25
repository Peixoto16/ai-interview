// VC-13: A RÉGUA DE CONCORDÂNCIA (Cap. 7: "medir antes de confiar").
//
// Antes de usar uma IA para dar notas (o "judge"), comparamos as notas dela com as de um HUMANO
// num gabarito (o golden set). Só confiamos nela se concordar o bastante. Três medidas:
//
// 1. ACERTO (exato e com diferença de até 1 ponto): fácil de entender, mas engana. Quem dá
//    sempre 4 acerta algumas notas por sorte.
// 2. KAPPA QUADRÁTICO: de -1 a 1. Mede o quanto concordam DESCONTANDO o acerto por sorte.
//    1 = concordam sempre; 0 = igual a chutar; negativo = pior que chutar.
//    "Quadrático": errar por 4 pontos pesa 16 vezes mais que errar por 1.
// 3. VIÉS MÉDIO: em média, quanto a IA dá a mais (+) ou a menos (-). O kappa NÃO pega
//    um viés uniforme (dar +1 em tudo mantém a ordem dos candidatos), por isso é medido à parte.

import { DIMENSIONS } from "../harness/types.ts";
import type { Dimension } from "../harness/types.ts";

export type Scores = Record<Dimension, number>;

// Uma entrevista do gabarito, com as notas do humano.
export interface GoldenItem {
  id: string;
  vaga: string;
  transcricao: { pergunta: string; resposta: string }[];
  humano: Scores;
}

// Os limites do livro: abaixo disso, a IA avaliadora não é usada.
export const KAPPA_MIN = 0.6;
export const MAX_ABS_BIAS = 0.5;

const NOTA_MIN = 1;
const NOTA_MAX = 5;

function conferirPares(a: number[], b: number[]): void {
  if (a.length !== b.length || a.length === 0) throw new Error("listas de notas vazias ou de tamanhos diferentes");
}

// Fração de notas iguais.
export function exactAgreement(a: number[], b: number[]): number {
  conferirPares(a, b);
  return a.filter((x, i) => x === b[i]).length / a.length;
}

// Fração de notas com diferença de até 1 ponto.
export function within1Agreement(a: number[], b: number[]): number {
  conferirPares(a, b);
  return a.filter((x, i) => Math.abs(x - b[i]) <= 1).length / a.length;
}

// Média de (IA − humano). Positivo = a IA é mais generosa.
export function meanBias(modelo: number[], humano: number[]): number {
  conferirPares(modelo, humano);
  let soma = 0;
  for (let i = 0; i < modelo.length; i++) soma += modelo[i] - humano[i];
  return soma / modelo.length;
}

// Kappa de Cohen com peso quadrático, para notas de 1 a 5.
// Ideia: compara a discordância OBSERVADA com a discordância que haveria SE os dois chutassem
// mantendo as mesmas proporções de notas. kappa = 1 − observada / esperada.
export function quadraticWeightedKappa(a: number[], b: number[]): number {
  conferirPares(a, b);
  const k = NOTA_MAX - NOTA_MIN + 1;
  const n = a.length;
  const peso = (i: number, j: number) => ((i - j) * (i - j)) / ((k - 1) * (k - 1));

  const quantasA = new Array<number>(k).fill(0);
  const quantasB = new Array<number>(k).fill(0);
  let observada = 0;
  for (let x = 0; x < n; x++) {
    const i = a[x] - NOTA_MIN;
    const j = b[x] - NOTA_MIN;
    if (!(i >= 0 && i < k && j >= 0 && j < k) || !Number.isInteger(a[x]) || !Number.isInteger(b[x])) {
      throw new Error(`nota fora de ${NOTA_MIN}..${NOTA_MAX}: ${a[x]} / ${b[x]}`);
    }
    quantasA[i]++;
    quantasB[j]++;
    observada += peso(i, j);
  }

  let esperada = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) esperada += (peso(i, j) * quantasA[i] * quantasB[j]) / n;
  }

  // Os dois deram sempre a mesma nota: não há como medir concordância.
  if (esperada === 0) return Number.NaN;
  return 1 - observada / esperada;
}

export interface Medidas {
  exact: number;
  within1: number;
  kappa: number;
  meanBias: number;
}

export interface AgreementReport extends Medidas {
  n: number; // quantas entrevistas
  perDimension: Record<Dimension, Medidas>;
}

function medir(modelo: number[], humano: number[]): Medidas {
  return {
    exact: exactAgreement(modelo, humano),
    within1: within1Agreement(modelo, humano),
    kappa: quadraticWeightedKappa(modelo, humano),
    meanBias: meanBias(modelo, humano),
  };
}

// Roda um avaliador (judge) em todas as entrevistas do gabarito e mede a concordância
// no geral (todas as notas juntas) e em cada área separada.
export function agreementReport(itens: GoldenItem[], judge: (item: GoldenItem) => Scores): AgreementReport {
  const modelo: number[] = [];
  const humano: number[] = [];
  const porArea = Object.fromEntries(DIMENSIONS.map((d) => [d, { m: [] as number[], h: [] as number[] }])) as Record<
    Dimension,
    { m: number[]; h: number[] }
  >;

  for (const item of itens) {
    const notas = judge(item);
    for (const d of DIMENSIONS) {
      modelo.push(notas[d]);
      humano.push(item.humano[d]);
      porArea[d].m.push(notas[d]);
      porArea[d].h.push(item.humano[d]);
    }
  }

  return {
    n: itens.length,
    ...medir(modelo, humano),
    perDimension: Object.fromEntries(DIMENSIONS.map((d) => [d, medir(porArea[d].m, porArea[d].h)])) as Record<
      Dimension,
      Medidas
    >,
  };
}

// O PORTÃO DE LIBERAÇÃO: só confia na IA avaliadora se o kappa geral E o de cada área passarem
// do mínimo, E o viés médio for pequeno. Um kappa geral alto pode esconder uma área ruim.
export function releaseGate(
  r: AgreementReport,
  kappaMin = KAPPA_MIN,
  maxAbsBias = MAX_ABS_BIAS,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const fmt = (x: number) => (Number.isNaN(x) ? "indefinido" : x.toFixed(3));

  if (!(r.kappa >= kappaMin)) reasons.push(`kappa geral ${fmt(r.kappa)} < ${kappaMin}`);
  for (const d of DIMENSIONS) {
    const k = r.perDimension[d].kappa;
    if (!(k >= kappaMin)) reasons.push(`kappa de ${d} ${fmt(k)} < ${kappaMin}`);
  }
  if (!(Math.abs(r.meanBias) <= maxAbsBias)) reasons.push(`viés médio ${fmt(r.meanBias)} fora de ±${maxAbsBias}`);

  return { ok: reasons.length === 0, reasons };
}
