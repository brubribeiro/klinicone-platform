import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usersApi } from '../api/users';
import type { UserSummary } from '../types';
import { Professionals } from './Professionals';

vi.mock('../api/users', () => ({ usersApi: { list: vi.fn() } }));
vi.mock('../components/users/UserFormDialog', () => ({
  UserFormDialog: ({ open, user, presetProfessional }: { open: boolean; user?: UserSummary | null; presetProfessional?: boolean }) =>
    open ? <div role="dialog" aria-label="form">{`novo=${!user} profissional=${!!presetProfessional}`}</div> : null,
}));

const auth = vi.hoisted(() => ({ user: { id: 'me', name: 'Ana', permissions: [] as string[] } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const mk = (id: string, extra: Partial<UserSummary>): UserSummary => ({
  id,
  name: id,
  email: `${id}@c.com`,
  active: true,
  providesAppointments: true,
  roleId: 'r',
  role: { id: 'r', name: 'Profissional', isSystem: false },
  createdAt: '2026-01-01T00:00:00Z',
  ...extra,
});

const users: UserSummary[] = [
  mk('Dra. Larissa Nunes', {
    specialty: 'Dermatologista',
    specialties: ['Toxina', 'Laser'],
    councilRegister: 'CRM-SP 123',
    isPrimary: true,
    availability: 'AVAILABLE',
    calendarColor: '#D46B8A',
    appointmentsCount: 120,
    appointmentsCountMonth: 14,
    appointmentsCountWeek: 3,
  }),
  mk('Bruno Alves', { availability: 'IN_SERVICE', active: false, role: { id: 'r', name: 'Esteta', isSystem: false } }),
  mk('Carla Dias', { availability: 'OFF' }),
  mk('Davi Rocha', { availability: 'OUTSIDE_HOURS' }),
  mk('Recepcionista', { providesAppointments: false }),
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Professionals />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user.permissions = ['users:create'];
  mocked(usersApi.list).mockResolvedValue(users);
});

describe('Professionals', () => {
  it('lista só profissionais com função, registro, especialidades, status e contadores', async () => {
    renderPage();
    const card = (await screen.findByText('Dra. Larissa Nunes')).closest('.MuiCard-root') as HTMLElement;
    expect(screen.queryByText('Recepcionista')).not.toBeInTheDocument();
    expect(screen.getByText(/^\s*profissionais\s+·\s+disponível agora/)).toBeInTheDocument();

    expect(within(card).getByText('LN')).toBeInTheDocument();
    expect(within(card).getByText('Dermatologista')).toBeInTheDocument();
    expect(within(card).getByText('CRM-SP 123')).toBeInTheDocument();
    expect(within(card).getByText('Toxina')).toBeInTheDocument();
    expect(within(card).getByText('Laser')).toBeInTheDocument();
    expect(within(card).getByText('Disponível')).toBeInTheDocument();
    expect(within(card).getByText('120')).toBeInTheDocument();
    expect(within(card).getByText('14')).toBeInTheDocument();
    expect(within(card).getByText('3')).toBeInTheDocument();

    expect(screen.getByText('Em atendimento')).toBeInTheDocument();
    expect(screen.getByText('Folga')).toBeInTheDocument();
    expect(screen.getByText('Fora do horário')).toBeInTheDocument();
    // sem função: usa o nome do grupo
    expect(screen.getByText('Esteta')).toBeInTheDocument();
  });

  it('filtra por nome, especialidade e grupo', async () => {
    renderPage();
    await screen.findByText('Bruno Alves');
    const search = screen.getByPlaceholderText('Buscar profissional...');
    await userEvent.type(search, 'laser');
    expect(screen.getByText('Dra. Larissa Nunes')).toBeInTheDocument();
    expect(screen.queryByText('Bruno Alves')).not.toBeInTheDocument();
    expect(screen.getByText(/^\s*profissional\s+·\s+disponível agora/)).toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, 'esteta');
    expect(screen.getByText('Bruno Alves')).toBeInTheDocument();
    expect(screen.queryByText('Carla Dias')).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, 'derma');
    expect(screen.getByText('Dra. Larissa Nunes')).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'carla');
    expect(screen.getByText('Carla Dias')).toBeInTheDocument();
    expect(screen.getByText(/^\s*profissional\s+·\s+disponíveis agora/)).toBeInTheDocument();
  });

  it('mostra estado vazio quando nada confere', async () => {
    renderPage();
    await screen.findByText('Bruno Alves');
    await userEvent.type(screen.getByPlaceholderText('Buscar profissional...'), 'xyz');
    expect(screen.getByText('Nenhum profissional')).toBeInTheDocument();
  });

  it('abre o cadastro como profissional para quem pode criar usuários', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar profissional' }));
    expect(screen.getByRole('dialog', { name: 'form' })).toHaveTextContent('novo=true profissional=true');
  });

  it('esconde o botão sem permissão', async () => {
    auth.user.permissions = [];
    renderPage();
    await screen.findByText('Bruno Alves');
    expect(screen.queryByRole('button', { name: 'Adicionar profissional' })).not.toBeInTheDocument();
  });

  it('iniciais: ignora título e usa "?" para nome vazio', async () => {
    mocked(usersApi.list).mockResolvedValue([mk('a', { name: 'Dr. João Pedro Silva' }), mk('b', { name: '   ' })]);
    renderPage();
    expect(await screen.findByText('JS')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
