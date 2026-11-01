/**
 * Busca lexical (BM25) sobre os markdown versionados do repositório.
 * Cada trecho é um parágrafo ou item de lista, com o caminho de títulos onde está.
 */

export interface DocPassage {
  file: string;
  /** Títulos até o trecho (sem o H1), ex.: "v0.2.0 — 15 jul 2026 › Novidades › Agenda". */
  section: string;
  text: string;
}

export interface DocHit extends DocPassage {
  score: number;
  /** Fração dos termos da pergunta presentes no trecho (0–1). */
  coverage: number;
}

// Palavras sem valor de busca (artigos, preposições e verbos genéricos de pergunta).
const STOPWORDS = new Set(
  (
    'a o as os um uma uns umas de do da dos das no na nos nas em por para pra pelo pela pelos pelas com sem ' +
    'e ou que se nao sim ja mais menos muito pouco eu voce voces ele ela eles elas meu minha seu sua isso isto ' +
    'esse essa este esta aquele aquela ao aos qual quais quando onde como porque por que quem qual quanto ' +
    'ser sao foi era esta estao tem ter tenho temos ha pode posso podemos consigo consegue fazer faz faco ' +
    'funciona funcionar existe existem preciso precisa quero queria gostaria saber sobre algum alguma ' +
    'entao tambem ainda so the and of to in is'
  ).split(' '),
);

/** Minúsculas, sem acento, sem stopwords e com radical por prefixo (agendar/agendamento → agenda). */
export function tokenize(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => t.slice(0, 6));
}

/** Remove a sintaxe markdown mais comum para exibir o trecho como texto. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim();
}

const HEADING_RE = /^(#{1,4})\s+(.+?)\s*#*$/;
const BOLD_TITLE_RE = /^\*\*([^*]+)\*\*:?$/;
const LIST_ITEM_RE = /^\s*(?:[-*]|\d+\.)\s+/;

/** Quebra um markdown em trechos (parágrafos e itens de lista). Blocos de código e tabelas ficam de fora. */
export function parseMarkdown(file: string, markdown: string): DocPassage[] {
  const passages: DocPassage[] = [];
  const headings: string[] = [];
  let boldTitle: string | null = null;
  let buffer: string[] = [];
  let inCode = false;

  const flush = () => {
    const text = buffer.join('\n').trim();
    buffer = [];
    if (text.length < 20) return;
    // O título H1 é o nome do arquivo na prática; a fonte já mostra o arquivo.
    const section = [...headings.slice(1).filter(Boolean), ...(boldTitle ? [boldTitle] : [])].join(' › ');
    passages.push({ file, section: section || file, text });
  };

  for (const line of markdown.split(/\r?\n/)) {
    if (line.trim().startsWith('```')) {
      flush();
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      headings.length = level;
      headings[level - 1] = stripMarkdown(heading[2]);
      boldTitle = null;
      continue;
    }

    const trimmed = line.trim();
    const bold = BOLD_TITLE_RE.exec(trimmed);
    if (bold) {
      flush();
      boldTitle = bold[1].trim();
      continue;
    }

    if (!trimmed || trimmed === '---' || trimmed.startsWith('|')) {
      flush();
      continue;
    }
    // Cada item de lista vira um trecho; linhas de continuação ficam no item.
    if (LIST_ITEM_RE.test(line) && !/^\s{2,}/.test(line)) flush();
    buffer.push(line);
  }
  flush();
  return passages;
}

interface IndexedPassage {
  passage: DocPassage;
  terms: Map<string, number>;
  length: number;
}

const K1 = 1.2;
const B = 0.75;

export class DocsIndex {
  private readonly items: IndexedPassage[];
  private readonly docFreq = new Map<string, number>();
  private readonly avgLength: number;

  constructor(passages: DocPassage[]) {
    this.items = passages.map((passage) => {
      // O título conta como parte do trecho: "Agenda" acha os itens da seção Agenda.
      const tokens = tokenize(`${passage.section} ${passage.text}`);
      const terms = new Map<string, number>();
      for (const t of tokens) terms.set(t, (terms.get(t) ?? 0) + 1);
      return { passage, terms, length: tokens.length };
    });
    for (const item of this.items) {
      for (const t of item.terms.keys()) this.docFreq.set(t, (this.docFreq.get(t) ?? 0) + 1);
    }
    const total = this.items.reduce((sum, i) => sum + i.length, 0);
    this.avgLength = this.items.length ? total / this.items.length : 1;
  }

  get size(): number {
    return this.items.length;
  }

  search(query: string, limit: number): DocHit[] {
    const queryTerms = [...new Set(tokenize(query))];
    if (!queryTerms.length) return [];
    const n = this.items.length;

    const hits: DocHit[] = [];
    for (const item of this.items) {
      let score = 0;
      let matched = 0;
      for (const term of queryTerms) {
        const tf = item.terms.get(term);
        if (!tf) continue;
        matched++;
        const df = this.docFreq.get(term) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score += (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * item.length) / this.avgLength));
      }
      if (score > 0) hits.push({ ...item.passage, score, coverage: matched / queryTerms.length });
    }
    return hits.sort((a, b) => b.coverage - a.coverage || b.score - a.score).slice(0, limit);
  }
}
