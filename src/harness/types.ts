// Os "moldes" dos dados do harness. Só descrevem a forma; não têm lógica.

// As 4 dimensões em que o candidato é avaliado.
export const DIMENSIONS = [
  "technical_depth",
  "problem_solving",
  "communication",
  "role_fit",
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

// A nota que a IA (avaliadora) dá para UMA área: inteiro de 1 a 5.
export interface DimensionScore {
  dimension: Dimension;
  score: number;
}

// O placar da entrevista até agora (só o que o portão precisa ver).
export interface Progress {
  questionCount: number; // perguntas já feitas
  verifiedFollowUps: number; // follow-ups que o CÓDIGO confirmou
}

// Por que a entrevista acabou: "gate" = acabou normal; "max" = bateu o teto.
export type EndReason = "gate" | "max";

export interface EndDecision {
  done: boolean;
  endReason: EndReason | null; // null enquanto não acabou
  incomplete: boolean; // true se acabou por "max" sem ter atingido os mínimos
}

// As regras da entrevista (os números da spec).
export interface InterviewConfig {
  minQuestions: number; // mínimo de perguntas antes de poder encerrar
  minFollowUps: number; // mínimo de follow-ups VERIFICADOS
  maxQuestions: number; // teto: encerra à força
  weights: Record<Dimension, number>; // peso de cada dimensão (somam 1)
}

// O que a IA manda a cada turno, DEPOIS de o código conferir (ver proposal.ts).
// Repare: não existe `isFollowUp` aqui. Mesmo que a IA mande, o código joga fora.
export interface Proposal {
  nextQuestion: string; // a próxima pergunta que a IA sugere
  done: boolean; // a OPINIÃO da IA: "acho que podemos acabar"
}

// Uma pergunta feita, com a resposta da pessoa.
export interface Turn {
  question: string;
  answer: string;
  followUpVerified: boolean; // decidido pelo CÓDIGO, não pela IA
  source: "ai" | "fallback"; // veio da IA ou do plano B?
}

// A pergunta que está "no ar", esperando a pessoa responder.
export interface OpenQuestion {
  question: string;
  followUpVerified: boolean;
  source: "ai" | "fallback";
}

// VC-08: o ALARME. Marca em qual turno a resposta do candidato parecia tentar mandar na IA,
// e quais padrões foram achados. Só o código cria bandeiras; nada que a IA mande apaga uma.
export interface InjectionFlag {
  turn: number; // número do turno (1 = resposta à 1a pergunta)
  patterns: string[]; // ex.: ["ignorar-instrucoes", "pedido-de-nota"]
}

// O PLACAR COMPLETO da entrevista. Cada turno gera um placar novo.
export interface InterviewState {
  fallbackQuestion: string; // pergunta reserva da vaga (plano B)
  turns: Turn[]; // histórico: perguntas já respondidas
  current: OpenQuestion | null; // pergunta esperando resposta (null se acabou)
  questionCount: number; // perguntas feitas
  verifiedFollowUps: number; // follow-ups confirmados pelo código
  done: boolean;
  endReason: EndReason | null;
  incomplete: boolean;
  fallbackLog: string[]; // por que o plano B foi usado em cada vez
  flags: InjectionFlag[]; // VC-08: tentativas de injeção (só cresce, nunca diminui)
}
