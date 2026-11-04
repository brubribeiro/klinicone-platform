import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { api } from './client';
import { readAuthNotice, clearAuthNotice } from '../utils/authNotice';

type Handlers = { fulfilled: (r: unknown) => unknown; rejected: (e: unknown) => Promise<never> };
const handlers = (api.interceptors.response as unknown as { handlers: Handlers[] }).handlers[0];

describe('API client', () => {
  it('envia cookies de sessão (withCredentials) em vez de Bearer no localStorage', () => {
    expect(api.defaults.withCredentials).toBe(true);
  });

  it('usa /api como baseURL padrão', () => {
    expect(api.defaults.baseURL).toBe(import.meta.env.VITE_API_URL ?? '/api');
  });

  describe('interceptor de resposta', () => {
    const realLocation = window.location;
    let location: { pathname: string; href: string };

    beforeEach(() => {
      location = { pathname: '/pacientes', href: '' };
      Object.defineProperty(window, 'location', { configurable: true, value: location });
      clearAuthNotice();
    });

    afterEach(() => {
      Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
      clearAuthNotice();
    });

    const err = (status: number, data?: unknown) => ({ response: { status, data } });

    it('repassa respostas de sucesso sem alterar', () => {
      const res = { status: 200, data: { ok: true } };
      expect(handlers.fulfilled(res)).toBe(res);
    });

    it('401 fora do login redireciona para /login e propaga o erro', async () => {
      const e = err(401);
      await expect(handlers.rejected(e)).rejects.toBe(e);
      expect(location.href).toBe('/login');
      expect(readAuthNotice()).toBeNull();
    });

    it('401 na própria tela de login não redireciona de novo', async () => {
      location.pathname = '/login';
      await expect(handlers.rejected(err(401))).rejects.toBeDefined();
      expect(location.href).toBe('');
    });

    it('401 em página pública (anamnese da paciente) não redireciona', async () => {
      location.pathname = '/anamnese/abc123';
      await expect(handlers.rejected(err(401))).rejects.toBeDefined();
      expect(location.href).toBe('');
    });

    it('401 de clínica suspensa guarda o aviso para a tela de login', async () => {
      await expect(
        handlers.rejected(err(401, { error: 'TENANT_SUSPENDED', message: 'Clínica suspensa por falta de pagamento.' })),
      ).rejects.toBeDefined();
      expect(readAuthNotice()).toBe('Clínica suspensa por falta de pagamento.');
      expect(location.href).toBe('/login');
    });

    it('outros erros (403, 500, rede) só propagam, sem redirecionar', async () => {
      for (const e of [err(403), err(500), new Error('Network Error')]) {
        await expect(handlers.rejected(e)).rejects.toBe(e);
      }
      expect(location.href).toBe('');
    });
  });
});
