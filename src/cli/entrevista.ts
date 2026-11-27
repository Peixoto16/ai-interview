// A ENTREVISTA NO TERMINAL: `npm run entrevista` (precisa de ANTHROPIC_API_KEY no .env).
// Você responde digitando; o Claude propõe as perguntas; o harness decide tudo.
// No fim, a sessão é salva em `sessoes/` (fora do git: tem as suas respostas) e conferida pelo replay.

import { createInterface } from "node:readline/promises";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { DEFAULT_CONFIG } from "../harness/config.ts";
import { replay } from "../harness/session.ts";
import { runInterview } from "../loop/entrevista.ts";
import { claudeCall, MODELO_PADRAO } from "../policy/claude.ts";
import type { Vaga } from "../policy/context.ts";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Falta a chave: crie o arquivo .env na raiz do projeto com a linha ANTHROPIC_API_KEY=sk-ant-api...");
  process.exit(1);
}

const arquivoVaga = process.argv[2] ?? "vagas/backend.json";
const vaga = JSON.parse(readFileSync(arquivoVaga, "utf8")) as Vaga;
const modelo = process.env.AI_INTERVIEW_MODEL ?? MODELO_PADRAO;

const rl = createInterface({ input: process.stdin, output: process.stdout });
console.log(`\nEntrevista: ${vaga.titulo}   (modelo: ${modelo})`);
console.log("Responda cada pergunta e aperte Enter. Ctrl+C sai.\n");

const r = await runInterview({
  vaga,
  config: DEFAULT_CONFIG,
  call: claudeCall({ modelo }),
  model: modelo,
  ask: async (pergunta) => {
    let resposta = "";
    while (resposta.trim() === "") resposta = await rl.question(`\nEntrevistador: ${pergunta}\nVocê: `);
    return resposta;
  },
});
rl.close();

const s = r.state;
console.log("\n--- Fim da entrevista ---");
console.log(`Motivo do fim: ${s.endReason === "gate" ? "portão (mínimos atingidos e a IA quis encerrar)" : "teto de perguntas"}`);
console.log(`Perguntas: ${s.questionCount}   Follow-ups verificados pelo código: ${s.verifiedFollowUps}`);
console.log(`Incompleta: ${s.incomplete ? "sim" : "não"}   Plano B usado: ${s.fallbackLog.length}x`);
if (s.flags.length > 0) console.log(`Bandeiras (revisão humana): ${s.flags.map((f) => `turno ${f.turn}: ${f.patterns.join(", ")}`).join("; ")}`);
if (r.erros.length > 0) console.log(`Falhas da IA (viraram plano B): ${r.erros.join("; ")}`);
console.log("Nota: chega na próxima etapa (o avaliador).");

mkdirSync("sessoes", { recursive: true });
const arquivo = `sessoes/sessao-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(arquivo, JSON.stringify(r.record, null, 2));
const rep = replay(r.record);
console.log(`\nSessão salva em ${arquivo}. Replay: ${rep.ok ? "bate" : "NÃO bate: " + rep.diffs.join("; ")}`);
