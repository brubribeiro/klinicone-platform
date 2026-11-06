import { forwardRef, useImperativeHandle } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Appointment } from '../types';
import { Appointments } from './Appointments';

const cal = vi.hoisted(() => ({
  props: {} as Record<string, any>,
  api: { prev: vi.fn(), next: vi.fn(), today: vi.fn(), changeView: vi.fn(), getDate: () => new Date(2030, 0, 15) },
}));
vi.mock('@fullcalendar/react', () => ({
  default: forwardRef((props: Record<string, any>, ref) => {
    cal.props = props;
    useImperativeHandle(ref, () => ({ getApi: () => cal.api }));
    return <div data-testid="calendar" />;
  }),
}));

const agenda = vi.hoisted(() => ({
  calls: [] as unknown[],
  value: {
    appointmentsLoading: false,
    pendingAppointments: [] as unknown[],
    events: [] as unknown[],
    isSlotBlocked: vi.fn(() => false),
  } as Record<string, unknown>,
}));
vi.mock('../components/appointments/useAgendaData', () => ({
  useAgendaData: (range: unknown, ids: string[]) => {
    agenda.calls.push({ range, ids });
    return agenda.value;
  },
}));

const perms = vi.hoisted(() => ({ has: vi.fn(), restrictToOwnAppointments: false }));
vi.mock('../contexts/usePermissions', () => ({ usePermissions: () => perms }));

vi.mock('../components/appointments/AppointmentFormDialog', () => ({
  AppointmentFormDialog: (p: {
    open: boolean;
    appointment?: Appointment | null;
    defaultStart?: Date | null;
    defaultPatientId?: string | null;
    onClose: () => void;
  }) =>
    p.open ? (
      <div role="dialog">
        <span>
          {p.appointment ? `Editando ${p.appointment.id}` : 'Novo agendamento'}
          {p.defaultStart ? ` às ${p.defaultStart.getHours()}h` : ''}
          {p.defaultPatientId ? ` paciente ${p.defaultPatientId}` : ''}
        </span>
        <button onClick={p.onClose}>fechar form</button>
      </div>
    ) : null,
}));

vi.setConfig({ testTimeout: 30_000 });

// jsdom não tem ResizeObserver (useElementWidth mede o card do calendário).
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
    unobserve() {}
  },
);

const calls = (agenda as unknown as { calls: { range: { from: string; to: string }; ids: string[] }[] }).calls;

function renderPage(url = '/agenda') {
  window.history.pushState({}, '', url);
  return render(
    <BrowserRouter>
      <Appointments />
    </BrowserRouter>,
  );
}

const appt = { id: 'a9', patientId: 'p', startAt: '2030-01-15T13:00:00.000Z', kind: 'PROCEDURE' } as Appointment;

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  perms.has.mockImplementation((p: string) => p === 'appointments:create');
  perms.restrictToOwnAppointments = false;
  agenda.value = { appointmentsLoading: false, pendingAppointments: [], events: [], isSlotBlocked: vi.fn(() => false) };
});

