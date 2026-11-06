import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTheme, ThemeProvider } from '@mui/material';
import type { DayHeaderContentArg, EventContentArg } from '@fullcalendar/core';
import { describe, expect, it, vi } from 'vitest';

import type { Appointment } from '../../types';
import { AgendaCalendarSkeleton } from './AgendaCalendarSkeleton';
import { AgendaStatusLegend } from './AgendaStatusLegend';
import { AgendaToolbar } from './AgendaToolbar';
import { renderAgendaDayHeader, renderAgendaEventContent } from './agendaCalendarContent';
import { AGENDA_CATEGORIES, agendaMaxStack, categoryColorFor, toDarkEvent } from './agendaConfig';

vi.setConfig({ testTimeout: 30_000 });

const theme = createTheme();

function dayHeader(viewType: string, isToday = false): DayHeaderContentArg {
  return {
    date: new Date(2030, 0, 15, 12), // terça, 15/01/2030
    isToday,
    view: { type: viewType },
  } as unknown as DayHeaderContentArg;
}

function eventArg(opts: {
  viewType?: string;
  appointment?: Partial<Appointment>;
  sessionLabel?: string | null;
  title?: string;
  timeText?: string;
}): EventContentArg {
  return {
    timeText: opts.timeText ?? '10:00 - 11:00',
    view: { type: opts.viewType ?? 'timeGridDay' },
    event: {
      title: opts.title ?? 'Feriado',
      borderColor: '#15998B',
      start: new Date(2030, 0, 15, 10, 0),
      extendedProps: {
        appointment: opts.appointment as Appointment | undefined,
        statusColor: '#0ABAB5',
        sessionLabel: opts.sessionLabel ?? null,
      },
    },
  } as unknown as EventContentArg;
}

const appt = {
  id: 'a1',
  kind: 'PROCEDURE',
  patient: { id: 'p', name: 'Maria Silva' },
  procedure: { id: 'pr', name: 'Peeling' },
} as unknown as Partial<Appointment>;

function show(node: React.ReactNode) {
  return render(<ThemeProvider theme={theme}>{node}</ThemeProvider>);
}

describe('renderAgendaDayHeader', () => {
  it('no mês mostra só o dia da semana abreviado', () => {
    show(renderAgendaDayHeader(dayHeader('dayGridMonth')));
    expect(screen.getByText('ter')).toBeInTheDocument();
    expect(screen.queryByText('15')).not.toBeInTheDocument();
  });

  it('na semana/dia mostra dia da semana e número', () => {
    show(renderAgendaDayHeader(dayHeader('timeGridWeek', true)));
    expect(screen.getByText('ter')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });
});

describe('renderAgendaEventContent', () => {
  it('no dia: horário, paciente, procedimento e dica com o texto completo', () => {
    show(renderAgendaEventContent(eventArg({ appointment: appt }), theme));
    expect(screen.getByText('10:00 - 11:00')).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('Peeling')).toBeInTheDocument();
    expect(screen.getByTitle('10:00 - 11:00 · Maria Silva · Peeling')).toBeInTheDocument();
  });

  it('na semana mostra só o horário de início', () => {
    show(renderAgendaEventContent(eventArg({ viewType: 'timeGridWeek', appointment: appt }), theme));
    expect(screen.getByText(/^10:00$/)).toBeInTheDocument();
    expect(screen.queryByText('10:00 - 11:00')).not.toBeInTheDocument();
  });

  it('no mês mostra horário e paciente compactos', () => {
    show(renderAgendaEventContent(eventArg({ viewType: 'dayGridMonth', appointment: appt }), theme));
    expect(screen.getByText('10:00 - 11:00')).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.queryByText('Peeling')).not.toBeInTheDocument();
  });

  it('sessão de pacote troca o procedimento pelo selo "Sessão x/y"', () => {
    show(renderAgendaEventContent(eventArg({ appointment: appt, sessionLabel: 'Sessão 2/5' }), theme));
    expect(screen.getByText('Sessão 2/5')).toBeInTheDocument();
    expect(screen.queryByText('Peeling', { selector: 'div' })).not.toBeInTheDocument();
  });

  it('usa "Paciente" sem nome e rótulo de retorno/avaliação sem procedimento', () => {
    show(
      renderAgendaEventContent(
        eventArg({
          appointment: { id: 'a2', kind: 'RETURN', procedure: { id: 'x', name: 'Laser' } } as unknown as Partial<Appointment>,
        }),
        theme,
      ),
    );
    expect(screen.getByText('Paciente')).toBeInTheDocument();
    expect(screen.getByText('Laser')).toBeInTheDocument();
  });

  it('feriados e bloqueios mostram só o título', () => {
    show(renderAgendaEventContent(eventArg({ title: 'Natal' }), theme));
    expect(screen.getByText('Natal')).toBeInTheDocument();
  });
});

describe('AgendaToolbar', () => {
  it('navega, volta para hoje e troca a visão', async () => {
    const handlers = { onPrev: vi.fn(), onNext: vi.fn(), onToday: vi.fn(), onChangeView: vi.fn() };
    show(<AgendaToolbar periodLabel="janeiro de 2030" currentView="timeGridWeek" {...handlers} />);
    expect(screen.getByText('janeiro de 2030')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mês' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dia' }));
    expect(handlers.onPrev).toHaveBeenCalledTimes(1);
    expect(handlers.onNext).toHaveBeenCalledTimes(1);
    expect(handlers.onToday).toHaveBeenCalledTimes(1);
    expect(handlers.onChangeView.mock.calls).toEqual([['dayGridMonth'], ['timeGridDay']]);
    for (const c of AGENDA_CATEGORIES) expect(screen.getByText(c.label)).toBeInTheDocument();
  });
});

describe('AgendaStatusLegend e esqueleto', () => {
  it('legenda lista todos os status', () => {
    show(<AgendaStatusLegend />);
    for (const label of ['Agendado', 'Confirmado', 'Em andamento', 'Concluído', 'Cancelado', 'Faltou']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('esqueleto renderiza sem texto', () => {
    const { container } = show(<AgendaCalendarSkeleton />);
    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(10);
  });
});

describe('agendaConfig', () => {
  it('categoryColorFor é determinística e sempre devolve uma cor da legenda', () => {
    const colors = AGENDA_CATEGORIES.map((c) => c.color);
    expect(categoryColorFor('Peeling')).toBe(categoryColorFor('Peeling'));
    for (const n of ['', 'Peeling', 'Laser', 'Toxina botulínica']) expect(colors).toContain(categoryColorFor(n));
  });

  it('agendaMaxStack depende da largura e da visão (semana tem 7 colunas)', () => {
    expect(agendaMaxStack(0, 'timeGridDay')).toBe(3);
    expect(agendaMaxStack(1470, 'timeGridDay')).toBe(6);
    expect(agendaMaxStack(1470, 'timeGridWeek')).toBe(3);
    expect(agendaMaxStack(300, 'timeGridWeek')).toBe(1);
  });

  it('toDarkEvent troca o fundo por uma tinta da borda', () => {
    const out = toDarkEvent({ borderColor: '#C25A4C', backgroundColor: '#EAD4D4' });
    expect(out.backgroundColor).toBe('#C25A4C33');
    expect(out.textColor).toMatch(/^rgb|^#/);
  });
});
