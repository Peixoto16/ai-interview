// VC-11: A CÂMERA (gravação e replay da entrevista).
//
// Uma entrevista gravada guarda só DADOS: a vaga, a config, as jogadas (proposta da IA + resposta)
// e as notas que a IA avaliadora deu. Com isso, o replay refaz a entrevista inteira SEM chamar a IA
// e confere se chega no mesmo resultado. Só funciona porque o harness é feito de funções puras.

import type { EndReason, InjectionFlag, InterviewConfig, InterviewState } from "./types.ts";
import { validateConfig } from "./config.ts";
import { startInterview, applyTurn } from "./turn.ts";
import { finalScore } from "./score.ts";

export interface Job {
  openingQuestion: string;
  fallbackQuestion: string;
}

// Uma jogada gravada: o que a IA propôs (como veio, mesmo que quebrado) e o que o candidato respondeu.
export interface RecordedTurn {
  proposal: unknown;
  answer: string;
}

// O resultado que fica gravado no fim da entrevista (e que o replay confere).
export interface SessionResult {
  questionCount: number;
  verifiedFollowUps: number;
  endReason: EndReason | null;
  incomplete: boolean;
  fallbacks: number; // quantas vezes o plano B foi usado
  flags: InjectionFlag[];
  finalScore: number | null; // null enquanto a IA avaliadora ainda não deu as notas
}

// A sessão salva: tudo o que é preciso para refazer a entrevista, e o resultado gravado na hora.
export interface SessionRecord {
  job: Job;
  config: InterviewConfig;
  turns: RecordedTurn[];
  dimensionScores: unknown; // saída gravada da IA avaliadora (validada só no cálculo da nota)
  result: SessionResult;
}

// Roda a entrevista inteira a partir das jogadas gravadas. Sem IA: as propostas já estão gravadas.
export function runSession(job: Job, c: InterviewConfig, turns: RecordedTurn[]): InterviewState {
  validateConfig(c);
  let state = startInterview(job);
  for (const t of turns) state = applyTurn(state, t.proposal, t.answer, c);
  return state;
}

// Monta o resultado a partir do placar final (e das notas, se já existirem).
export function summarize(state: InterviewState, dimensionScores: unknown, c: InterviewConfig): SessionResult {
  return {
    questionCount: state.questionCount,
    verifiedFollowUps: state.verifiedFollowUps,
    endReason: state.endReason,
    incomplete: state.incomplete,
    fallbacks: state.fallbackLog.length,
    flags: state.flags,
    finalScore: dimensionScores == null ? null : finalScore(dimensionScores, c),
  };
}

// Campos conferidos pelo replay, numa ordem fixa.
const CAMPOS: (keyof SessionResult)[] = [
  "questionCount",
  "verifiedFollowUps",
  "endReason",
  "incomplete",
  "fallbacks",
  "flags",
  "finalScore",
];

export interface ReplayResult {
  ok: boolean; // true = o gravado bate com o recalculado
  recomputed: SessionResult;
  diffs: string[]; // ex.: 'finalScore: gravado 100, recalculado 66.25'
}

// O REPLAY: refaz tudo sem IA e compara campo a campo com o que foi gravado.
// Se alguém mexeu na nota ou apagou uma bandeira, aparece aqui.
export function replay(record: SessionRecord): ReplayResult {
  const state = runSession(record.job, record.config, record.turns);
  const recomputed = summarize(state, record.dimensionScores, record.config);

  const diffs: string[] = [];
  for (const campo of CAMPOS) {
    const gravado = JSON.stringify(record.result?.[campo]);
    const recalculado = JSON.stringify(recomputed[campo]);
    if (gravado !== recalculado) diffs.push(`${campo}: gravado ${gravado}, recalculado ${recalculado}`);
  }
  return { ok: diffs.length === 0, recomputed, diffs };
}
