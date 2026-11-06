import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Appointment } from '../types';
import { AppointmentDialogProvider, useAppointmentDialog } from './AppointmentDialogContext';

const form = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
vi.mock('../components/appointments/AppointmentFormDialog', () => ({
  AppointmentFormDialog: (props: { onClose: () => void; appointment: Appointment | null; defaultPatientId: string | null; defaultStart: Date | null }) => {
    form.props = props;
    return (
      <div role="dialog" aria-label="form">
        edit:{props.appointment?.id ?? '-'} patient:{props.defaultPatientId ?? '-'} start:{props.defaultStart?.toISOString() ?? '-'}
        <button onClick={props.onClose}>fechar-form</button>
      </div>
    );
  },
}));

function Harness() {
  const { openAppointmentDialog, closeAppointmentDialog } = useAppointmentDialog();
  return (
    <>
      <button onClick={() => openAppointmentDialog()}>novo</button>
      <button
        onClick={() =>
          openAppointmentDialog({ patientId: 'p1', start: new Date('2026-03-10T13:00:00.000Z'), appointment: { id: 'a1' } as Appointment })
        }
      >
        completo
      </button>
      <button onClick={closeAppointmentDialog}>fechar-ctx</button>
    </>
  );
}
const renderIt = () =>
  render(
    <AppointmentDialogProvider>
      <Harness />
    </AppointmentDialogProvider>,
  );

describe('AppointmentDialogProvider', () => {
  it('só monta o formulário depois de aberto', () => {
    renderIt();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre vazio sem opções', async () => {
    renderIt();
    await userEvent.click(screen.getByText('novo'));
    expect(screen.getByRole('dialog')).toHaveTextContent('edit:- patient:- start:-');
  });

  it('repassa paciente, data e agendamento', async () => {
    renderIt();
    await userEvent.click(screen.getByText('completo'));
    expect(screen.getByRole('dialog')).toHaveTextContent('edit:a1 patient:p1 start:2026-03-10T13:00:00.000Z');
  });

  it('fecha pelo formulário e pelo contexto, limpando os padrões', async () => {
    renderIt();
    await userEvent.click(screen.getByText('completo'));
    await userEvent.click(screen.getByText('fechar-form'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('novo'));
    expect(screen.getByRole('dialog')).toHaveTextContent('edit:- patient:-');
    await userEvent.click(screen.getByText('fechar-ctx'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('hook fora do provider lança erro', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow(/AppointmentDialogProvider/);
    spy.mockRestore();
  });
});
