import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appointmentsApi } from '../../api/appointments';
import { availabilityApi } from '../../api/availability';
import { usersApi } from '../../api/users';
import type { Appointment } from '../../types';
import { useAgendaData } from './useAgendaData';
import { useElementWidth } from './useElementWidth';
import { useCalendarKeyboardScroll } from './useCalendarKeyboardScroll';
import {
  invalidateAppointmentListQueries,
  removeAppointmentFromCache,
  restoreAppointmentLists,
  snapshotAppointmentLists,
} from './appointmentCache';

vi.mock('../../api/appointments', () => ({ appointmentsApi: { list: vi.fn(), pending: vi.fn() } }));
vi.mock('../../api/availability', () => ({ availabilityApi: { listUnavailability: vi.fn() } }));
vi.mock('../../api/users', () => ({ usersApi: { listAppointmentProviders: vi.fn() } }));
const auth = vi.hoisted(() => ({
  user: { id: 'u1', name: 'Dra. Ana', permissions: [], restrictToOwnAppointments: false, providesAppointments: true } as Record<
    string,
    unknown
  >,
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const range = { from: '2030-01-14T00:00:00.000Z', to: '2030-01-21T00:00:00.000Z' };

const mk = (id: string, professionalId: string, over: Partial<Appointment> = {}) =>
  ({
    id,
    professionalId,
    kind: 'PROCEDURE',
    status: 'SCHEDULED',
    startAt: '2030-01-15T13:00:00.000Z',
    endAt: '2030-01-15T14:00:00.000Z',
    patient: { id: `pt-${id}`, name: `Paciente ${id}` },
    procedure: { id: 'pr', name: 'Peeling' },
    ...over,
  }) as unknown as Appointment;

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'u1', name: 'Dra. Ana', permissions: [], restrictToOwnAppointments: false, providesAppointments: true };
  mocked(appointmentsApi.list).mockResolvedValue([
    mk('a1', 'u1', { patientPackageId: 'pp', sessionIndex: 2, patientPackage: { sessionsTotal: 5 } } as Partial<Appointment>),
    mk('a2', 'u2', { kind: 'RETURN', status: 'CONFIRMED' }),
  ]);
  mocked(appointmentsApi.pending).mockResolvedValue([mk('p1', 'u1')]);
  mocked(usersApi.listAppointmentProviders).mockResolvedValue([
    { id: 'u1', name: 'Dra. Ana' },
    { id: 'u2', name: 'Dr. Bruno' },
  ]);
  mocked(availabilityApi.listUnavailability).mockImplementation(async (userId: string) =>
    userId === 'u2'
      ? [{ id: 'x1', userId, startAt: '2030-01-16T12:00:00.000Z', endAt: '2030-01-16T15:00:00.000Z', reason: 'Congresso' }]
      : [],
  );
});

describe('useAgendaData', () => {
  it('monta eventos de agendamentos (com tag, selo de sessão) e de bloqueios com o nome do profissional', async () => {
    const { result } = renderHook(() => useAgendaData(range, []), { wrapper: wrapper() });
    expect(result.current.appointmentsLoading).toBe(true);
    await waitFor(() => expect(result.current.events.some((e) => e.id === 'unavail-x1')).toBe(true));
    expect(appointmentsApi.list).toHaveBeenCalledWith(range.from, range.to);
    expect(result.current.appointmentsLoading).toBe(false);
    expect(result.current.pendingAppointments).toHaveLength(1);

    const a1 = result.current.events.find((e) => e.id === 'a1')!;
    expect(a1.title).toBe('[PROC] Paciente a1 · Peeling');
    expect((a1.extendedProps as { sessionLabel: string }).sessionLabel).toBe('Sessão 2/5');
    const a2 = result.current.events.find((e) => e.id === 'a2')!;
    expect(a2.title).toMatch(/^\[RET\] Paciente a2/);
    expect((a2.extendedProps as { sessionLabel: unknown }).sessionLabel).toBeNull();
    expect(result.current.events.find((e) => e.id === 'unavail-x1')!.title).toBe('Dr. Bruno: Congresso');
  });

  it('filtra por profissional', async () => {
    const { result } = renderHook(() => useAgendaData(range, ['u2']), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.events.some((e) => e.id === 'a2')).toBe(true));
    expect(result.current.events.some((e) => e.id === 'a1')).toBe(false);
  });

  it('agenda própria: só as indisponibilidades do usuário, sem listar profissionais, e bloqueia slots conflitantes', async () => {
    auth.user = { ...auth.user, restrictToOwnAppointments: true };
    mocked(availabilityApi.listUnavailability).mockResolvedValue([
      { id: 'own', userId: 'u1', startAt: '2030-01-17T12:00:00.000Z', endAt: '2030-01-17T13:00:00.000Z' },
    ]);
    const { result } = renderHook(() => useAgendaData(range, []), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.events.some((e) => e.id === 'unavail-own')).toBe(true));
    expect(usersApi.listAppointmentProviders).not.toHaveBeenCalled();
    expect(availabilityApi.listUnavailability).toHaveBeenCalledTimes(1);
    expect(availabilityApi.listUnavailability).toHaveBeenCalledWith('u1');
    expect(result.current.events.find((e) => e.id === 'unavail-own')!.title).toBe('Indisponível');

    const at = (h: number, m = 0) => new Date(Date.UTC(2030, 0, 15, h, m));
    expect(result.current.isSlotBlocked(at(13, 30), at(14, 30))).toBe(true); // sobrepõe a1 (13-14 UTC)
    expect(result.current.isSlotBlocked(at(14), at(15))).toBe(false);
    expect(result.current.isSlotBlocked(at(12, 30), at(13, 30))).toBe(true);
    expect(result.current.isSlotBlocked(new Date(Date.UTC(2030, 0, 17, 12, 30)), new Date(Date.UTC(2030, 0, 17, 13, 30)))).toBe(true);
  });

  it('agenda própria de quem não atende não consulta indisponibilidade', async () => {
    auth.user = { ...auth.user, restrictToOwnAppointments: true, providesAppointments: false };
    const { result } = renderHook(() => useAgendaData(range, []), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.appointmentsLoading).toBe(false));
    expect(availabilityApi.listUnavailability).not.toHaveBeenCalled();
  });
});

