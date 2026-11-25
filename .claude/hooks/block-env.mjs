#!/usr/bin/env node
// Hook PreToolUse: bloqueia qualquer leitura de arquivo .env (Read, Grep, Glob, Bash).
//
// Contrato (code.claude.com/docs/en/hooks, Claude Code 2.1.296):
// - entrada: um JSON no stdin com tool_name e tool_input (entre outros campos);
// - saída estruturada: exit 0 + JSON no stdout com
//   hookSpecificOutput.permissionDecision = "deny" e permissionDecisionReason;
// - alternativa equivalente: exit 2 + motivo no stderr (o Claude recebe o stderr como erro).
// Usamos a saída JSON. Sem dependências: só Node.
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

// .env, .env.local, .env.production... mas não .env.example (modelo sem segredo).
export function isSecretEnvPath(p) {
  if (typeof p !== "string" || p === "") return false;
  const name = basename(p);
  return /^\.env(\..+)?$/.test(name) && name !== ".env.example";
}

// Procura um token .env dentro de um comando de shell (cat .env, type .\.env, cat .env*...).
// Regra "bloquear a mais, nunca a menos": depois do nome, só NÃO conta se continuar com letra/número
// (.envrc é outro arquivo). Coringa (*), crase, ponto, ; e fim de linha contam como .env.
// Antes do nome aceita também \ (caminho do Windows), crase, ( e :.
export function commandTouchesEnv(cmd) {
  if (typeof cmd !== "string") return false;
  const re = /(?:^|[\s/\\'"=<`(:;|&>])(\.env(?:\.[\w.-]+)?)(?![\w-])/g;
  for (const m of cmd.matchAll(re)) if (m[1] !== ".env.example") return true;
  return false;
}

// Decide a partir do JSON de entrada do hook. Retorna null (deixa seguir) ou o motivo do bloqueio.
export function decide(input) {
  const t = input?.tool_input ?? {};
  switch (input?.tool_name) {
    case "Read":
      return isSecretEnvPath(t.file_path) ? `leitura de ${t.file_path} bloqueada` : null;
    case "Grep":
      return isSecretEnvPath(t.path) || /\.env(?!\.example)/.test(t.glob ?? "")
        ? "busca dentro de .env bloqueada" : null;
    case "Glob":
      return /(^|\/)\.env(?!\.example)/.test(t.pattern ?? "") ? "listagem de .env bloqueada" : null;
    case "Bash":
    case "PowerShell": // no Windows, a shell principal é o PowerShell
      return commandTouchesEnv(t.command) ? "comando de shell que lê .env bloqueado" : null;
    default:
      return null;
  }
}

export function hookOutput(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `${reason}. Segredos ficam fora do contexto do agente (hook block-env).`,
    },
  };
}

// Execução como hook: lê stdin, escreve a decisão, sempre exit 0 (a decisão vai no JSON).
// FAIL-CLOSED: se o próprio hook falhar (entrada ilegível, erro inesperado), ele BLOQUEIA.
// Uma tranca quebrada fica fechada, nunca aberta.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    try {
      const reason = decide(JSON.parse(raw));
      if (reason) process.stdout.write(JSON.stringify(hookOutput(reason)));
    } catch (e) {
      process.stderr.write(`block-env: entrada inválida (${e instanceof Error ? e.message : e})\n`);
      process.stdout.write(JSON.stringify(hookOutput("hook não conseguiu ler a entrada, bloqueado por segurança")));
    }
    process.exit(0);
  });
}
