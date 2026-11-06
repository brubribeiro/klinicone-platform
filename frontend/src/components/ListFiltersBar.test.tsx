import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ActiveFilter } from '../utils/listFilters';
import { ActiveFilterSelect, ListFiltersBar } from './ListFiltersBar';

describe('ListFiltersBar', () => {
  it('mostra a contagem simples e o placeholder padrão', () => {
    render(<ListFiltersBar search="" onSearchChange={() => {}} filteredCount={4} countLabel="pacientes" />);
    expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument();
    expect(screen.getByText('4 pacientes')).toBeInTheDocument();
  });

  it('mostra "X de Y" quando filtrado e renderiza filhos e trailing', () => {
    render(
      <ListFiltersBar search="" onSearchChange={() => {}} filteredCount={2} totalCount={9} countLabel="itens" searchPlaceholder="Procurar" trailing={<span>extra</span>}>
        <span>filtro-filho</span>
      </ListFiltersBar>,
    );
    expect(screen.getByText('2 de 9 itens')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Procurar')).toBeInTheDocument();
    expect(screen.getByText('filtro-filho')).toBeInTheDocument();
    expect(screen.getByText('extra')).toBeInTheDocument();
  });

  it('não repete o total quando iguais', () => {
    render(<ListFiltersBar search="" onSearchChange={() => {}} filteredCount={9} totalCount={9} countLabel="itens" />);
    expect(screen.getByText('9 itens')).toBeInTheDocument();
  });

  it('propaga a digitação da busca', async () => {
    const onChange = vi.fn();
    function Wrapper() {
      const [v, setV] = useState('');
      return <ListFiltersBar search={v} onSearchChange={(x) => { onChange(x); setV(x); }} filteredCount={0} countLabel="x" />;
    }
    render(<Wrapper />);
    await userEvent.type(screen.getByPlaceholderText('Buscar...'), 'ab');
    expect(onChange).toHaveBeenNthCalledWith(1, 'a');
    expect(onChange).toHaveBeenLastCalledWith('ab');
  });
});

describe('ActiveFilterSelect', () => {
  it('lista as opções e emite a escolhida', async () => {
    const onChange = vi.fn();
    function Wrapper() {
      const [v, setV] = useState<ActiveFilter>('ALL');
      return <ActiveFilterSelect value={v} onChange={(x) => { onChange(x); setV(x); }} />;
    }
    render(<Wrapper />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Todos', 'Ativos', 'Inativos']);
    await userEvent.click(screen.getByRole('option', { name: 'Inativos' }));
    expect(onChange).toHaveBeenCalledWith('INACTIVE');
  });

  it('aceita rótulo personalizado', () => {
    render(<ActiveFilterSelect value="ACTIVE" onChange={() => {}} label="Situação" />);
    expect(screen.getByRole('combobox', { name: 'Situação' })).toHaveTextContent('Ativos');
  });
});
