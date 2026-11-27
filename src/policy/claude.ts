// O ÚNICO arquivo que conhece o SDK da Anthropic (regra llm-integration: só policy e judge chamam o LLM).
// Ele transforma um `LlmRequest` numa chamada ao Claude e devolve a resposta como `unknown`.
// Qualquer problema vira um erro com motivo claro; quem chama (o laço) troca o erro pelo plano B.
//
// Sem `temperature`: os modelos novos do Claude recusam esse parâmetro (erro 400).

import Anthropic from "@anthropic-ai/sdk";
import { FalhaDaIA } from "../llm/types.ts";
import type { LlmCall, LlmRequest } from "../llm/types.ts";

// Para testes, o mais barato. Trocar de modelo: variável AI_INTERVIEW_MODEL no .env.
export const MODELO_PADRAO = "claude-haiku-5-5";

// O mínimo da mensagem que precisamos ler (assim dá para testar com mensagens montadas à mão).
interface RespostaClaude {
  model?: string;
  stop_reason: string | null;
  content: { type: string; text?: string }[];
}

// Lê a resposta do Claude. Não confia em nada: cada caso estranho vira erro com nome,
// levando junto o texto que chegou (para a sessão gravar o que aconteceu de verdade).
export function extrairJson(msg: RespostaClaude): unknown {
  const texto = msg.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("")
    .trim();
  if (msg.stop_reason === "refusal") throw new FalhaDaIA("o Claude recusou responder", texto);
  if (msg.stop_reason === "max_tokens") throw new FalhaDaIA("resposta cortada (limite de tokens)", texto);
  if (texto === "") throw new FalhaDaIA("resposta vazia", texto);
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    throw new FalhaDaIA("resposta não é JSON", texto);
  }
}

// O pedaço do SDK que usamos. Nos testes entra um cliente falso no lugar (sem rede).
interface ClienteClaude {
  messages: { create(corpo: never, opcoes?: { signal?: AbortSignal }): Promise<RespostaClaude> };
}

export interface OpcoesClaude {
  modelo?: string;
  timeoutMs?: number; // limite de tempo de cada tentativa
  novasTentativas?: number; // o SDK repete sozinho em erro de rede, 429 e 5xx
  cliente?: ClienteClaude; // só para testes
}

// Fábrica: cria a função de chamada. A chave vem de ANTHROPIC_API_KEY (só no servidor, nunca no código).
export function claudeCall(op: OpcoesClaude = {}): LlmCall {
  const modelo = op.modelo ?? MODELO_PADRAO;
  const client: ClienteClaude =
    op.cliente ?? (new Anthropic({ timeout: op.timeoutMs ?? 30_000, maxRetries: op.novasTentativas ?? 2 }) as unknown as ClienteClaude);

  return async (req: LlmRequest) => {
    const corpo = {
      model: modelo,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
      // JSON no formato exato do schema. Mesmo assim, o harness confere tudo de novo (parseProposal).
      output_config: { effort: "low", format: { type: "json_schema", schema: req.schema } },
    };
    // O sinal vai junto: se o laço desistir (prazo), o SDK cancela o pedido de verdade.
    const msg = await client.messages.create(corpo as never, { signal: req.signal });
    return { saida: extrairJson(msg), modelo: msg.model ?? modelo };
  };
}
