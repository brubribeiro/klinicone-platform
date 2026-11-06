import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AppDialogProvider, useAppDialog, type AlertOptions, type ConfirmOptions } from './AppDialogContext';

vi.setConfig({ testTimeout: 30_000 });

function Harness({ confirmOpts, alertOpts }: { confirmOpts?: ConfirmOptions; alertOpts?: AlertOptions }) {
  const { confirm, alert } = useAppDialog();
  const [result, setResult] = useState('nada');
  return (
    <div>
      <button onClick={() => confirm(confirmOpts ?? { message: 'Excluir item?' }).then((v) => setResult(`confirm:${v}`))}>abrir-confirm</button>
      <button onClick={() => alert(alertOpts ?? { message: 'Algo aconteceu' }).then(() => setResult('alert:fechado'))}>abrir-alert</button>
      <p>resultado:{result}</p>
    </div>
  );
}
const renderIt = (props: React.ComponentProps<typeof Harness> = {}) =>
  render(
    <AppDialogProvider>
      <Harness {...props} />
    </AppDialogProvider>,
  );

describe('AppDialogProvider', () => {
  it('confirm resolve true ao confirmar', async () => {
    renderIt();
    await userEvent.click(screen.getByText('abrir-confirm'));
    expect(await screen.findByText('Excluir item?')).toBeInTheDocument();
    expect(screen.getByText('Confirmar', { selector: 'button' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(screen.getByText('resultado:confirm:true')).toBeInTheDocument());
  });

  it('confirm resolve false ao cancelar', async () => {
    renderIt();
    await userEvent.click(screen.getByText('abrir-confirm'));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.getByText('resultado:confirm:false')).toBeInTheDocument());
  });

  it('confirm resolve false com Esc', async () => {
    renderIt();
    await userEvent.click(screen.getByText('abrir-confirm'));
    await screen.findByText('Excluir item?');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByText('resultado:confirm:false')).toBeInTheDocument());
  });

  it('mostra título, rótulos, detalhes personalizados', async () => {
    renderIt({
      confirmOpts: {
        title: 'Remover',
        subtitle: 'Cuidado',
        message: 'Tem certeza?',
        detailsTitle: 'Afeta:',
        details: ['3 pacientes', '2 agendas'],
        confirmLabel: 'Remover mesmo',
        cancelLabel: 'Voltar',
        confirmColor: 'error',
      },
    });
    await userEvent.click(screen.getByText('abrir-confirm'));
    expect(await screen.findByText('Remover')).toBeInTheDocument();
    expect(screen.getByText('Cuidado')).toBeInTheDocument();
    expect(screen.getByText('Afeta:')).toBeInTheDocument();
    expect(screen.getByText('3 pacientes')).toBeInTheDocument();
    expect(screen.getByText('2 agendas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remover mesmo' }));
    await waitFor(() => expect(screen.getByText('resultado:confirm:true')).toBeInTheDocument());
  });

  it('disableConfirm esconde o botão de confirmar e avisa', async () => {
    renderIt({ confirmOpts: { message: 'Em uso', disableConfirm: true } });
    await userEvent.click(screen.getByText('abrir-confirm'));
    expect(await screen.findByText('Ação bloqueada')).toBeInTheDocument();
    expect(screen.getByText('Remova os vínculos antes de excluir.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
    const closers = screen.getAllByRole('button', { name: 'Fechar' });
    await userEvent.click(closers[closers.length - 1]);
    await waitFor(() => expect(screen.getByText('resultado:confirm:false')).toBeInTheDocument());
  });

  it('alert resolve ao clicar OK', async () => {
    renderIt();
    await userEvent.click(screen.getByText('abrir-alert'));
    expect(await screen.findByText('Algo aconteceu')).toBeInTheDocument();
    expect(screen.getByText('Aviso')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(screen.getByText('resultado:alert:fechado')).toBeInTheDocument());
  });

  it('alert com severidade usa Alert e título próprio', async () => {
    renderIt({ alertOpts: { title: 'Falhou', message: 'Erro grave', severity: 'error' } });
    await userEvent.click(screen.getByText('abrir-alert'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Erro grave');
    expect(screen.getByText('Falhou')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByText('resultado:alert:fechado')).toBeInTheDocument());
  });

  it('useAppDialog fora do provider lança erro', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow(/AppDialogProvider/);
    spy.mockRestore();
  });
});
