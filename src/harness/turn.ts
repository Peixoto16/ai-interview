import type { InterviewConfig, InterviewState, OpenQuestion } from "./types.ts";
import { parseProposal } from "./proposal.ts";
import { verifyFollowUp } from "./followup.ts";
import { decideEnd } from "./gate.ts";
import { detectInjection } from "./injection.ts";

// Começa a entrevista: a 1a pergunta já está no ar.
// VC-05: ela conta como pergunta, mas nunca como follow-up (não há resposta anterior).
export function startInterview(job: { openingQuestion: string; fallbackQuestion: string }): InterviewState {
  return {
    fallbackQuestion: job.fallbackQuestion,
    turns: [],
    current: { question: job.openingQuestion, followUpVerified: false, source: "ai" },
    questionCount: 1,
    verifiedFollowUps: 0,
    done: false,
    endReason: null,
    incomplete: false,
    fallbackLog: [],
    flags: [],
  };
}

// UM TURNO DA ENTREVISTA.
// Entra: placar atual + proposta da IA (qualquer coisa) + resposta da pessoa.
// Sai: um placar NOVO. O antigo não é alterado.
export function applyTurn(
  state: InterviewState,
  rawProposal: unknown,
  answer: string,
  c: InterviewConfig,
): InterviewState {
  // 0. Já acabou? Não mexe em nada.
  if (state.done || state.current === null) return state;

  // 1. A pessoa respondeu a pergunta que estava no ar: vai para o histórico.
  const turns = [...state.turns, { ...state.current, answer }];

  // 1b. ALARME (VC-08): só a resposta do CANDIDATO passa pelo detector.
  //     A bandeira entra no placar e só se acumula. Não existe caminho para a IA apagá-la.
  const suspeitas = detectInjection(answer);
  const flags =
    suspeitas.length > 0 ? [...state.flags, { turn: turns.length, patterns: suspeitas }] : state.flags;

  // 2. Alfândega: a proposta da IA é válida? Se não, plano B.
  const parsed = parseProposal(rawProposal);
  const fallbackLog = parsed.ok
    ? state.fallbackLog
    : [...state.fallbackLog, `turno ${turns.length}: ${parsed.reason}`];
  const nextQuestion = parsed.ok ? parsed.proposal.nextQuestion : state.fallbackQuestion;
  const aiDone = parsed.ok ? parsed.proposal.done : false; // plano B nunca encerra

  // 3. Juiz: pode acabar agora? (olha o placar das perguntas JÁ respondidas)
  const end = decideEnd(state, aiDone, c);
  if (end.done) {
    return { ...state, turns, current: null, fallbackLog, flags, ...end };
  }

  // 4. Não acabou: a próxima pergunta vai ao ar.
  //    O CÓDIGO confere se ela é follow-up. O que a IA disse sobre isso não importa.
  //    A pergunta reserva é fixa (o candidato pode conhecê-la), então NUNCA conta como follow-up.
  //    Turno com bandeira também não conta (ameaça A2): o candidato pode ter "pedido" a pergunta.
  const isFollowUp = parsed.ok && suspeitas.length === 0 && verifyFollowUp(nextQuestion, answer);
  const current: OpenQuestion = {
    question: nextQuestion,
    followUpVerified: isFollowUp,
    source: parsed.ok ? "ai" : "fallback",
  };

  return {
    ...state,
    turns,
    current,
    questionCount: state.questionCount + 1,
    verifiedFollowUps: state.verifiedFollowUps + (isFollowUp ? 1 : 0),
    fallbackLog,
    flags,
  };
}
