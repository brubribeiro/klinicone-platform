import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Appointment, InventoryItem, Procedure } from '../../types';
import type { ExtraMaterialRow } from './appointmentFormModel';
import { MaterialsSection, useAppointmentMaterials } from './MaterialsSection';

vi.setConfig({ testTimeout: 30_000 });

const luva = { id: 'i1', name: 'Luva', unit: 'un', quantity: 50, minQuantity: 10 } as unknown as InventoryItem;
const acido = { id: 'i2', name: 'Ácido', unit: 'ml', quantity: 5, minQuantity: 2 } as unknown as InventoryItem;
const gaze = { id: 'i3', name: 'Gaze', unit: 'un', quantity: 100, minQuantity: 5 } as unknown as InventoryItem;
const inventory = [luva, acido, gaze];

const peeling = {
  id: 'p1',
  name: 'Peeling',
  materials: [
    { itemId: 'i1', quantity: 45, item: luva },
    { itemId: 'i2', quantity: 4, item: acido },
  ],
} as unknown as Procedure;

function Harness({
  enabled = true,
  willDeduct = true,
  expanded = true,
  selected = [peeling],
  initialExtras = [],
  source,
  onExtras,
}: {
  enabled?: boolean;
  willDeduct?: boolean;
  expanded?: boolean;
  selected?: Procedure[];
  initialExtras?: ExtraMaterialRow[];
  source?: Appointment | null;
  onExtras?: (rows: ExtraMaterialRow[]) => void;
}) {
  const [extras, setExtras] = useState<ExtraMaterialRow[]>(initialExtras);
  onExtras?.(extras);
  const materialsState = useAppointmentMaterials({
    inventory,
    appointmentSource: source,
    procedureOptions: [peeling],
    selectedProcedures: selected,
    extraMaterials: extras,
  });
  return (
    <MaterialsSection
      section={{ step: 4, expanded, onToggle: () => {}, state: 'pending' }}
      enabled={enabled}
      inventory={inventory}
      extraMaterials={extras}
      setExtraMaterials={setExtras}
      willDeductMaterials={willDeduct}
      materialsState={materialsState}
    />
  );
}

describe('MaterialsSection', () => {
  it('lista os materiais previstos com unidade e a legenda de estoque', () => {
    render(<Harness />);
    expect(screen.getByText('Previstos no procedimento')).toBeInTheDocument();
    expect(screen.getByText(/Luva — 45 un/)).toBeInTheDocument();
    expect(screen.getByText(/Ácido — 4 ml/)).toBeInTheDocument();
    expect(screen.getByText('Estoque baixo')).toBeInTheDocument();
    expect(screen.getByText('Sem estoque')).toBeInTheDocument();
    expect(screen.getByText('Nenhum material extra além do previsto no procedimento.')).toBeInTheDocument();
  });

  it('marca "(reservados)" quando o atendimento ainda não baixa estoque', () => {
    render(<Harness willDeduct={false} />);
    expect(screen.getByText('Previstos no procedimento (reservados)')).toBeInTheDocument();
  });

  it('adiciona um material extra, escolhe o item, altera a quantidade e remove', async () => {
    let latest: ExtraMaterialRow[] = [];
    render(<Harness onExtras={(r) => (latest = r)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(latest).toEqual([{ itemId: '', quantity: 1 }]);

    await userEvent.click(screen.getByRole('combobox', { name: /Material/ }));
    const list = screen.getByRole('listbox');
    expect(within(list).getByText('Gaze (un) — disp.: 100')).toBeInTheDocument();
    await userEvent.click(within(list).getByText('Gaze (un) — disp.: 100'));
    expect(latest).toEqual([{ itemId: 'i3', quantity: 1 }]);

    const qty = screen.getByRole('spinbutton', { name: 'Qtd' });
    await userEvent.clear(qty);
    await userEvent.type(qty, '3');
    expect(latest).toEqual([{ itemId: 'i3', quantity: 3 }]);

    await userEvent.click(screen.getByRole('button', { name: 'Remover material 1' }));
    expect(latest).toEqual([]);
  });

  it('não oferece em outra linha um item já usado', async () => {
    render(
      <Harness
        initialExtras={[
          { itemId: 'i3', quantity: 1 },
          { itemId: '', quantity: 1 },
        ]}
      />,
    );
    const boxes = screen.getAllByRole('combobox', { name: /Material/ });
    await userEvent.click(boxes[1]);
    const list = screen.getByRole('listbox');
    expect(within(list).queryByText(/Gaze/)).not.toBeInTheDocument();
    expect(within(list).getByText(/Luva/)).toBeInTheDocument();
  });

  it('extra que estoura o estoque marca a quantidade como erro e o resumo avisa', () => {
    const { unmount } = render(<Harness initialExtras={[{ itemId: 'i2', quantity: 3 }]} />);
    expect(screen.getByRole('spinbutton', { name: 'Qtd' })).toBeInvalid();
    unmount();
    render(<Harness expanded={false} initialExtras={[{ itemId: 'i2', quantity: 3 }]} />);
    expect(screen.getByText('Estoque insuficiente para este atendimento')).toBeInTheDocument();
  });

  it('fechada, resume previstos e extras com plural correto', () => {
    render(<Harness expanded={false} initialExtras={[{ itemId: 'i3', quantity: 1 }]} />);
    expect(screen.getByText('2 previstos · 1 extra')).toBeInTheDocument();
  });

  it('desabilitado (sem procedimento) mostra o resumo e não expande', () => {
    render(<Harness enabled={false} />);
    expect(screen.getByRole('button', { name: /Materiais/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Disponível para procedimentos')).toBeInTheDocument();
  });

  it('na edição devolve ao estoque o que o agendamento já baixou', () => {
    const source = { id: 'a1', procedureId: 'p1', materialsDeducted: true, extraMaterials: [] } as unknown as Appointment;
    render(<Harness source={source} initialExtras={[{ itemId: 'i2', quantity: 1 }]} />);
    // Ácido: 5 em estoque + 4 já baixados = 9 disponíveis; precisa 4 + 1.
    expect(screen.getByRole('spinbutton', { name: 'Qtd' })).toBeValid();
  });
});
