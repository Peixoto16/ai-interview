import { DIMENSIONS } from "./types.ts";
import type { Dimension, InterviewConfig } from "./types.ts";

// CONFERÊNCIA: as notas da IA seguem as regras? Se não, para tudo (não inventa número).
// Recebe `unknown` porque, na prática, isso vem de uma IA e pode ser qualquer coisa.
function readScores(raw: unknown): Map<Dimension, number> {
  if (!Array.isArray(raw)) throw new Error("as notas precisam vir numa lista");

  const valid = new Set<string>(DIMENSIONS);
  const notas = new Map<Dimension, number>();

  for (const item of raw) {
    if (typeof item !== "object" || item === null) throw new Error("item de nota inválido");
    const { dimension, score } = item as Record<string, unknown>;

    if (typeof dimension !== "string" || !valid.has(dimension)) {
      throw new Error(`área desconhecida: ${String(dimension)}`);
    }
    if (notas.has(dimension as Dimension)) throw new Error(`área repetida: ${dimension}`);
    if (!Number.isInteger(score) || (score as number) < 1 || (score as number) > 5) {
      throw new Error(`nota de ${dimension} precisa ser inteiro de 1 a 5 (veio ${String(score)})`);
    }
    notas.set(dimension as Dimension, score as number);
  }

  if (notas.size !== DIMENSIONS.length) throw new Error("falta nota de alguma área");
  return notas;
}

// VC-09: A CALCULADORA. Nota final de 0 a 100, sempre a mesma para as mesmas notas.
// Repare: não existe parâmetro "nota final da IA". Não há por onde ela entrar.
export function finalScore(raw: unknown, c: InterviewConfig): number {
  const notas = readScores(raw);

  // Média ponderada na escala 1 a 5. Soma sempre na mesma ordem (DIMENSIONS),
  // para o computador não dar resultados diferentes nas casas decimais.
  let media = 0;
  for (const d of DIMENSIONS) media += (notas.get(d) as number) * c.weights[d];

  // Converte 1..5 para 0..100 e arredonda em 2 casas.
  return Math.round(((media - 1) / 4) * 100 * 100) / 100;
}
