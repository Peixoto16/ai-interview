// Palavras "de enfeite": não dizem sobre o que a pergunta é. Ficam de fora da conta.
const STOPWORDS = new Set([
  "para", "por", "com", "que", "como", "qual", "quais", "foi", "ser", "era", "sao",
  "voce", "seu", "sua", "meu", "minha", "mais", "mas", "ele", "ela", "isso", "esse",
  "essa", "este", "esta", "quando", "onde", "porque", "pelo", "pela", "uns", "umas",
  "entre", "sobre", "tem", "tinha", "fez", "fazer", "nao", "sim", "muito", "uma",
  "dos", "das", "nos", "nas", "aos", "ate", "ja", "tambem", "ainda", "depois",
]);

// Transforma um texto no conjunto de suas "palavras de conteúdo":
// minúsculas, sem acento, só letras/números, sem enfeites, com 3+ letras.
function contentWords(text: string): Set<string> {
  const limpo = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // tira os acentos
  const palavras = limpo.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return new Set(palavras); // Set: palavra repetida conta uma vez só
}

// VC-07: a pergunta aprofunda mesmo a resposta anterior?
// Precisa de >= 2 palavras em comum E elas serem >= 20% das palavras da pergunta.
// Note: NÃO recebe o `isFollowUp` da IA. O código confere sozinho.
export function verifyFollowUp(question: string, previousAnswer: string): boolean {
  const q = contentWords(question);
  if (q.size === 0) return false;
  const a = contentWords(previousAnswer);

  let emComum = 0;
  for (const palavra of q) if (a.has(palavra)) emComum++;

  return emComum >= 2 && emComum / q.size >= 0.2;
}
