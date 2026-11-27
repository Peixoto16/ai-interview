// O LAÇO DA ENTREVISTA (Cap. 6): pergunta no ar → candidato responde → a IA propõe → o harness decide.
//
// Este arquivo NÃO decide nada sobre a entrevista: quem conta, confere follow-up e encerra é o
// harness (`applyTurn`). Aqui só ficam os freios do laço:
//   - no máximo uma chamada à IA por pergunta respondida (VC-16);
//   - limite de tempo em cada chamada; se estourar, cancela o pedido; se der erro, plano B (VC-14);
//   - tudo gravado, até a falha (com o texto que chegou), e entregue a cada turno (VC-17).

import { FalhaDaIA } from "../llm/types.ts";
import type { LlmCall } from "../llm/types.ts";
import type { InterviewConfig, InterviewState } from "../harness/types.ts";
import type { RecordedTurn, SessionRecord } from "../harness/session.ts";
import { validateConfig } from "../harness/config.ts";
import { startInterview, applyTurn } from "../harness/turn.ts";
import { summarize } from "../harness/session.ts";
import { buildInterviewerRequest, PROMPT_VERSION } from "../policy/context.ts";
import type { Vaga } from "../policy/context.ts";

export interface FalhaGravada {
  turno: number;
  motivo: string;
  bruto?: string; // o que a IA mandou de verdade (quando chegou a mandar algo)
}

export interface SessaoGravada extends SessionRecord {
  meta: {
    model: string; // o modelo que RESPONDEU (se nenhuma chamada respondeu, o que foi pedido)
    modeloPedido: string;
    promptVersion: string;
    falhas: FalhaGravada[]; // por que cada chamada falhou (o plano B entrou no lugar)
  };
}

export interface OpcoesEntrevista {
  vaga: Vaga;
  config: InterviewConfig;
  call: LlmCall; // o Claude de verdade, ou um falso nos testes
  ask: (pergunta: string) => Promise<string>; // mostra a pergunta e espera a resposta do candidato
  model: string; // o modelo pedido
  timeoutMs?: number; // freio de tempo do laço (além do limite do próprio SDK)
  aoTurno?: (parcial: SessaoGravada) => void; // a sessão até aqui, a cada turno (para salvar no disco)
}

export interface ResultadoEntrevista {
  state: InterviewState;
  record: SessaoGravada;
  chamadas: number;
  erros: string[]; // as falhas em texto curto, para mostrar no terminal
}

// Uma chamada com prazo: se a IA não responder a tempo, aperta o "botão de desligar" (cancela o
// pedido de verdade) e vira erro, e o laço usa o plano B.
async function comPrazo<T>(p: Promise<T>, ms: number, desligar: AbortController): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => {
      desligar.abort();
      rejeitar(new Error(`passou do limite de tempo (${ms} ms)`));
    }, ms);
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
  const falhas: FalhaGravada[] = [];
  let modeloQueRespondeu: string | undefined;

  const montarRegistro = (): SessaoGravada => ({
    job: { openingQuestion: op.vaga.openingQuestion, fallbackQuestion: op.vaga.fallbackQuestion },
    config: op.config,
    turns: [...turns],
    dimensionScores: null, // a nota chega na 2a etapa (o avaliador)
    result: summarize(state, null, op.config),
    meta: {
      model: modeloQueRespondeu ?? op.model,
      modeloPedido: op.model,
      promptVersion: PROMPT_VERSION,
      falhas: [...falhas],
    },
  });

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
    const desligar = new AbortController();
    try {
      const pedido = { ...buildInterviewerRequest(op.vaga, conversa), signal: desligar.signal };
      const resposta = await comPrazo(op.call(pedido), prazo, desligar);
      proposal = resposta.saida;
      modeloQueRespondeu = resposta.modelo;
    } catch (e) {
      const falha: FalhaGravada = { turno: turns.length + 1, motivo: e instanceof Error ? e.message : String(e) };
      if (e instanceof FalhaDaIA) falha.bruto = e.bruto;
      falhas.push(falha);
      // proposal fica null → o harness não aceita → pergunta de reserva (plano B)
    }

    turns.push({ proposal, answer });
    state = applyTurn(state, proposal, answer, op.config);
    op.aoTurno?.(montarRegistro());
  }

  const erros = falhas.map((f) => `turno ${f.turno}: ${f.motivo}`);
  return { state, record: montarRegistro(), chamadas: turns.length, erros };
}
