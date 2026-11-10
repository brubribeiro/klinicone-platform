import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAppTheme } from '../../theme';
import type { User } from '../../types';
import { drawerTransition } from './layoutTheme';
import { HeaderActions } from './HeaderActions';
import { ImpersonationBanner } from './ImpersonationBanner';
import { isNavPathActive, NAV_GROUPS } from './navConfig';
import { getPageMeta, pageSubtitleFor } from './pageMeta';
import { SidebarContent } from './SidebarContent';

vi.setConfig({ testTimeout: 30_000 });

const colorMode = vi.hoisted(() => ({ mode: 'light' as 'light' | 'dark', toggleColorMode: vi.fn() }));
vi.mock('../../contexts/ColorModeContext', () => ({ useColorMode: () => colorMode }));
const apptDialog = vi.hoisted(() => ({ openAppointmentDialog: vi.fn(), closeAppointmentDialog: vi.fn() }));
vi.mock('../../contexts/AppointmentDialogContext', () => ({ useAppointmentDialog: () => apptDialog }));
vi.mock('../notifications/NotificationsBell', () => ({ NotificationsBell: () => <span>sino</span> }));
vi.mock('../feedback/FeedbackReportDialog', () => ({
  FeedbackReportDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog">feedback-aberto</div> : null),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('navConfig', () => {
  it('isNavPathActive: raiz só casa exata, demais por prefixo', () => {
    expect(isNavPathActive('/', '/')).toBe(true);
    expect(isNavPathActive('/agenda', '/')).toBe(false);
    expect(isNavPathActive('/pacientes/123', '/pacientes')).toBe(true);
    expect(isNavPathActive('/agenda', '/pacientes')).toBe(false);
  });

  it('caminhos de navegação são únicos', () => {
    const paths = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.path));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('itens só do admin: anamnese e meu plano', () => {
    const adminOnly = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.adminOnly).map((i) => i.path);
    expect(adminOnly.sort()).toEqual(['/meu-plano', '/perguntas-anamnese']);
  });
});

