import { describe, it, expect, beforeEach } from 'vitest';

import { api } from '../api/client';
import { clearAuthNotice, readAuthNotice, saveAuthNotice, tenantSuspendedMessage } from './authNotice';

const suspendedError = (message?: string) => ({
  response: { status: 401, data: { statusCode: 401, error: 'TENANT_SUSPENDED', message } },
});

describe('authNotice', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, '', '/painel/login');
  });

  it('reconhece TENANT_SUSPENDED e usa a mensagem da API', () => {
    expect(tenantSuspendedMessage(suspendedError('Clínica X suspensa'))).toBe('Clínica X suspensa');
  });

  it('tem mensagem padrão quando a API não manda texto', () => {
    expect(tenantSuspendedMessage(suspendedError())).toMatch(/suspenso/);
  });

  it('ignora outros erros', () => {
    expect(tenantSuspendedMessage({ response: { status: 401, data: { message: 'Sessão inválida' } } })).toBeNull();
    expect(tenantSuspendedMessage(new Error('rede'))).toBeNull();
    expect(tenantSuspendedMessage(undefined)).toBeNull();
  });

  it('guarda o aviso até a tela de login apagar', () => {
    saveAuthNotice('Suspensa');
    expect(readAuthNotice()).toBe('Suspensa');
    clearAuthNotice();
    expect(readAuthNotice()).toBeNull();
  });

  it('o interceptor do axios guarda o aviso quando a sessão cai por clínica suspensa', async () => {
    const handlers = (api.interceptors.response as unknown as {
      handlers: { rejected: (err: unknown) => Promise<unknown> }[];
    }).handlers;
    const err = suspendedError('Clínica X suspensa');

    await expect(handlers[0].rejected(err)).rejects.toBe(err);

    expect(readAuthNotice()).toBe('Clínica X suspensa');
  });

  it('o interceptor não deixa aviso para um 401 comum', async () => {
    const handlers = (api.interceptors.response as unknown as {
      handlers: { rejected: (err: unknown) => Promise<unknown> }[];
    }).handlers;

    await expect(handlers[0].rejected({ response: { status: 401, data: {} } })).rejects.toBeTruthy();
    expect(readAuthNotice()).toBeNull();
  });
});
