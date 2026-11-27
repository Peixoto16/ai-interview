// O CONTRATO de uma chamada à IA: o que vai (o pedido) e o que volta (`unknown`, sempre).
// O resto do sistema só conhece este tipo, nunca o SDK. Assim os testes usam um "Claude falso"
// (sem rede, sem custo, sempre igual) e trocar de modelo não mexe em nada fora de `claude.ts`.

export interface LlmRequest {
  system: string; // o papel e as regras (fixo entre os turnos)
  user: string; // a vaga e a conversa até agora (muda a cada turno)
  schema: Record<string, unknown>; // o formato JSON que a resposta tem que ter
  maxTokens: number;
}

// Devolve `unknown` de propósito: o que vem da IA só passa a ter forma depois de conferido.
export type LlmCall = (req: LlmRequest) => Promise<unknown>;
