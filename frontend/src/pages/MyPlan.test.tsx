import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tenantPlanApi, type TenantPlanSummary } from '../api/tenantPlan';
import { MyPlan } from './MyPlan';

vi.mock('../api/tenantPlan', () => ({ tenantPlanApi: { getSummary: vi.fn() } }));
vi.mock('../components/feedback/FeedbackReportDialog', () => ({
  FeedbackReportDialog: ({ open, initial }: { open: boolean; initial?: { type: string; title: string; description: string } }) =>
    open ? (
      <div role="dialog" aria-label="feedback">
        <p>{initial?.type}</p>
        <p>{initial?.title}</p>
        <pre>{initial?.description}</pre>
      </div>
    ) : null,
}));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;
const GB = 1024 ** 3;

const summary: TenantPlanSummary = {
  plan: {
    id: 'pl1',
    name: 'Profissional',
    slug: 'pro',
    description: 'Para clínicas em crescimento',
    priceCents: 19900,
    currency: 'BRL',
    limits: { maxUsers: 5, maxPatients: 1000, storageGb: 2 } as never,
  },
  usage: { activeUsers: 5, patients: 250, storageBytes: 1 * GB, files: 1234 },
  features: ['patients', 'packages', 'custom_thing'],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MyPlan />
    </QueryClientProvider>,
  );
}


beforeEach(() => {
  vi.clearAllMocks();
  mocked(tenantPlanApi.getSummary).mockResolvedValue(summary);
});

describe('MyPlan', () => {
  it('mostra o plano com preço e descrição', async () => {
    renderPage();
    expect(await screen.findByText('Profissional')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*199,00 · Para clínicas em crescimento/)).toBeInTheDocument();
  });

  it('mostra uso versus limites e barra de progresso proporcional', async () => {
    renderPage();
    await screen.findByText('Profissional');
    expect(screen.getByText('5 / 5')).toBeInTheDocument();
    expect(screen.getByText('250 / 1.000')).toBeInTheDocument();
    expect(screen.getByText('1 GB / 2 GB')).toBeInTheDocument();
    const bars = screen.getAllByRole('progressbar');
    expect(bars.map((b) => b.getAttribute('aria-valuenow'))).toEqual(['100', '25', '50']);
    expect(screen.getByText(/1\.234 arquivo\(s\) contabilizados/)).toBeInTheDocument();
  });

  it('limites ausentes aparecem como ilimitado e sem barra', async () => {
    mocked(tenantPlanApi.getSummary).mockResolvedValue({
      ...summary,
      plan: { ...summary.plan!, limits: null },
    });
    renderPage();
    await screen.findByText('Profissional');
    expect(screen.getAllByText(/· ilimitado/)).toHaveLength(3);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('lista módulos ativos com rótulo amigável e mantém códigos desconhecidos', async () => {
    renderPage();
    expect(await screen.findByText('Módulos ativos')).toBeInTheDocument();
    expect(screen.getByText('Pacientes')).toBeInTheDocument();
    expect(screen.getByText('Pacotes')).toBeInTheDocument();
    expect(screen.getByText('custom_thing')).toBeInTheDocument();
  });

  it('sem módulos não mostra a seção', async () => {
    mocked(tenantPlanApi.getSummary).mockResolvedValue({ ...summary, features: [] });
    renderPage();
    await screen.findByText('Profissional');
    expect(screen.queryByText('Módulos ativos')).not.toBeInTheDocument();
  });

  it('clínica sem plano nomeado mostra o plano personalizado', async () => {
    mocked(tenantPlanApi.getSummary).mockResolvedValue({ ...summary, plan: null, features: [] });
    renderPage();
    expect(await screen.findByText('Plano personalizado')).toBeInTheDocument();
    expect(screen.getByText(/configuração legada/)).toBeInTheDocument();
    expect(screen.getAllByText(/· ilimitado/)).toHaveLength(3);
  });

  it('plano sem preço mostra "Sem preço"', async () => {
    mocked(tenantPlanApi.getSummary).mockResolvedValue({ ...summary, plan: { ...summary.plan!, priceCents: null, description: null } });
    renderPage();
    expect(await screen.findByText('Sem preço')).toBeInTheDocument();
  });

  it('mostra esqueletos enquanto carrega e erro da API quando falha', async () => {
    mocked(tenantPlanApi.getSummary).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Plano atual')).toBeInTheDocument();
    expect(screen.queryByText('Profissional')).not.toBeInTheDocument();
  });

  it('erro ao carregar exibe a mensagem', async () => {
    mocked(tenantPlanApi.getSummary).mockRejectedValue({ response: { data: { message: 'Sem acesso ao plano' } } });
    renderPage();
    expect(await screen.findByText('Sem acesso ao plano')).toBeInTheDocument();
  });

  it('solicitar upgrade abre o feedback preenchido com plano e uso atuais', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Solicitar upgrade' }));
    const dialog = await screen.findByRole('dialog', { name: 'feedback' });
    expect(dialog).toHaveTextContent('SUGGESTION');
    expect(dialog).toHaveTextContent('Solicitação de upgrade de plano');
    expect(dialog).toHaveTextContent('Plano atual: Profissional');
    expect(dialog).toHaveTextContent('Uso atual: 5 usuário(s) ativo(s), 250 paciente(s), 1 GB em arquivos.');
  });
});
