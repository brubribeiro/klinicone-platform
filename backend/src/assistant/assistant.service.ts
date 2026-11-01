import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { Injectable, Logger } from '@nestjs/common';

import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DocsIndex, parseMarkdown, stripMarkdown } from './docs-index';

/** Clínica vê só as notas de versão (para usuários); o painel da plataforma vê também a doc técnica. */
export type AssistantAudience = 'clinic' | 'platform';

const CORPUS: Record<AssistantAudience, string[]> = {
  clinic: ['RELEASE_NOTES.md'],
  platform: ['RELEASE_NOTES.md', 'README.md', 'AGENTS.md'],
};

/** Parte mínima dos termos da pergunta que precisa estar no trecho para contar como resposta. */
const MIN_COVERAGE = 0.6;
const MAX_SOURCES = 1;
const MAX_EXCERPT = 600;

export interface AssistantSource {
  file: string;
  section: string;
  excerpt: string;
}

export interface AssistantAnswer {
  covered: boolean;
  answer: string;
  sources: AssistantSource[];
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly indexes = new Map<AssistantAudience, DocsIndex>();

  private readonly docsDir = AssistantService.resolveDocsDir();

  /**
   * Pasta com os markdown do repositório. No Render o serviço roda em `backend/`,
   * então o padrão é a pasta pai do processo.
   */
  static resolveDocsDir(): string {
    if (process.env.ASSISTANT_DOCS_DIR) return resolve(process.env.ASSISTANT_DOCS_DIR);
    const candidates = [resolve(process.cwd(), '..'), process.cwd()];
    return candidates.find((dir) => existsSync(join(dir, 'RELEASE_NOTES.md'))) ?? candidates[0];
  }

  static audienceFor(user: AuthenticatedUser): AssistantAudience {
    // Super-admin "entrando como" uma clínica tem tenantId: responde como a clínica veria.
    return user.isSuperAdmin && !user.tenantId ? 'platform' : 'clinic';
  }

  ask(question: string, audience: AssistantAudience): AssistantAnswer {
    const found = this.indexFor(audience)
      .search(question, MAX_SOURCES)
      .filter((hit) => hit.coverage >= MIN_COVERAGE);
    // Trechos bem menos relevantes que o primeiro só poluem a resposta.
    const hits = found.filter((hit) => hit.score >= found[0].score * 0.5);

    if (!hits.length) {
      return {
        covered: false,
        answer:
          audience === 'clinic'
            ? 'Não encontrei isso na documentação da plataforma, então prefiro não responder de cabeça. ' +
              'Tente perguntar com outras palavras ou envie sua dúvida pelo Feedback para a equipe.'
            : 'Não encontrei isso no README, nas notas de versão nem no AGENTS.md. ' +
              'Vale conferir o CHANGELOG ou registrar a dúvida como issue.',
        sources: [],
      };
    }

    const top = hits[0];
    const body = truncate(stripMarkdown(top.text), MAX_EXCERPT);

    return {
      covered: true,
      answer: body,
      sources: [
        {
          file: top.file,
          section: top.section,
          excerpt: body,
        },
      ],
    };
  }

  private indexFor(audience: AssistantAudience): DocsIndex {
    let index = this.indexes.get(audience);
    if (!index) {
      const passages = CORPUS[audience].flatMap((file) => {
        const path = join(this.docsDir, file);
        if (!existsSync(path)) {
          this.logger.warn(`Documento do assistente não encontrado: ${path}`);
          return [];
        }
        return parseMarkdown(file, readFileSync(path, 'utf8'));
      });
      index = new DocsIndex(passages);
      this.indexes.set(audience, index);
    }
    return index;
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}
