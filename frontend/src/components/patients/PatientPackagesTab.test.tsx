import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PatientPackagesTab } from './PatientPackagesTab';

describe('PatientPackagesTab', () => {
  it('mostra estado vazio', () => {
    render(<PatientPackagesTab patientPackages={[]} />);
    expect(screen.getByText('Nenhum pacote vinculado.')).toBeInTheDocument();
  });

  it('mostra pacotes com status, sessões e validade', () => {
    render(
      <PatientPackagesTab
        patientPackages={[
          { id: '1', package: { name: 'Laser 5x' }, status: 'ACTIVE', sessionsUsed: 2, sessionsTotal: 5, totalPaid: '500', expiresAt: '2026-12-31T12:00:00.000Z' },
          { id: '2', status: 'CANCELLED', sessionsUsed: 0, sessionsTotal: 0, totalPaid: 0 },
          { id: '3', package: { name: 'Antigo' }, status: 'OTHER', sessionsUsed: 9, sessionsTotal: 3, totalPaid: 10 },
        ]}
      />,
    );
    expect(screen.getByText('Laser 5x')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByText(/expira 31\/12\/2026/)).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
    expect(screen.getByText('Pacote')).toBeInTheDocument();
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
    expect(screen.getByText('OTHER')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')[0]).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getAllByRole('progressbar')[2]).toHaveAttribute('aria-valuenow', '100');
  });
});
