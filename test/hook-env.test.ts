import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { decide } from "../.claude/hooks/block-env.mjs";

// Regra dura do CLAUDE.md: segredos só em .env, e esse arquivo nunca é lido pelo agente.
// O hook é a TRANCA dessa regra. Estes testes tentam abrir a tranca.

const HOOK = fileURLToPath(new URL("../.claude/hooks/block-env.mjs", import.meta.url));
const shell = (tool: string, command: string) => ({ tool_name: tool, tool_input: { command } });

test("segredos (warning 1): comando no PowerShell que lê .env é bloqueado", () => {
  assert.ok(decide(shell("PowerShell", "Get-Content .env")));
  assert.ok(decide(shell("PowerShell", "type .\\.env")));
  assert.ok(decide(shell("PowerShell", "Get-Content C:\\projeto\\.env.local")));
});

test("segredos (warning 2): jeitos comuns de escrever .env no shell são bloqueados", () => {
  const ataques = [
    "cat .env*", // coringa depois do nome
    "cat .env.*", // coringa depois do ponto
    "echo `cat .env`", // crase
    "type C:\\proj\\.env", // caminho do Windows com barra invertida
    "cat ./config/.env", // subpasta
    "cat .env;ls", // seguido de ;
  ];
  for (const cmd of ataques) assert.ok(decide(shell("Bash", cmd)), `deveria bloquear: ${cmd}`);
});

test("segredos: comandos normais e .env.example continuam liberados", () => {
  const normais = [
    ["Bash", "npm test"],
    ["Bash", "cat README.md"],
    ["Bash", "cat .env.example"],
    ["PowerShell", "npm.cmd test"],
    ["PowerShell", "Get-Content .env.example"],
    ["PowerShell", "git status"],
  ];
  for (const [tool, cmd] of normais) assert.equal(decide(shell(tool, cmd)), null, `deveria liberar: ${cmd}`);
});

// Roda o hook de verdade, como o Claude Code roda: JSON entrando pelo stdin.
const runHook = (stdin: string) =>
  spawnSync(process.execPath, [HOOK], { input: stdin, encoding: "utf8" });

test("segredos (warning 3): entrada ilegível → hook BLOQUEIA (fail-closed), não libera", () => {
  for (const entrada of ["isso não é json", ""]) {
    const r = runHook(entrada);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /"permissionDecision":"deny"/, `deveria negar com entrada: ${JSON.stringify(entrada)}`);
  }
});

test("segredos: hook de verdade bloqueia .env e libera arquivo normal", () => {
  const bloqueio = runHook(JSON.stringify({ tool_name: "Read", tool_input: { file_path: "C:/x/.env" } }));
  assert.match(bloqueio.stdout, /"permissionDecision":"deny"/);

  const liberado = runHook(JSON.stringify({ tool_name: "Read", tool_input: { file_path: "C:/x/spec.md" } }));
  assert.equal(liberado.stdout, "");
});
