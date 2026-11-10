import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RESOURCES } from '../../contexts/permissions';
import { PermissionsMatrix } from './PermissionsMatrix';
import { ROLE_COLORS, roleColor } from './roleColors';

vi.setConfig({ testTimeout: 30_000 });

describe('PermissionsMatrix', () => {
  it('alterna uma célula individual', async () => {
    const onChange = vi.fn();
    render(<PermissionsMatrix value={['patients:view']} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Visualizar Pacientes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Criar Pacientes' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(screen.getByRole('button', { name: 'Criar Pacientes' }));
    expect(onChange).toHaveBeenLastCalledWith(['patients:view', 'patients:create']);
    await userEvent.click(screen.getByRole('button', { name: 'Visualizar Pacientes' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('marca a linha inteira do módulo e desmarca se já estiver completa', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<PermissionsMatrix value={['patients:view']} onChange={onChange} />);
    await userEvent.click((screen.getByText('Pacientes').closest('button') as HTMLElement));
    expect(onChange).toHaveBeenLastCalledWith([
      'patients:view',
      'patients:create',
      'patients:edit',
      'patients:delete',
    ]);

    rerender(
      <PermissionsMatrix
        value={['patients:view', 'patients:create', 'patients:edit', 'patients:delete', 'finance:view']}
        onChange={onChange}
      />,
    );
    await userEvent.click((screen.getByText('Pacientes').closest('button') as HTMLElement));
    expect(onChange).toHaveBeenLastCalledWith(['finance:view']);
  });

  it('marca e desmarca a coluna inteira em todos os módulos', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<PermissionsMatrix value={['finance:view']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Marcar/desmarcar "Excluir" em todos os módulos' }));
    const next = onChange.mock.calls[0][0] as string[];
    expect(next).toContain('finance:view');
    expect(next.filter((p) => p.endsWith(':delete'))).toHaveLength(RESOURCES.length);

    rerender(<PermissionsMatrix value={next} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Marcar/desmarcar "Excluir" em todos os módulos' }));
    expect(onChange).toHaveBeenLastCalledWith(['finance:view']);
  });

  it('somente leitura não oferece botões', () => {
    render(<PermissionsMatrix value={['patients:view']} readOnly onChange={vi.fn()} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('Pacientes')).toBeInTheDocument();
    expect(screen.getByText('Ver')).toBeInTheDocument();
  });

  it('sem onChange também é só exibição', () => {
    render(<PermissionsMatrix value={[]} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('roleColor', () => {
  it('usa a cor do grupo ou uma da paleta pela posição', () => {
    expect(roleColor({ color: '#123456' }, 0)).toBe('#123456');
    expect(roleColor({ color: null }, 1)).toBe(ROLE_COLORS[1]);
    expect(roleColor({}, ROLE_COLORS.length + 2)).toBe(ROLE_COLORS[2]);
  });
});
