import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { PatientListPagination } from './PatientListPagination';
import { PatientListEmptyState } from './PatientListEmptyState';
import { PatientListColumns } from './PatientListColumns';
import { PatientListRow } from './PatientListRow';
import { PatientWhatsAppButton } from './PatientWhatsAppButton';
import { ReliabilityBadge } from './ReliabilityBadge';
import { EmptyBlock } from './EmptyBlock';
import { appointmentKindLabel, patientAgeLabel, scoreTone } from './patientChart';
import type { Patient } from '../../types';

function Pager({ pageCount, start = 0 }: { pageCount: number; start?: number }) {
  const [page, setPage] = useState(start);
  return (
    <PatientListPagination pageCount={pageCount} currentPage={page} rangeStart={page * 10 + 1} rangeEnd={page * 10 + 10} total={pageCount * 10} setPage={setPage} />
  );
}

describe('PatientListPagination', () => {
  it('navega entre páginas e desabilita os extremos', async () => {
    render(<Pager pageCount={3} />);
    expect(screen.getByText('1–10 de 30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getByText('11–20 de 30')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Página 3' }));
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page');
  });

  it('usa reticências com muitas páginas', () => {
    render(<Pager pageCount={20} start={10} />);
    expect(screen.getAllByText('…')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Página 20' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página 12' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Página 5' })).not.toBeInTheDocument();
  });
});

describe('PatientListEmptyState', () => {
  it('diferencia busca sem resultado de base vazia e respeita permissão', async () => {
    const onCreate = vi.fn();
    const { rerender } = render(<PatientListEmptyState search="zzz" canCreate onCreate={onCreate} />);
    expect(screen.getByText('Nenhum paciente encontrado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Adicionar paciente/ }));
    expect(onCreate).toHaveBeenCalled();
    rerender(<PatientListEmptyState search="" canCreate={false} onCreate={onCreate} />);
    expect(screen.getByText('Nenhum paciente cadastrado')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('PatientListColumns', () => {
  it('dispara ordenação por coluna', async () => {
    const onToggleSort = vi.fn();
    render(<PatientListColumns sort={{ key: 'totalSpent', dir: 'desc' }} onToggleSort={onToggleSort} />);
    await userEvent.click(screen.getByRole('button', { name: 'Última visita' }));
    await userEvent.click(screen.getByRole('button', { name: 'Total gasto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agend.' }));
    expect(onToggleSort.mock.calls.map((c) => c[0])).toEqual(['lastVisit', 'totalSpent', 'appointments']);
  });
});

const patient = {
  id: 'p1', name: 'Maria Souza', phone: '11988887777', document: '52998224725',
  lastVisit: '2026-03-10T15:00:00.000Z', totalSpent: 1500, appointmentsCount: 4, reliabilityPercent: 82,
} as unknown as Patient;

function row(p: Partial<Patient> = {}, perms = { canEdit: true, canDelete: true }) {
  const handlers = { onOpen: vi.fn(), onWhatsApp: vi.fn(), onAnamnesis: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
  render(<PatientListRow patient={{ ...patient, ...p }} {...perms} {...handlers} />);
  return handlers;
}

describe('PatientListRow', () => {
  it('mostra dados formatados e aciona callbacks sem abrir a ficha nos botões', async () => {
    const h = row();
    expect(screen.getByText('529.982.247-25')).toBeInTheDocument();
    expect(screen.getAllByText('(11) 98888-7777').length).toBeGreaterThan(0);
    expect(screen.getByText(/R\$\s*1\.500/)).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('MS')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Editar Maria Souza' }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Maria Souza' }));
    await userEvent.click(screen.getByRole('button', { name: 'Anamnese de Maria Souza' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar WhatsApp para Maria Souza' }));
    expect(h.onEdit).toHaveBeenCalled();
    expect(h.onDelete).toHaveBeenCalled();
    expect(h.onAnamnesis).toHaveBeenCalled();
    expect(h.onWhatsApp).toHaveBeenCalled();
    expect(h.onOpen).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Abrir ficha de Maria Souza' }));
    expect(h.onOpen).toHaveBeenCalledTimes(1);
  });

  it('abre a ficha com Enter e esconde ações sem permissão; sem telefone desabilita WhatsApp', async () => {
    const h = row({ phone: undefined, document: undefined, lastVisit: undefined, totalSpent: 0, reliabilityPercent: undefined } as Partial<Patient>, { canEdit: false, canDelete: false });
    screen.getByRole('button', { name: 'Abrir ficha de Maria Souza' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(h.onOpen).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Editar Maria Souza' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir Maria Souza' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar WhatsApp para Maria Souza' })).toBeDisabled();
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});

describe('PatientWhatsAppButton', () => {
  it('abre wa.me com DDI 55', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<PatientWhatsAppButton phone="(11) 98888-7777" name="Ana" sx={{ borderRadius: '8px' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir WhatsApp de Ana' }));
    expect(open).toHaveBeenCalledWith('https://wa.me/5511988887777', '_blank', 'noopener');
    open.mockRestore();
  });
});

describe('ReliabilityBadge, EmptyBlock e patientChart', () => {
  it('mostra o valor e a faixa de score', () => {
    render(<ReliabilityBadge value={93} variant="page" />);
    expect(screen.getByText('93')).toBeInTheDocument();
    expect(scoreTone(90).label).toBe('Excelente');
    expect(scoreTone(75).label).toBe('Bom');
    expect(scoreTone(74).label).toBe('Atenção');
  });

  it('EmptyBlock mostra a mensagem', () => {
    render(<EmptyBlock message="Nada aqui" />);
    expect(screen.getByText('Nada aqui')).toBeInTheDocument();
  });

  it('calcula a idade a partir da data de nascimento', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
    expect(patientAgeLabel('1990-06-16')).toBe('35 anos');
    expect(patientAgeLabel('1990-06-15')).toBe('36 anos');
    expect(patientAgeLabel(null)).toBeNull();
    expect(patientAgeLabel('2030-01-01')).toBeNull();
    vi.useRealTimers();
    expect(appointmentKindLabel.RETURN).toBe('Retorno');
  });
});
