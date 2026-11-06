import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ApplicationMapPreview } from './ApplicationMapPreview';
import type { ApplicationMap } from '../../types';

describe('ApplicationMapPreview', () => {
  it('mostra contagem, imagens só das vistas usadas e resumo por produto', () => {
    const map: ApplicationMap = {
      template: 'face',
      points: [
        { x: 10, y: 20, product: 'toxin', qty: 4 },
        { x: 30, y: 40, product: 'toxin', qty: 2, view: 'left' },
        { x: 50, y: 60, product: 'filler', qty: 1.5, view: 'front' },
      ],
    };
    render(<ApplicationMapPreview map={map} />);
    expect(screen.getByText(/MAPA DE APLICAÇÃO · 3 PONTOS/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mapa de aplicação: frente' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mapa de aplicação: perfil esquerdo' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /corporal/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Toxina Botulínica · 2 pts · 6 U/)).toBeInTheDocument();
    expect(screen.getByText(/Preenchimento · 1 pts · 1,5 ml/)).toBeInTheDocument();
  });

  it('usa singular com um ponto e lista anotações antigas numeradas', () => {
    render(
      <ApplicationMapPreview
        map={{ template: 'face', points: [{ x: 1, y: 2, note: 'Glabela', view: 'body' }] }}
      />,
    );
    expect(screen.getByText(/· 1 PONTO$/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mapa de aplicação: corporal' })).toBeInTheDocument();
    expect(screen.getByText('Glabela')).toBeInTheDocument();
    expect(screen.getByText('1.')).toBeInTheDocument();
  });
});
