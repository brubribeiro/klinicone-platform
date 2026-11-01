import { AssistantService } from './assistant.service';
import { DocsIndex, parseMarkdown, stripMarkdown, tokenize } from './docs-index';

const SAMPLE = `# Release Notes

## v1.0

### Novidades

**Agenda**
- Calendário com visões **Dia**, **Semana** e **Mês**.
- Botão **Novo agendamento** no topo.

**Visual**
- **Modo escuro**: o botão da lua alterna o tema.

\`\`\`bash
npm run dev
\`\`\`
`;

describe('docs-index', () => {
  it('tokeniza sem acento, sem stopwords e com radical por prefixo', () => {
    expect(tokenize('Como faço um Agendamento?')).toEqual(['agenda']);
    expect(tokenize('Notificações')).toEqual(['notifi']);
  });

  it('quebra o markdown em itens com o caminho de títulos (sem H1 e sem código)', () => {
    const passages = parseMarkdown('NOTES.md', SAMPLE);
    expect(passages.map((p) => p.section)).toEqual([
      'v1.0 › Novidades › Agenda',
      'v1.0 › Novidades › Agenda',
      'v1.0 › Novidades › Visual',
    ]);
    expect(passages.some((p) => p.text.includes('npm run dev'))).toBe(false);
  });

  it('acha o item certo e mede quantos termos da pergunta ele cobre', () => {
    const index = new DocsIndex(parseMarkdown('NOTES.md', SAMPLE));
    const [hit] = index.search('Como ativar o modo escuro?', 3);
    expect(hit.text).toContain('Modo escuro');
    expect(hit.coverage).toBeCloseTo(2 / 3);
  });

  it('remove a sintaxe markdown do trecho', () => {
    expect(stripMarkdown('- **Salvar** em [ficha](./x.md) com `PDF`')).toBe('• Salvar em ficha com PDF');
  });
});

describe('AssistantService (docs reais do repositório)', () => {
  const service = new AssistantService();

  it('responde com trecho e fonte quando a documentação cobre a pergunta', () => {
    const result = service.ask('Como ativo o modo escuro?', 'clinic');
    expect(result.covered).toBe(true);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].file).toBe('RELEASE_NOTES.md');
    expect(result.answer).toMatch(/modo escuro/i);
    expect(result.answer).not.toMatch(/Encontrei/i);
    expect(result.sources[0].excerpt).toBe(result.answer);
  });

  it('admite quando a documentação não cobre, sem fontes', () => {
    for (const question of ['O sistema emite nota fiscal eletrônica?', 'Qual a dose de botox recomendada?']) {
      const result = service.ask(question, 'clinic');
      expect(result.covered).toBe(false);
      expect(result.sources).toEqual([]);
      expect(result.answer).toMatch(/Feedback/);
    }
  });

  it('clínica não vê a documentação técnica; o painel da plataforma vê', () => {
    const question = 'O PrismaService filtra tenantId pelo TenantContext?';
    expect(service.ask(question, 'clinic').covered).toBe(false);
    const platform = service.ask(question, 'platform');
    expect(platform.covered).toBe(true);
    expect(platform.sources[0].file).toBe('AGENTS.md');
  });

  it('super-admin fora de clínica usa o corpus da plataforma; "entrando como" usa o da clínica', () => {
    const user = { isSuperAdmin: true, tenantId: null } as any;
    expect(AssistantService.audienceFor(user)).toBe('platform');
    expect(AssistantService.audienceFor({ ...user, tenantId: 't1' })).toBe('clinic');
    expect(AssistantService.audienceFor({ isSuperAdmin: false, tenantId: 't1' } as any)).toBe('clinic');
  });
});
