import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GuidedTour, type TourStep } from './GuidedTour';
import { isTourSeen, markTourSeen } from './tourStorage';

const STEPS: TourStep[] = [
  { title: 'Intro', body: 'Bem-vindo' },
  { target: 'visible', title: 'Visível', body: 'Elemento na tela' },
  { target: 'missing', title: 'Sem permissão', body: 'Elemento ausente' },
];

describe('GuidedTour', () => {
  beforeEach(() => {
    // jsdom não faz layout: dá tamanho ao elemento para ele contar como visível.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 10, 100, 40));
    vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });
  afterEach(() => {
    // Desmonta antes de restaurar: o tour devolve a rolagem ao fechar.
    cleanup();
    vi.restoreAllMocks();
  });

  it('pula passos cujo elemento não está na tela e conclui no último', async () => {
    const onClose = vi.fn();
    // Como no Layout, o tour monta depois da página: os elementos já estão no DOM.
    const { rerender } = render(<div data-tour="visible" />);
    rerender(
      <>
        <div data-tour="visible" />
        <GuidedTour steps={STEPS} onClose={onClose} />
      </>,
    );

    expect(screen.getByText('1 DE 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByRole('dialog', { name: 'Visível' })).toBeInTheDocument();
    expect(screen.queryByText('Sem permissão')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dispensa com Esc', async () => {
    const onClose = vi.fn();
    render(<GuidedTour steps={STEPS} onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('tourStorage', () => {
  afterEach(() => localStorage.clear());

  it('guarda o tour visto por usuário e tela', () => {
    expect(isTourSeen('u1', 'agenda')).toBe(false);
    markTourSeen('u1', 'agenda');
    expect(isTourSeen('u1', 'agenda')).toBe(true);
    expect(isTourSeen('u2', 'agenda')).toBe(false);
    expect(isTourSeen('u1', 'pacientes')).toBe(false);
  });
});