describe('pageMeta', () => {
  it('encontra pelo caminho exato, por prefixo e cai no padrão', () => {
    expect(getPageMeta('/').title).toBe('Dashboard');
    expect(getPageMeta('/pacientes').auditEntity).toBe('Patient');
    expect(getPageMeta('/pacientes/abc').title).toBe('Pacientes');
    expect(getPageMeta('/pacientes-x').title).toBe('KlinicOne');
    expect(getPageMeta('/desconhecida')).toEqual({ title: 'KlinicOne', subtitle: '' });
  });

  it('só o Dashboard ganha a data de hoje no subtítulo', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T15:00:00.000Z'));
    try {
      expect(pageSubtitleFor('/', getPageMeta('/'))).toBe('Visão geral da clínica · Hoje, 10 de março');
      expect(pageSubtitleFor('/agenda', getPageMeta('/agenda'))).toBe('Agendamentos e horários');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('layoutTheme', () => {
  it('drawerTransition cria transição para as propriedades pedidas', () => {
    const t = createAppTheme('light');
    expect(drawerTransition(t, 'width')).toContain('width');
    expect(drawerTransition(t, ['opacity', 'padding'])).toMatch(/opacity.*padding/);
  });
});

describe('ImpersonationBanner', () => {
  it('mostra o nome, o rótulo padrão e chama onStop', async () => {
    const onStop = vi.fn();
    render(<ThemeProvider theme={createAppTheme('light')}><ImpersonationBanner userName="Ana" onStop={onStop} /></ThemeProvider>);
    expect(screen.getByText('Você está visualizando como Ana')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar à minha conta' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('aceita rótulo personalizado', () => {
    render(<ThemeProvider theme={createAppTheme('light')}><ImpersonationBanner userName="Clínica X" onStop={() => {}} stopLabel="Voltar ao painel" /></ThemeProvider>);
    expect(screen.getByRole('button', { name: 'Voltar ao painel' })).toBeInTheDocument();
  });
});

describe('HeaderActions', () => {
  const base = {
    canSeeHistory: true,
    hasAuditEntity: true,
    onOpenHistory: vi.fn(),
    moneyHidden: false,
    onToggleMoneyHidden: vi.fn(),
    canSeeAgenda: true,
  };
  const renderIt = (p: Partial<React.ComponentProps<typeof HeaderActions>> = {}) =>
    render(<ThemeProvider theme={createAppTheme('light')}><HeaderActions {...base} {...p} /></ThemeProvider>);

  it('ações principais disparam seus callbacks', async () => {
    const onOpenTour = vi.fn();
    const props = { ...base, onOpenHistory: vi.fn(), onToggleMoneyHidden: vi.fn() };
    renderIt({ ...props, onOpenTour });
    await userEvent.click(screen.getByRole('button', { name: /Como funciona/ }));
    expect(onOpenTour).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Alternar tema' }));
    expect(colorMode.toggleColorMode).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Histórico de alterações' }));
    expect(props.onOpenHistory).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar valores' }));
    expect(props.onToggleMoneyHidden).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Novo agendamento/ }));
    expect(apptDialog.openAppointmentDialog).toHaveBeenCalledWith();
    expect(screen.getByText('sino')).toBeInTheDocument();
  });

  it('sem tour, sem permissão de histórico e sem agenda esconde os botões', () => {
    renderIt({ canSeeHistory: false, canSeeAgenda: false });
    expect(screen.queryByRole('button', { name: /Como funciona/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Histórico de alterações' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Novo agendamento/ })).not.toBeInTheDocument();
  });

  it('histórico fica desabilitado quando a tela não tem entidade de auditoria', () => {
    renderIt({ hasAuditEntity: false });
    expect(screen.getByRole('button', { name: 'Histórico de alterações' })).toBeDisabled();
  });

  it('valores ocultos: rótulo e aria-pressed refletem o estado', () => {
    renderIt({ moneyHidden: true });
    expect(screen.getByRole('button', { name: 'Mostrar valores' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('HeaderActions (modo escuro)', () => {
  afterEach(() => {
    colorMode.mode = 'light';
  });
  it('mostra "Tema claro" no escuro', () => {
    colorMode.mode = 'dark';
    render(
      <ThemeProvider theme={createAppTheme('dark')}>
        <HeaderActions canSeeHistory={false} hasAuditEntity={false} onOpenHistory={() => {}} moneyHidden={false} onToggleMoneyHidden={() => {}} canSeeAgenda={false} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Alternar tema' })).toBeInTheDocument();
  });
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

describe('SidebarContent', () => {
  const groups = NAV_GROUPS.slice(0, 2);
  const user = { id: 'u1', name: 'Ana Maria Souza', roleName: 'Recepção' } as User;
  const renderIt = (p: Partial<React.ComponentProps<typeof SidebarContent>> = {}) => {
    const props = { collapsed: false, groups, pathname: '/agenda', onNavigate: vi.fn(), user, onLogout: vi.fn(), ...p };
    render(
      <ThemeProvider theme={createAppTheme('light')}>
        <MemoryRouter>
          <Routes>
            <Route path="*" element={<><SidebarContent {...props} /><Where /></>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    return props;
  };

  it('lista grupos e itens, marca o ativo e navega ao clicar', async () => {
    const props = renderIt();
    expect(screen.getByText('Principal')).toBeInTheDocument();
    expect(screen.getByText('Catálogo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agenda' })).toHaveClass('Mui-selected');
    expect(screen.getByRole('button', { name: 'Pacientes' })).not.toHaveClass('Mui-selected');
    await userEvent.click(screen.getByRole('button', { name: 'Pacientes' }));
    expect(props.onNavigate).toHaveBeenCalledWith('/pacientes');
  });

  it('mostra nome e grupo do usuário e iniciais no avatar', () => {
    renderIt();
    expect(screen.getByText('Ana Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('Recepção')).toBeInTheDocument();
    expect(screen.getByText('AM')).toBeInTheDocument();
  });

  it('sem usuário mostra "Usuário" e "?"', () => {
    renderIt({ user: null });
    expect(screen.getByText('Usuário')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('menu do usuário: sair chama onLogout', async () => {
    const props = renderIt();
    await userEvent.click(screen.getAllByRole('button', { name: 'Menu do usuário' })[0]);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }));
    expect(props.onLogout).toHaveBeenCalled();
  });

  it('menu do usuário: abre o feedback', async () => {
    renderIt();
    await userEvent.click(screen.getAllByRole('button', { name: 'Menu do usuário' })[0]);
    await userEvent.click(await screen.findByRole('menuitem', { name: /Reportar bug/ }));
    expect(await screen.findByText('feedback-aberto')).toBeInTheDocument();
  });

  it('"Trocar painel" só aparece com canChoosePanel e navega', async () => {
    renderIt({ user: { ...user, canChoosePanel: true } as User });
    await userEvent.click(screen.getAllByRole('button', { name: 'Menu do usuário' })[0]);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Trocar painel' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/escolher-painel');
  });

  it('sem canChoosePanel não oferece trocar painel', async () => {
    renderIt();
    await userEvent.click(screen.getAllByRole('button', { name: 'Menu do usuário' })[0]);
    await screen.findByRole('menuitem', { name: 'Sair' });
    expect(screen.queryByRole('menuitem', { name: 'Trocar painel' })).not.toBeInTheDocument();
  });

  it('recolhido: esconde a marca, avatar abre o menu', async () => {
    const props = renderIt({ collapsed: true });
    expect(screen.queryByText('Gestão para clínicas')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Menu do usuário'));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }));
    expect(props.onLogout).toHaveBeenCalled();
  });
});