describe('appointmentCache', () => {
  it('remove da lista, restaura o snapshot e invalida só consultas de agenda', () => {
    const client = new QueryClient();
    client.setQueryData(['appointments', 'range', 'a', 'b'], [mk('a1', 'u1'), mk('a2', 'u1')]);
    client.setQueryData(['patients'], [{ id: 'keep' }]);
    const snap = snapshotAppointmentLists(client);
    expect(snap).toHaveLength(1);
    removeAppointmentFromCache(client, 'a1');
    expect((client.getQueryData(['appointments', 'range', 'a', 'b']) as Appointment[]).map((a) => a.id)).toEqual(['a2']);
    restoreAppointmentLists(client, snap);
    expect((client.getQueryData(['appointments', 'range', 'a', 'b']) as Appointment[]).map((a) => a.id)).toEqual(['a1', 'a2']);
    invalidateAppointmentListQueries(client);
    expect(client.getQueryState(['appointments', 'range', 'a', 'b'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['patients'])?.isInvalidated).toBe(false);
  });
});

describe('useElementWidth', () => {
  it('lê a largura do elemento e reage ao ResizeObserver', () => {
    let trigger: () => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          trigger = cb;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const el = document.createElement('div');
    let w = 400.4;
    el.getBoundingClientRect = () => ({ width: w }) as DOMRect;
    const { result, unmount } = renderHook(() => useElementWidth({ current: el }));
    expect(result.current).toBe(400);
    w = 812;
    act(() => trigger());
    expect(result.current).toBe(812);
    unmount();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('sem elemento fica em 0', () => {
    const { result } = renderHook(() => useElementWidth({ current: null }));
    expect(result.current).toBe(0);
  });
});

describe('useCalendarKeyboardScroll', () => {
  it('setas e PageDown rolam a grade ativa; outras teclas passam', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="fc-view-harness-active"><div class="fc-scroller"></div></div>';
    const scroller = root.querySelector('.fc-scroller') as HTMLElement;
    Object.defineProperty(scroller, 'clientHeight', { value: 400 });
    const ref = { current: { getApi: () => ({ el: root }) } } as never;
    const { result } = renderHook(() => useCalendarKeyboardScroll(ref));
    const press = (key: string) => {
      const preventDefault = vi.fn();
      result.current({ key, preventDefault } as unknown as React.KeyboardEvent);
      return preventDefault;
    };
    expect(press('ArrowDown')).toHaveBeenCalled();
    expect(scroller.scrollTop).toBe(56);
    press('PageDown');
    expect(scroller.scrollTop).toBe(56 + 340);
    press('ArrowUp');
    expect(scroller.scrollTop).toBe(340);
    expect(press('a')).not.toHaveBeenCalled();
    expect(scroller.scrollTop).toBe(340);
  });

  it('sem calendário apenas previne o scroll da página', () => {
    const { result } = renderHook(() => useCalendarKeyboardScroll({ current: null }));
    const preventDefault = vi.fn();
    result.current({ key: 'ArrowDown', preventDefault } as unknown as React.KeyboardEvent);
    expect(preventDefault).toHaveBeenCalled();
  });
});
