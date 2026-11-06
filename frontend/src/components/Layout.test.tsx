import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../types';
import { Layout } from './Layout';

vi.setConfig({ testTimeout: 30_000 });

const auth = vi.hoisted(() => ({
  user: null as Partial<User> | null,
  logout: vi.fn(),
  stopImpersonating: vi.fn(),
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../hooks/usePlatformCatalog', () => ({ usePrefetchPlatformCatalogs: vi.fn() }));
vi.mock('./assistant/AssistantFab', () => ({ AssistantFab: () => <span>assistente</span> }));
vi.mock('./notifications/NotificationsBell', () => ({ NotificationsBell: () => <span>sino</span> }));
vi.mock('../contexts/ColorModeContext', () => ({ useColorMode: () => ({ mode: 'light', toggleColorMode: vi.fn() }) }));
vi.mock('../contexts/AppointmentDialogContext', () => ({
  useAppointmentDialog: () => ({ openAppointmentDialog: vi.fn(), closeAppointmentDialog: vi.fn() }),
}));
vi.mock('./feedback/FeedbackReportDialog', () => ({ FeedbackReportDialog: () => null }));
vi.mock('./audit/AuditHistoryDialog', () => ({
  AuditHistoryDialog: ({ open, entity, title, onClose }: { open: boolean; entity: string; title: string; onClose: () => void }) =>
    open ? (
      <div role="dialog" aria-label="historico">
        historico:{entity}:{title}
        <button onClick={onClose}>fechar-historico</button>
      </div>
    ) : null,
}));
vi.mock('./tour/GuidedTour', () => ({
  GuidedTour: ({ steps, onClose }: { steps: unknown[]; onClose: () => void }) => (
    <div role="dialog" aria-label="tour">
      tour:{steps.length}
      <button onClick={onClose}>fechar-tour</button>
    </div>
  ),
}));

const admin: Partial<User> = {
  id: 'u1',
  name: 'Ana Admin',
  roleName: 'Administrador',
  tenantId: 't1',
  permissions: ['appointments:view', 'patients:view', 'finance:view', 'users:view', 'roles:view'],
  features: ['appointments', 'patients', 'finance'],
};

function renderAt(path: string) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<p>conteúdo da página</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const navItem = (name: string) => screen.queryAllByRole('button', { name })[0];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  auth.user = admin;
});

describe('Layout', () => {
  it('mostra título da página, subtítulo e o conteúdo da rota', () => {
    renderAt('/agenda');
    expect(screen.getByRole('heading', { level: 1, name: 'Agenda' })).toBeInTheDocument();
    expect(screen.getByText('Agendamentos e horários')).toBeInTheDocument();
    expect(screen.getByText('conteúdo da página')).toBeInTheDocument();
    expect(screen.getByText('assistente')).toBeInTheDocument();
  });

  it('filtra o menu por permissão, plano (features) e perfil de administrador', () => {
    auth.user = { ...admin, roleName: 'Recepção', permissions: ['appointments:view', 'patients:view'], features: ['appointments'] };
    renderAt('/');
    expect(navItem('Dashboard')).toBeDefined();
    expect(navItem('Agenda')).toBeDefined();
    // sem a feature "patients" no plano
    expect(navItem('Pacientes')).toBeUndefined();
    // sem permissão
    expect(navItem('Financeiro')).toBeUndefined();
    expect(navItem('Usuários')).toBeUndefined();
    // só admin
    expect(navItem('Anamnese')).toBeUndefined();
    expect(navItem('Meu plano')).toBeUndefined();
    // sem itens no grupo, título some
    expect(screen.queryByText('Financeiro', { selector: 'span' })).not.toBeInTheDocument();
  });

  it('administrador vê itens exclusivos e grupos com itens', () => {
    renderAt('/');
    expect(navItem('Anamnese')).toBeDefined();
    expect(navItem('Meu plano')).toBeDefined();
    expect(navItem('Financeiro')).toBeDefined();
    expect(navItem('Grupos')).toBeDefined();
  });

  it('navega ao clicar num item do menu', async () => {
    renderAt('/');
    await userEvent.click(navItem('Pacientes'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Pacientes' })).toBeInTheDocument();
  });

  it('sair chama logout', async () => {
    renderAt('/');
    await userEvent.click(screen.getAllByRole('button', { name: 'Menu do usuário' })[0]);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }));
    expect(auth.logout).toHaveBeenCalled();
  });

  it('recolhe e expande o menu', async () => {
    renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'Recolher menu' }));
    expect(screen.getByRole('button', { name: 'Expandir menu' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Expandir menu' }));
    expect(screen.getByRole('button', { name: 'Recolher menu' })).toBeInTheDocument();
  });

  it('abre e fecha o menu móvel', async () => {
    renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    // O Drawer modal marca o resto da página como aria-hidden.
    const close = screen.getByRole('button', { name: 'Fechar menu', hidden: true });
    await userEvent.click(close);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeInTheDocument());
  });

  it('não mostra faixa de impersonação para usuário normal', () => {
    renderAt('/');
    expect(screen.queryByText(/Você está visualizando como/)).not.toBeInTheDocument();
  });

  it('impersonação de usuário: faixa com o nome e botão padrão', async () => {
    auth.user = { ...admin, impersonating: true };
    renderAt('/');
    expect(screen.getByText('Você está visualizando como Ana Admin')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar à minha conta' }));
    expect(auth.stopImpersonating).toHaveBeenCalled();
  });

  it('super-admin dentro de uma clínica: faixa com o nome da clínica', () => {
    auth.user = { ...admin, impersonating: true, tenantName: 'Clínica Aurora' };
    renderAt('/');
    expect(screen.getByText('Você está visualizando como Clínica Aurora')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar ao Console' })).toBeInTheDocument();
  });

  it('histórico: abre com a entidade da tela só para admin e fecha', async () => {
    renderAt('/pacientes');
    await userEvent.click(screen.getByRole('button', { name: 'Histórico de alterações' }));
    expect(screen.getByRole('dialog', { name: 'historico' })).toHaveTextContent('historico:Patient:Pacientes');
    await userEvent.click(screen.getByText('fechar-historico'));
    expect(screen.queryByRole('dialog', { name: 'historico' })).not.toBeInTheDocument();
  });

  it('histórico some para quem não é administrador e fica desabilitado em telas sem entidade', () => {
    const { unmount } = renderAt('/horarios');
    expect(screen.getByRole('button', { name: 'Histórico de alterações' })).toBeDisabled();
    unmount();
    auth.user = { ...admin, roleName: 'Recepção' };
    renderAt('/pacientes');
    expect(screen.queryByRole('button', { name: 'Histórico de alterações' })).not.toBeInTheDocument();
  });

  it('botão de novo agendamento depende da permissão appointments:view', () => {
    const { unmount } = renderAt('/');
    expect(screen.getByRole('button', { name: /Novo agendamento/ })).toBeInTheDocument();
    unmount();
    auth.user = { ...admin, permissions: [] };
    renderAt('/');
    expect(screen.queryByRole('button', { name: /Novo agendamento/ })).not.toBeInTheDocument();
  });

  it('alternar valores persiste a preferência e remonta a página', async () => {
    renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar valores' }));
    expect(localStorage.getItem('mila.hideMoney')).toBe('1');
    expect(screen.getByRole('button', { name: 'Mostrar valores' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar valores' }));
    expect(localStorage.getItem('mila.hideMoney')).toBe('0');
  });
});

describe('Layout — tour guiado', () => {
  it('abre sozinho na primeira visita e marca como visto ao fechar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderAt('/agenda');
      expect(screen.queryByRole('dialog', { name: 'tour' })).not.toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(900);
      });
      const dlg = screen.getByRole('dialog', { name: 'tour' });
      expect(dlg).toHaveTextContent(/tour:\d+/);
      await userEvent.click(within(dlg).getByText('fechar-tour'), { advanceTimers: vi.advanceTimersByTime } as never);
      expect(localStorage.getItem('mila.tourSeen.u1.agenda')).not.toBeNull();
      expect(screen.queryByRole('dialog', { name: 'tour' })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('não abre sozinho se já foi visto, mas o botão "Como funciona?" reabre', async () => {
    localStorage.setItem('mila.tourSeen.u1.agenda', '2026-01-01T00:00:00.000Z');
    renderAt('/agenda');
    await new Promise((r) => setTimeout(r, 1000));
    expect(screen.queryByRole('dialog', { name: 'tour' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Como funciona/ }));
    expect(screen.getByRole('dialog', { name: 'tour' })).toBeInTheDocument();
  });

  it('telas sem tour não têm botão "Como funciona?"', () => {
    renderAt('/grupos');
    expect(screen.queryByRole('button', { name: /Como funciona/ })).not.toBeInTheDocument();
  });

  it('sem usuário logado o tour não abre sozinho', async () => {
    auth.user = null;
    renderAt('/agenda');
    await new Promise((r) => setTimeout(r, 1000));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'tour' })).not.toBeInTheDocument());
  });
});
