import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getScreenTour } from './screenTours';
import { isTourSeen, markTourSeen } from './tourStorage';

describe('screenTours', () => {
  it('acha o tour pelo caminho exato', () => {
    expect(getScreenTour('/agenda')?.key).toBe('agenda');
    expect(getScreenTour('/')?.key).toBe('dashboard');
    expect(getScreenTour('/despesas-recorrentes')?.key).toBe('despesas');
  });

  it('não casa subcaminhos nem telas sem tour', () => {
    expect(getScreenTour('/agenda/123')).toBeUndefined();
    expect(getScreenTour('/login')).toBeUndefined();
  });

  it('todas as telas com tour têm passos válidos e terminam apontando o botão de ajuda', () => {
    const paths = [
      '/agenda', '/pacientes', '/financeiro', '/', '/documentos', '/mensagens', '/estoque', '/equipamentos', '/metas',
      '/metricas', '/procedimentos', '/pacotes', '/promocoes', '/usuarios', '/horarios', '/despesas-recorrentes',
      '/formas-pagamento', '/meu-plano',
    ];
    const keys = new Set<string>();
    for (const path of paths) {
      const tour = getScreenTour(path)!;
      expect(tour, path).toBeDefined();
      expect(tour.path).toBe(path);
      keys.add(tour.key);
      expect(tour.steps.length).toBeGreaterThan(1);
      for (const step of tour.steps) {
        expect(step.title).not.toBe('');
        expect(step.body).not.toBe('');
      }
      expect(tour.steps[tour.steps.length - 1].target).toBe('tour-help');
    }
    expect(keys.size).toBe(paths.length);
  });
});

describe('tourStorage', () => {
  beforeEach(() => localStorage.clear());

  it('começa como não visto e persiste por usuário e tela', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T15:00:00.000Z'));
    try {
      expect(isTourSeen('u1', 'agenda')).toBe(false);
      markTourSeen('u1', 'agenda');
      expect(isTourSeen('u1', 'agenda')).toBe(true);
      expect(isTourSeen('u2', 'agenda')).toBe(false);
      expect(isTourSeen('u1', 'pacientes')).toBe(false);
      expect(localStorage.getItem('mila.tourSeen.u1.agenda')).toBe('2026-03-10T15:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });
});
