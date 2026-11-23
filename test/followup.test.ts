import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyFollowUp } from "../src/harness/followup.ts";

// VC-07: follow-up VERIFICADO = >= 2 palavras de conteúdo em comum
// E elas somam >= 20% das palavras de conteúdo da pergunta.

test("VC-07: pergunta que aprofunda a resposta anterior é follow-up", () => {
  const resposta = "Usei Redis para cache de sessões e invalidação por TTL";
  const pergunta = "Como você definiu o TTL do cache no Redis?";
  assert.equal(verifyFollowUp(pergunta, resposta), true);
});

test("VC-07: pergunta sem relação NÃO é follow-up", () => {
  const resposta = "Usei Redis para cache de sessões e invalidação por TTL";
  assert.equal(verifyFollowUp("Qual é o seu hobby favorito?", resposta), false);
});

test("VC-07: só 1 palavra em comum NÃO basta", () => {
  assert.equal(
    verifyFollowUp("Você já trabalhou com Redis em produção em equipes grandes?", "Eu uso Redis"),
    false,
  );
});

test("VC-07: 2 palavras em comum, mas menos de 20% da pergunta, NÃO basta", () => {
  // pergunta com 12 palavras de conteúdo; só 2 (cache, redis) vêm da resposta = ~17%
  const pergunta =
    "Explique detalhadamente como funciona arquitetura distribuída escalável resiliente tolerante falhas redes cache redis";
  assert.equal(verifyFollowUp(pergunta, "Usei cache com redis"), false);
});

test("VC-07: acentos não atrapalham (implementação = implementacao)", () => {
  const resposta = "Fiz a implementação da autenticação com tokens JWT";
  assert.equal(verifyFollowUp("Como foi a implementacao da autenticacao?", resposta), true);
});

test("VC-07: palavras sem conteúdo ('o', 'de', 'para'...) não contam", () => {
  assert.equal(verifyFollowUp("o que é a de para com", "o que é a de para com"), false);
});

test("VC-07/VC-05: sem resposta anterior, não existe follow-up", () => {
  assert.equal(verifyFollowUp("Fale sobre Redis e cache", ""), false);
});
