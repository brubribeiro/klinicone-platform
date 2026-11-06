import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../types';
import { AuthProvider, useAuth } from './AuthContext';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../api/client', () => ({ api: http }));

const clinicUser = { id: 'u1', name: 'Ana', tenantId: 't1', isSuperAdmin: false } as unknown as User;
const superAdmin = { id: 'sa', name: 'Super', tenantId: 't9', isSuperAdmin: true } as unknown as User;

let ctx: ReturnType<typeof useAuth>;
function Probe() {
  ctx = useAuth();
  return <p>{ctx.loading ? 'carregando' : ctx.user ? `logado:${ctx.user.name}` : 'anonimo'}</p>;
}
function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

const originalLocation = window.location;
beforeEach(() => {
  http.get.mockReset();
  http.post.mockReset();
  Object.defineProperty(window, 'location', { configurable: true, value: { href: '', pathname: '/' } });
});
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

describe('AuthProvider', () => {
  it('hidrata o usuário via /auth/me', async () => {
    http.get.mockResolvedValue({ data: clinicUser });
    renderProvider();
    expect(screen.getByText('carregando')).toBeInTheDocument();
    expect(await screen.findByText('logado:Ana')).toBeInTheDocument();
    expect(http.get).toHaveBeenCalledWith('/auth/me');
  });

  it('fica anônimo quando /auth/me falha', async () => {
    http.get.mockRejectedValue(new Error('401'));
    renderProvider();
    expect(await screen.findByText('anonimo')).toBeInTheDocument();
  });

  it('loginWithGoogle envia o código e relê /auth/me', async () => {
    http.get.mockRejectedValueOnce(new Error('401')).mockResolvedValueOnce({ data: clinicUser });
    http.post.mockResolvedValue({ data: { access_token: 'x', user: { ...clinicUser, name: 'Fallback' }, needsPanelSelection: true } });
    renderProvider();
    await screen.findByText('anonimo');
    let result: unknown;
    await act(async () => {
      result = await ctx.loginWithGoogle({ code: 'abc' });
    });
    expect(http.post).toHaveBeenCalledWith('/auth/google', { code: 'abc' });
    expect(result).toEqual({ needsPanelSelection: true });
    expect(screen.getByText('logado:Ana')).toBeInTheDocument();
  });

  it('usa o usuário da resposta quando /auth/me falha após o login', async () => {
    http.get.mockRejectedValue(new Error('boom'));
    http.post.mockResolvedValue({ data: { access_token: 'x', user: { ...clinicUser, name: 'Fallback' } } });
    renderProvider();
    await screen.findByText('anonimo');
    await act(async () => {
      await ctx.loginWithGoogle({ credential: 'tok' });
    });
    expect(http.post).toHaveBeenCalledWith('/auth/google', { credential: 'tok' });
    expect(screen.getByText('logado:Fallback')).toBeInTheDocument();
  });

  it('selectPanel envia o painel escolhido', async () => {
    http.get.mockResolvedValue({ data: clinicUser });
    http.post.mockResolvedValue({ data: { access_token: 'x', user: clinicUser } });
    renderProvider();
    await screen.findByText('logado:Ana');
    await act(async () => ctx.selectPanel('admin'));
    expect(http.post).toHaveBeenCalledWith('/auth/select-panel', { panel: 'admin' });
  });

  it('impersonate troca o usuário, com fallback para a resposta', async () => {
    http.get.mockResolvedValueOnce({ data: clinicUser }).mockRejectedValueOnce(new Error('x'));
    http.post.mockResolvedValue({ data: { access_token: 'x', user: { ...clinicUser, name: 'Alvo' } } });
    renderProvider();
    await screen.findByText('logado:Ana');
    await act(async () => ctx.impersonate('u7'));
    expect(http.post).toHaveBeenCalledWith('/auth/impersonate/u7');
    expect(screen.getByText('logado:Alvo')).toBeInTheDocument();
  });

  it('impersonate usa /auth/me quando disponível', async () => {
    http.get.mockResolvedValueOnce({ data: clinicUser }).mockResolvedValueOnce({ data: { ...clinicUser, name: 'Me' } });
    http.post.mockResolvedValue({ data: { access_token: 'x', user: clinicUser } });
    renderProvider();
    await screen.findByText('logado:Ana');
    await act(async () => ctx.impersonate('u7'));
    expect(screen.getByText('logado:Me')).toBeInTheDocument();
  });

  it('enterTenant entra na clínica e recarrega o usuário', async () => {
    http.get.mockResolvedValueOnce({ data: superAdmin }).mockResolvedValueOnce({ data: clinicUser });
    http.post.mockResolvedValue({ data: {} });
    renderProvider();
    await screen.findByText('logado:Super');
    await act(async () => ctx.enterTenant('t1'));
    expect(http.post).toHaveBeenCalledWith('/admin/tenants/t1/enter');
    expect(screen.getByText('logado:Ana')).toBeInTheDocument();
  });

  it('stopImpersonating de super-admin volta para a clínica no console admin', async () => {
    http.get.mockResolvedValue({ data: superAdmin });
    http.post.mockResolvedValue({ data: {} });
    renderProvider();
    await screen.findByText('logado:Super');
    await act(async () => ctx.stopImpersonating());
    expect(http.post).toHaveBeenCalledWith('/auth/stop-impersonating');
    expect(window.location.href).toContain('/clinicas/t9');
  });

  it('stopImpersonating de usuário comum volta ao painel', async () => {
    http.get.mockResolvedValue({ data: clinicUser });
    http.post.mockResolvedValue({ data: {} });
    renderProvider();
    await screen.findByText('logado:Ana');
    await act(async () => ctx.stopImpersonating());
    expect(window.location.href).not.toContain('/clinicas/');
    expect(window.location.href).toBe('/');
  });

  it('stopImpersonating não redireciona se a API falhar', async () => {
    http.get.mockResolvedValue({ data: clinicUser });
    http.post.mockRejectedValue(new Error('500'));
    renderProvider();
    await screen.findByText('logado:Ana');
    await act(async () => ctx.stopImpersonating());
    expect(window.location.href).toBe('');
  });

  it('logout limpa o usuário e redireciona mesmo com a API fora', async () => {
    http.get.mockResolvedValue({ data: clinicUser });
    http.post.mockRejectedValue(new Error('offline'));
    renderProvider();
    await screen.findByText('logado:Ana');
    await act(async () => ctx.logout());
    expect(http.post).toHaveBeenCalledWith('/auth/logout');
    await waitFor(() => expect(screen.getByText('anonimo')).toBeInTheDocument());
    expect(window.location.href).toBe('/login');
  });

  it('useAuth fora do provider lança erro', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});

