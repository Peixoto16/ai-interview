// O CONTRATO de uma chamada à IA: o que vai (o pedido) e o que volta.
// O resto do sistema só conhece este tipo, nunca o SDK. Assim os testes usam um "Claude falso"
// (sem rede, sem custo, sempre igual) e trocar de modelo não mexe em nada fora de `claude.ts`.

export interface LlmRequest {
  system: string; // o papel e as regras (fixo entre os turnos)
  user: string; // a vaga e a conversa até agora (muda a cada turno)
  schema: Record<string, unknown>; // o formato JSON que a resposta tem que ter
  maxTokens: number;
  signal?: AbortSignal; // o "botão de desligar": quem chama aperta quando o prazo estoura (VC-14)
}

export interface LlmResposta {
  saida: unknown; // `unknown` de propósito: só passa a ter forma depois de conferido
  modelo: string; // o modelo que RESPONDEU (vem na resposta, não no pedido) (VC-17)
}

export type LlmCall = (req: LlmRequest) => Promise<LlmResposta>;

// Falha da IA que carrega o que ela mandou de verdade (recusa, texto quebrado...), para gravar (VC-17).
export class FalhaDaIA extends Error {
  readonly bruto: string;
  constructor(motivo: string, bruto: string) {
    super(motivo);
    this.name = "FalhaDaIA";
    this.bruto = bruto;
  }
}
