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

// O que o judge recebe: a entrevista SEM a nota humana. Se o gabarito chegasse ao judge
// (ex.: no prompt), ele poderia copiar a resposta e passar na régua sem ser medido de verdade.
export type JudgeInput = Pick<GoldenItem, "id" | "vaga" | "transcricao">;

// Os limites do livro: abaixo disso, a IA avaliadora não é usada.
export const KAPPA_MIN = 0.6;
export const MAX_ABS_BIAS = 0.5;
// Com menos entrevistas que isso, a medida é sorte demais para confiar (VC-13).
export const GOLDEN_MIN = 12;

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

// Confere uma nota que veio de fora (judge ou arquivo): exatamente as 4 áreas, cada uma inteira
// de 1 a 5, nada a mais. Entra como `unknown`, porque na Fase 5 ela vem de uma IA.
export function parseScores(raw: unknown, onde: string): Scores {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${onde}: a nota não é um objeto (${JSON.stringify(raw)})`);
  }
  for (const chave of Object.keys(raw)) {
    if (!(DIMENSIONS as readonly string[]).includes(chave)) throw new Error(`${onde}.${chave}: área desconhecida`);
  }
  const notas = {} as Scores;
  for (const d of DIMENSIONS) {
    const n: unknown = Object.hasOwn(raw, d) ? (raw as Record<string, unknown>)[d] : undefined;
    if (typeof n !== "number" || !Number.isInteger(n) || n < NOTA_MIN || n > NOTA_MAX) {
      throw new Error(`${onde}.${d}: nota inválida (${JSON.stringify(n)}), esperado inteiro de ${NOTA_MIN} a ${NOTA_MAX}`);
    }
    notas[d] = n;
  }
  return notas;
}

// "Impressão digital" de uma entrevista: vaga + perguntas + respostas, ignorando espaços e maiúsculas.
// Duas entrevistas com o mesmo conteúdo são a MESMA entrevista, mesmo com ids diferentes.
const normalizar = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
const impressaoDigital = (item: GoldenItem) =>
  JSON.stringify([normalizar(item.vaga), item.transcricao.map((t) => [normalizar(t.pergunta), normalizar(t.resposta)])]);

// Confere o gabarito antes de medir: não vazio, cada entrevista bem formada, sem id repetido
// e sem a mesma entrevista com outro nome. Sem isso, 12 cópias passariam no mínimo de 12 (VC-13).
function conferirGabarito(itens: GoldenItem[]): void {
  if (!Array.isArray(itens) || itens.length === 0) throw new Error("o golden set está vazio");
  const vistos = new Set<string>();
  const conteudos = new Map<string, string>(); // impressão digital → id de quem apareceu primeiro
  itens.forEach((item, i) => {
    const id: unknown = (item as { id?: unknown })?.id;
    if (typeof id !== "string" || id.trim() === "") throw new Error(`item ${i + 1} do golden set: id inválido`);
    if (vistos.has(id)) throw new Error(`${id}: id repetido no golden set (cada entrevista conta uma vez só)`);
    vistos.add(id);
    if (typeof item.vaga !== "string" || item.vaga.trim() === "") throw new Error(`${id}: vaga inválida`);
    const t: unknown = item.transcricao;
    const ok =
      Array.isArray(t) &&
      t.length > 0 &&
      t.every(
        (x) =>
          typeof x === "object" && x !== null && typeof x.pergunta === "string" && typeof x.resposta === "string",
      );
    if (!ok) throw new Error(`${id}: transcrição inválida (precisa de pelo menos 1 {pergunta, resposta} em texto)`);
    const digital = impressaoDigital(item);
    const original = conteudos.get(digital);
    if (original !== undefined) throw new Error(`${id}: é a mesma entrevista que ${original} (só mudou o id)`);
    conteudos.set(digital, id);
  });
}

// Roda um avaliador (judge) em todas as entrevistas do gabarito e mede a concordância
// no geral (todas as notas juntas) e em cada área separada.
// O judge recebe só a entrevista (sem a nota humana) e devolve `unknown`, que é validado aqui.
export function agreementReport(itens: GoldenItem[], judge: (entrada: JudgeInput) => unknown): AgreementReport {
  conferirGabarito(itens);
  const modelo: number[] = [];
  const humano: number[] = [];
  const porArea = Object.fromEntries(DIMENSIONS.map((d) => [d, { m: [] as number[], h: [] as number[] }])) as Record<
    Dimension,
    { m: number[]; h: number[] }
  >;

  for (const item of itens) {
    const gabarito = parseScores(item.humano, `${item.id} (humano)`);
    // Uma cópia nova, só com o que o judge pode ver (nunca o objeto do gabarito).
    const entrada: JudgeInput = {
      id: item.id,
      vaga: item.vaga,
      transcricao: item.transcricao.map((t) => ({ pergunta: t.pergunta, resposta: t.resposta })),
    };
    const notas = parseScores(judge(entrada), item.id);
    for (const d of DIMENSIONS) {
      modelo.push(notas[d]);
      humano.push(gabarito[d]);
      porArea[d].m.push(notas[d]);
      porArea[d].h.push(gabarito[d]);
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
// do mínimo, E o viés for pequeno no geral E em cada área. Um número geral bom pode esconder
// uma área ruim (ex.: +1 em técnica e −1 em comunicação dá viés geral ≈ 0).
// Os limites são FIXOS (os da spec): não há parâmetro para afrouxá-los.
export function releaseGate(r: AgreementReport): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const fmt = (x: number) => (Number.isNaN(x) ? "indefinido" : x.toFixed(3));

  // Escrito como !(x >= min) DE PROPÓSITO: assim um valor NaN (kappa indefinido) também reprova.
  if (!(r.n >= GOLDEN_MIN)) reasons.push(`golden set com ${r.n} entrevistas (mínimo ${GOLDEN_MIN})`);

  if (!(r.kappa >= KAPPA_MIN)) reasons.push(`kappa geral ${fmt(r.kappa)} < ${KAPPA_MIN}`);
  for (const d of DIMENSIONS) {
    const k = r.perDimension[d].kappa;
    if (!(k >= KAPPA_MIN)) reasons.push(`kappa de ${d} ${fmt(k)} < ${KAPPA_MIN}`);
  }
  if (!(Math.abs(r.meanBias) <= MAX_ABS_BIAS)) reasons.push(`viés médio ${fmt(r.meanBias)} fora de ±${MAX_ABS_BIAS}`);
  for (const d of DIMENSIONS) {
    const b = r.perDimension[d].meanBias;
    if (!(Math.abs(b) <= MAX_ABS_BIAS)) reasons.push(`viés de ${d} ${fmt(b)} fora de ±${MAX_ABS_BIAS}`);
  }

  return { ok: reasons.length === 0, reasons };
}
