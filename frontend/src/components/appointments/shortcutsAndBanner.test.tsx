import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Appointment } from '../../types';
import { ApplicationMapShortcut } from './ApplicationMapShortcut';
import { PendingAppointmentsBanner } from './PendingAppointmentsBanner';
import { SkinAnamnesisShortcut } from './SkinAnamnesisShortcut';

vi.setConfig({ testTimeout: 30_000 });

const pending = [
  {
    id: 'a1',
    kind: 'PROCEDURE',
    startAt: new Date(2030, 0, 15, 9, 30).toISOString(),
    patient: { id: 'p1', name: 'Maria Silva' },
    procedure: { id: 'pr', name: 'Peeling' },
  },
  {
    id: 'a2',
    kind: 'EVALUATION',
    startAt: new Date(2030, 0, 16, 14, 0).toISOString(),
  },
] as unknown as Appointment[];

describe('PendingAppointmentsBanner', () => {
  it('não renderiza sem pendências', () => {
    const { container } = render(<PendingAppointmentsBanner appointments={[]} onOpen={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('conta no plural, expande a lista, abre o agendamento clicado e pode ser dispensado', async () => {
    const onOpen = vi.fn();
    render(<PendingAppointmentsBanner appointments={pending} onOpen={onOpen} />);
    expect(screen.getByText('2 agendamentos com pendência')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Expandir' }));
    expect(screen.getByRole('button', { name: 'Recolher' })).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText(/09:30/)).toBeInTheDocument();
    expect(screen.getByText('· Peeling')).toBeInTheDocument();
    // Sem nome de paciente nem procedimento: cai no rótulo do tipo.
    expect(screen.getByText('Paciente')).toBeInTheDocument();
    expect(screen.getByText('· Avaliação')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Maria Silva'));
    expect(onOpen).toHaveBeenCalledWith(pending[0]);

    await userEvent.click(screen.getByRole('button', { name: 'Dispensar' }));
    expect(screen.queryByText(/com pendência/)).not.toBeInTheDocument();
  });

  it('singular com uma pendência', () => {
    render(<PendingAppointmentsBanner appointments={[pending[0]]} onOpen={() => {}} />);
    expect(screen.getByText('1 agendamento com pendência')).toBeInTheDocument();
  });
});

describe('atalhos do formulário de agendamento', () => {
  it('mapa de aplicação: texto conforme a quantidade de pontos e clique', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<ApplicationMapShortcut pointsCount={0} onClick={onClick} />);
    expect(screen.getByText('Marcar pontos faciais ou corporais')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<ApplicationMapShortcut pointsCount={1} onClick={onClick} />);
    expect(screen.getByText('1 ponto marcado')).toBeInTheDocument();
    rerender(<ApplicationMapShortcut pointsCount={7} onClick={onClick} />);
    expect(screen.getByText('7 pontos marcados')).toBeInTheDocument();
  });

  it('anamnese de pele: clique chama onClick', async () => {
    const onClick = vi.fn();
    render(<SkinAnamnesisShortcut onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
