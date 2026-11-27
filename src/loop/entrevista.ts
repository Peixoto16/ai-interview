// O LAÇO DA ENTREVISTA (Cap. 6): pergunta no ar → candidato responde → a IA propõe → o harness decide.
//
// Este arquivo NÃO decide nada sobre a entrevista: quem conta, confere follow-up e encerra é o
// harness (`applyTurn`). Aqui só ficam os freios do laço:
//   - no máximo uma chamada à IA por pergunta respondida (VC-16);
//   - limite de tempo em cada chamada; se estourar ou der erro, plano B (VC-14);
//   - tudo gravado, até a falha, para o replay (VC-17).

import type { LlmCall } from "../llm/types.ts";
import type { InterviewConfig, InterviewState } from "../harness/types.ts";
import type { RecordedTurn, SessionRecord } from "../harness/session.ts";
import { validateConfig } from "../harness/config.ts";
import { startInterview, applyTurn } from "../harness/turn.ts";
import { summarize } from "../harness/session.ts";
import { buildInterviewerRequest, PROMPT_VERSION } from "../policy/context.ts";
import type { Vaga } from "../policy/context.ts";

export interface SessaoGravada extends SessionRecord {
  meta: {
    model: string;
    promptVersion: string;
    erros: string[]; // por que cada chamada falhou (o plano B entrou no lugar)
  };
}

export interface OpcoesEntrevista {
  vaga: Vaga;
  config: InterviewConfig;
  call: LlmCall; // o Claude de verdade, ou um falso nos testes
  ask: (pergunta: string) => Promise<string>; // mostra a pergunta e espera a resposta do candidato
  model: string; // só para gravar na sessão
  timeoutMs?: number; // freio de tempo do laço (além do limite do próprio SDK)
}

export interface ResultadoEntrevista {
  state: InterviewState;
  record: SessaoGravada;
  chamadas: number;
  erros: string[];
}

// Uma chamada com prazo: se a IA não responder a tempo, vira erro (e o laço usa o plano B).
async function comPrazo<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error(`passou do limite de tempo (${ms} ms)`)), ms);
  });
  try {
    return await Promise.race([p, prazo]);
  } finally {
    clearTimeout(timer);
  }
}

export async function runInterview(op: OpcoesEntrevista): Promise<ResultadoEntrevista> {
  validateConfig(op.config);
  const prazo = op.timeoutMs ?? 45_000;
  let state = startInterview(op.vaga);
  const turns: RecordedTurn[] = [];
  const erros: string[] = [];

  // Freio duro: mesmo se algo der muito errado, nunca passa do teto de perguntas.
  for (let volta = 0; volta < op.config.maxQuestions && !state.done && state.current; volta++) {
    const pergunta = state.current.question;
    const answer = await op.ask(pergunta);

    // A IA vê a conversa INCLUINDO a resposta que acabou de chegar, e propõe a próxima.
    const conversa = [
      ...state.turns.map((t) => ({ pergunta: t.question, resposta: t.answer })),
      { pergunta, resposta: answer },
    ];
    let proposal: unknown = null;
    try {
      proposal = await comPrazo(op.call(buildInterviewerRequest(op.vaga, conversa)), prazo);
    } catch (e) {
      erros.push(`turno ${turns.length + 1}: ${e instanceof Error ? e.message : String(e)}`);
      // proposal fica null → o harness não aceita → pergunta de reserva (plano B)
    }

    turns.push({ proposal, answer });
    state = applyTurn(state, proposal, answer, op.config);
  }

  const record: SessaoGravada = {
    job: { openingQuestion: op.vaga.openingQuestion, fallbackQuestion: op.vaga.fallbackQuestion },
    config: op.config,
    turns,
    dimensionScores: null, // a nota chega na 2a etapa (o avaliador)
    result: summarize(state, null, op.config),
    meta: { model: op.model, promptVersion: PROMPT_VERSION, erros },
  };
  return { state, record, chamadas: turns.length, erros };
}
