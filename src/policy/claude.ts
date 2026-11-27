// O ÚNICO arquivo que conhece o SDK da Anthropic (regra llm-integration: só policy e judge chamam o LLM).
// Ele transforma um `LlmRequest` numa chamada ao Claude e devolve a resposta como `unknown`.
// Qualquer problema vira um erro com motivo claro; quem chama (o laço) troca o erro pelo plano B.

import Anthropic from "@anthropic-ai/sdk";
import type { LlmCall, LlmRequest } from "../llm/types.ts";

// Para testes, o mais barato. Trocar de modelo: variável AI_INTERVIEW_MODEL no .env.
export const MODELO_PADRAO = "claude-haiku-5-5";

// O mínimo da mensagem que precisamos ler (assim dá para testar com mensagens montadas à mão).
interface RespostaClaude {
  stop_reason: string | null;
  content: { type: string; text?: string }[];
}

// Lê a resposta do Claude. Não confia em nada: cada caso estranho vira erro com nome.
export function extrairJson(msg: RespostaClaude): unknown {
  if (msg.stop_reason === "refusal") throw new Error("o Claude recusou responder");
  if (msg.stop_reason === "max_tokens") throw new Error("resposta cortada (limite de tokens)");
  const texto = msg.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("")
    .trim();
  if (texto === "") throw new Error("resposta vazia");
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    throw new Error(`resposta não é JSON: ${texto.slice(0, 80)}`);
  }
}

export interface OpcoesClaude {
  modelo?: string;
  timeoutMs?: number; // limite de tempo de cada tentativa
  novasTentativas?: number; // o SDK repete sozinho em erro de rede, 429 e 5xx
}

// Fábrica: cria a função de chamada. A chave vem de ANTHROPIC_API_KEY (só no servidor, nunca no código).
export function claudeCall(op: OpcoesClaude = {}): LlmCall {
  const modelo = op.modelo ?? MODELO_PADRAO;
  const client = new Anthropic({ timeout: op.timeoutMs ?? 30_000, maxRetries: op.novasTentativas ?? 2 });

  return async (req: LlmRequest) => {
    const msg = await client.messages.create({
      model: modelo,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
      // JSON no formato exato do schema. Mesmo assim, o harness confere tudo de novo (parseProposal).
      output_config: { effort: "low", format: { type: "json_schema", schema: req.schema } },
    });
    return extrairJson(msg);
  };
}