describe('página Agenda', () => {
  it('mostra a região do calendário e começa na visão semanal', () => {
    renderPage();
    expect(screen.getByRole('region', { name: 'Calendário de agendamentos' })).toBeInTheDocument();
    expect(cal.props.initialView).toBe('timeGridWeek');
  });

  it('lê visão, data e filtro de profissionais da URL', () => {
    renderPage('/agenda?visao=dayGridMonth&data=2030-06-10&profissionais=u1,u2');
    expect(cal.props.initialView).toBe('dayGridMonth');
    expect(cal.props.initialDate).toBe('2030-06-10');
    expect(calls[calls.length - 1].ids).toEqual(['u1', 'u2']);
  });

  it('visão inválida na URL cai na semana', () => {
    renderPage('/agenda?visao=ano');
    expect(cal.props.initialView).toBe('timeGridWeek');
  });

  it('mostra o esqueleto enquanto carrega', () => {
    agenda.value = { ...agenda.value, appointmentsLoading: true };
    const { container } = renderPage();
    expect(container.querySelector('.MuiSkeleton-root')).not.toBeNull();
  });

  it('a toolbar comanda a API do calendário', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mês' }));
    expect(cal.api.prev).toHaveBeenCalled();
    expect(cal.api.next).toHaveBeenCalled();
    expect(cal.api.today).toHaveBeenCalled();
    expect(cal.api.changeView).toHaveBeenCalledWith('dayGridMonth');
  });

  it('datesSet atualiza o rótulo, o intervalo consultado e a URL', () => {
    renderPage();
    act(() => {
      cal.props.datesSet({
        start: new Date(Date.UTC(2030, 0, 14)),
        end: new Date(Date.UTC(2030, 0, 21)),
        view: { title: 'janeiro de 2030', type: 'timeGridDay', calendar: { getDate: () => new Date(2030, 0, 17, 12) } },
      });
    });
    expect(screen.getByText('janeiro de 2030')).toBeInTheDocument();
    expect(calls[calls.length - 1].range).toEqual({ from: '2030-01-14T00:00:00.000Z', to: '2030-01-21T00:00:00.000Z' });
    expect(window.location.search).toContain('visao=timeGridDay');
    expect(window.location.search).toContain('data=2030-01-17');
  });

  it('selecionar horário livre abre o formulário de novo agendamento naquele horário', () => {
    renderPage();
    act(() => cal.props.select({ start: new Date(2030, 0, 15, 14, 0), end: new Date(2030, 0, 15, 15, 0) }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Novo agendamento às 14h');
  });

  it('horário bloqueado não abre o formulário e selectAllow reflete o bloqueio', () => {
    const blocked = vi.fn((s: Date) => s.getHours() === 14);
    agenda.value = { ...agenda.value, isSlotBlocked: blocked };
    renderPage();
    const slot = (h: number) => ({ start: new Date(2030, 0, 15, h), end: new Date(2030, 0, 15, h + 1) });
    expect(cal.props.selectAllow(slot(14))).toBe(false);
    expect(cal.props.selectAllow(slot(10))).toBe(true);
    act(() => cal.props.select(slot(14)));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clicar no dia (visão mensal) abre o formulário com a data', () => {
    renderPage();
    act(() => cal.props.dateClick({ date: new Date(2030, 0, 20, 9) }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Novo agendamento às 9h');
  });

  it('sem permissão de criar, seleção e clique não abrem o formulário', () => {
    perms.has.mockReturnValue(false);
    renderPage('/agenda?novo=1');
    act(() => cal.props.select({ start: new Date(2030, 0, 15, 14), end: new Date(2030, 0, 15, 15) }));
    act(() => cal.props.dateClick({ date: new Date(2030, 0, 20) }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clicar num agendamento abre a edição; feriado e bloqueio são ignorados', () => {
    renderPage();
    const click = (extendedProps: Record<string, unknown>) => act(() => cal.props.eventClick({ event: { extendedProps } }));
    click({ holiday: true });
    click({ unavailability: { id: 'x' } });
    click({});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    click({ appointment: appt });
    expect(screen.getByRole('dialog')).toHaveTextContent('Editando a9');
  });

  it('?novo=1&paciente=... abre o formulário com a paciente e limpa a URL', () => {
    renderPage('/agenda?novo=1&paciente=pat-7&visao=timeGridDay');
    expect(screen.getByRole('dialog')).toHaveTextContent('Novo agendamento paciente pat-7');
    expect(window.location.search).not.toContain('novo');
    expect(window.location.search).not.toContain('paciente');
  });

  it('fechar o formulário o esconde; pendências abrem o agendamento para edição', async () => {
    agenda.value = { ...agenda.value, pendingAppointments: [{ ...appt, patient: { id: 'p', name: 'Maria' } }] };
    renderPage();
    expect(screen.getByText('1 agendamento com pendência')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Expandir' }));
    await userEvent.click(screen.getByText('Maria'));
    expect(screen.getByRole('dialog')).toHaveTextContent('Editando a9');
    await userEvent.click(screen.getByRole('button', { name: 'fechar form' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calendário recebe os eventos e o renderizador de "+N mais"', () => {
    agenda.value = { ...agenda.value, events: [{ id: 'e1', title: 'x' }] };
    renderPage();
    expect(cal.props.events).toEqual([{ id: 'e1', title: 'x' }]);
    expect(cal.props.moreLinkContent({ num: 3 })).toBe('+3 mais');
  });

  it('setas do teclado no calendário não quebram sem grade ativa', async () => {
    renderPage();
    const region = screen.getByRole('region', { name: 'Calendário de agendamentos' });
    region.focus();
    await userEvent.keyboard('{ArrowDown}{PageUp}');
    expect(region).toBeInTheDocument();
  });
});
