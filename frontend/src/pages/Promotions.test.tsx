import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { promotionsApi } from '../api/promotions';
import type { Promotion } from '../types';
import { Promotions } from './Promotions';

vi.mock('../api/promotions', () => ({ promotionsApi: { list: vi.fn(), remove: vi.fn(), update: vi.fn() } }));
vi.mock('../components/promotions/PromotionFormDialog', () => ({
  PromotionFormDialog: ({ open, editing, initialCommemorativeDate }: { open: boolean; editing?: Promotion | null; initialCommemorativeDate?: string }) =>
    open ? (
      <div role="dialog" aria-label="form">
        {editing ? `Editar ${editing.name}` : `Nova promoção ${initialCommemorativeDate ?? ''}`.trim()}
      </div>
    ) : null,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 'u', name: 'Ana', permissions: [] as string[] } }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialogs }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;
const ALL = ['promotions:create', 'promotions:edit', 'promotions:delete'];

const mk = (id: string, extra: Partial<Promotion>): Promotion => ({
  id,
  name: id,
  startAt: '2026-03-10T12:00:00Z',
  endAt: '2026-03-20T12:00:00Z',
  discountType: 'PERCENTAGE',
  discountValue: 10,
  active: true,
  ...extra,
});

const promos: Promotion[] = [
  mk('Dia das Mães', { description: 'Campanha de maio', discountValue: 15, _count: { appointments: 4 } }),
  mk('Black Friday', { discountType: 'FIXED', discountValue: '50.5', startAt: '2026-04-01T12:00:00Z', endAt: '2026-04-05T12:00:00Z', commemorativeDate: 'Sexta de ofertas', _count: { appointments: 1 } }),
  mk('Combo Verão', { discountType: 'COMBO', discountValue: 300, startAt: '2026-01-01T12:00:00Z', endAt: '2026-02-01T12:00:00Z' }),
  mk('Combo Livre', { discountType: 'COMBO', discountValue: 0, active: false }),
  mk('Fixo Inteiro', { discountType: 'FIXED', discountValue: 100 }),
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Promotions />
      </BrowserRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

const cardOf = (name: string) => screen.getByText(name).closest('.MuiCard-root') as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-15T15:00:00Z'));
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/promocoes');
  auth.user.permissions = ALL;
  mocked(promotionsApi.list).mockResolvedValue(promos);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Promotions', () => {
  it('mostra contagem e status de cada campanha conforme a data atual', async () => {
    renderPage();
    await screen.findByText('Dia das Mães');
    expect(screen.getByText(/^\s*campanhas\s+·\s+ativas no momento/)).toBeInTheDocument();
    expect(within(cardOf('Dia das Mães')).getByText('Ativa')).toBeInTheDocument();
    expect(within(cardOf('Black Friday')).getByText('Agendada')).toBeInTheDocument();
    expect(within(cardOf('Combo Verão')).getByText('Encerrada')).toBeInTheDocument();
    expect(within(cardOf('Combo Livre')).getByText('Inativa')).toBeInTheDocument();
  });

  it('formata o selo de desconto por tipo', async () => {
    renderPage();
    await screen.findByText('Dia das Mães');
    expect(within(cardOf('Dia das Mães')).getByText('−15%')).toBeInTheDocument();
    expect(within(cardOf('Black Friday')).getByText('R$ 50.50')).toBeInTheDocument();
    expect(within(cardOf('Combo Verão')).getByText('Combo R$ 300')).toBeInTheDocument();
    expect(within(cardOf('Combo Livre')).getByText('Combo')).toBeInTheDocument();
    expect(within(cardOf('Fixo Inteiro')).getByText('R$ 100')).toBeInTheDocument();
  });

  it('mostra usos, descrição ou data comemorativa', async () => {
    renderPage();
    await screen.findByText('Dia das Mães');
    expect(within(cardOf('Dia das Mães')).getByText('4 usos')).toBeInTheDocument();
    expect(within(cardOf('Black Friday')).getByText('1 uso')).toBeInTheDocument();
    expect(within(cardOf('Dia das Mães')).getByText('Campanha de maio')).toBeInTheDocument();
    expect(within(cardOf('Black Friday')).getByText('Sexta de ofertas')).toBeInTheDocument();
    expect(within(cardOf('Fixo Inteiro')).getByText('0 usos')).toBeInTheDocument();
    expect(within(cardOf('Fixo Inteiro')).getByText('—')).toBeInTheDocument();
  });

  it('filtra por busca no nome, descrição e data comemorativa', async () => {
    renderPage();
    await screen.findByText('Dia das Mães');
    const search = screen.getByRole('textbox', { name: 'Buscar campanha' });
    await userEvent.type(search, 'maio');
    expect(screen.getByText('Dia das Mães')).toBeInTheDocument();
    expect(screen.queryByText('Black Friday')).not.toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'sexta');
    expect(screen.getByText('Black Friday')).toBeInTheDocument();
    expect(screen.queryByText('Dia das Mães')).not.toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'zzz');
    expect(screen.getByText('Nenhuma promoção encontrada')).toBeInTheDocument();
    expect(screen.getByText('Tente ajustar a busca.')).toBeInTheDocument();
  });

  it('estado vazio sem campanhas', async () => {
    mocked(promotionsApi.list).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Nenhuma promoção cadastrada')).toBeInTheDocument();
  });

  it('alterna ativação com update e invalida a lista; erro vira toast', async () => {
    mocked(promotionsApi.update).mockResolvedValueOnce({}).mockRejectedValueOnce({ response: { data: { message: 'Falhou' } } });
    const { invalidate } = renderPage();
    await screen.findByText('Dia das Mães');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Desativar Dia das Mães' }));
    await waitFor(() => expect(promotionsApi.update).toHaveBeenCalledWith('Dia das Mães', { active: false }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['promotions'] }));

    await userEvent.click(screen.getByRole('checkbox', { name: 'Ativar Combo Livre' }));
    await waitFor(() => expect(promotionsApi.update).toHaveBeenCalledWith('Combo Livre', { active: true }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Falhou'));
  });

  it('exclui após confirmar e não exclui se cancelar', async () => {
    mocked(promotionsApi.remove).mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('Dia das Mães');
    mocked(dialogs.confirm).mockResolvedValueOnce(false);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Combo Livre' }));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalledTimes(1));
    expect(promotionsApi.remove).not.toHaveBeenCalled();

    mocked(dialogs.confirm).mockResolvedValueOnce(true);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Combo Livre' }));
    expect(dialogs.confirm).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'Excluir a promoção "Combo Livre"?' }));
    await waitFor(() => expect(promotionsApi.remove).toHaveBeenCalledWith('Combo Livre'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Promoção excluída.'));
  });

  it('erro ao excluir mostra a mensagem da API', async () => {
    mocked(dialogs.confirm).mockResolvedValue(true);
    mocked(promotionsApi.remove).mockRejectedValue({ response: { data: { message: 'Promoção em uso' } } });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Combo Livre' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Promoção em uso'));
  });

  it('abre o formulário para criar e editar', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Nova promoção' }));
    expect(screen.getByRole('dialog', { name: 'form' })).toHaveTextContent('Nova promoção');
    await userEvent.click(screen.getByRole('button', { name: 'Editar Black Friday' }));
    expect(screen.getByRole('dialog', { name: 'form' })).toHaveTextContent('Editar Black Friday');
  });

  it('abre o formulário com a data comemorativa vinda da URL e limpa o parâmetro', async () => {
    window.history.replaceState({}, '', '/promocoes?data=Dia%20dos%20Namorados');
    renderPage();
    expect(await screen.findByRole('dialog', { name: 'form' })).toHaveTextContent('Nova promoção Dia dos Namorados');
    await waitFor(() => expect(window.location.search).toBe(''));
  });

  it('sem permissão de criar a URL com data não abre o formulário', async () => {
    auth.user.permissions = [];
    window.history.replaceState({}, '', '/promocoes?data=Natal');
    renderPage();
    await screen.findByText('Dia das Mães');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('esconde ações sem permissão', async () => {
    auth.user.permissions = [];
    renderPage();
    await screen.findByText('Dia das Mães');
    expect(screen.queryByRole('button', { name: 'Nova promoção' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('pagina de 8 em 8', async () => {
    mocked(promotionsApi.list).mockResolvedValue(Array.from({ length: 10 }, (_, i) => mk(`Promo ${String(i + 1).padStart(2, '0')}`, {})));
    renderPage();
    await screen.findByText('Promo 01');
    expect(screen.queryByText('Promo 09')).not.toBeInTheDocument();
    expect(screen.getByText(/Mostrando 1–8 de 10/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(screen.getByText('Promo 09')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 9–10 de 10/)).toBeInTheDocument();
  });
});
