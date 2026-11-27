// A ENTREVISTA NO TERMINAL: `npm run entrevista` (precisa de ANTHROPIC_API_KEY no .env).
// Você responde digitando; o Claude propõe as perguntas; o harness decide tudo.
// A sessão é salva em `sessoes/` (fora do git: tem as suas respostas) A CADA TURNO, então um Ctrl+C
// no meio não perde nada. No fim, ela é conferida pelo replay.

import { createInterface } from "node:readline/promises";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { DEFAULT_CONFIG } from "../harness/config.ts";
import { replay } from "../harness/session.ts";
import { runInterview } from "../loop/entrevista.ts";
import type { SessaoGravada } from "../loop/entrevista.ts";
import { claudeCall, MODELO_PADRAO } from "../policy/claude.ts";
import { parseVaga } from "../policy/context.ts";
import type { Vaga } from "../policy/context.ts";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Falta a chave: crie o arquivo .env na raiz do projeto com a linha ANTHROPIC_API_KEY=sk-ant-api...");
  process.exit(1);
}

const arquivoVaga = process.argv[2] ?? "vagas/backend.json";
let vaga: Vaga;
try {
  vaga = parseVaga(JSON.parse(readFileSync(arquivoVaga, "utf8")));
} catch (e) {
  console.error(`Não deu para ler a vaga em ${arquivoVaga}: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
const modelo = process.env.AI_INTERVIEW_MODEL ?? MODELO_PADRAO;

mkdirSync("sessoes", { recursive: true });
const arquivo = `sessoes/sessao-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
const salvar = (rec: SessaoGravada) => writeFileSync(arquivo, JSON.stringify(rec, null, 2));

const rl = createInterface({ input: process.stdin, output: process.stdout });
// Ctrl+C ou fim da entrada fecham o terminal. Sem isto, a pergunta pendente ficaria esperando para sempre.
const entradaFechou = new Promise<never>((_, rejeitar) => {
  rl.once("close", () => rejeitar(Object.assign(new Error("entrada encerrada"), { name: "AbortError" })));
});
entradaFechou.catch(() => {}); // evita aviso de "erro não tratado" quando ninguém está perguntando
console.log(`\nEntrevista: ${vaga.titulo}   (modelo: ${modelo})`);
console.log("Responda cada pergunta e aperte Enter. Ctrl+C sai (o que já respondeu fica salvo).\n");

let r;
try {
  r = await runInterview({
    vaga,
    config: DEFAULT_CONFIG,
    call: claudeCall({ modelo }),
    model: modelo,
    aoTurno: salvar,
    ask: async (pergunta) => {
      let resposta = "";
      while (resposta.trim() === "") {
        resposta = await Promise.race([rl.question(`\nEntrevistador: ${pergunta}\nVocê: `), entradaFechou]);
      }
      return resposta;
    },
  });
} catch (e) {
  // Só "a entrada acabou / foi cancelada" é interrupção normal: os turnos já respondidos estão no arquivo.
  // Qualquer outro erro é bug de verdade: mostra e sai com código de erro (1), sem esconder.
  const cancelou = e instanceof Error && (e.name === "AbortError" || (e as { code?: string }).code === "ABORT_ERR");
  const salvo = existsSync(arquivo) ? `O que já foi respondido está salvo em ${arquivo}.` : "Nenhuma resposta tinha sido dada.";
  if (cancelou) {
    console.log(`\nEntrevista interrompida. ${salvo}`);
    process.exit(0);
  }
  console.error(`\nErro inesperado: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  console.error(salvo);
  process.exit(1);
} finally {
  rl.close();
}

const s = r.state;
console.log("\n--- Fim da entrevista ---");
console.log(`Motivo do fim: ${s.endReason === "gate" ? "portão (mínimos atingidos e a IA quis encerrar)" : "teto de perguntas"}`);
console.log(`Perguntas: ${s.questionCount}   Follow-ups verificados pelo código: ${s.verifiedFollowUps}`);
console.log(`Incompleta: ${s.incomplete ? "sim" : "não"}   Plano B usado: ${s.fallbackLog.length}x`);
if (s.flags.length > 0) console.log(`Bandeiras (revisão humana): ${s.flags.map((f) => `turno ${f.turn}: ${f.patterns.join(", ")}`).join("; ")}`);
if (r.erros.length > 0) console.log(`Falhas da IA (viraram plano B): ${r.erros.join("; ")}`);
if (r.record.meta.model !== modelo) console.log(`Modelo que respondeu: ${r.record.meta.model}`);
console.log("Nota: chega na próxima etapa (o avaliador).");

salvar(r.record);
const rep = replay(r.record);
console.log(`\nSessão salva em ${arquivo}. Replay: ${rep.ok ? "bate" : "NÃO bate: " + rep.diffs.join("; ")}`);
