import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { Login } from './Login';

const auth = vi.hoisted(() => ({ user: null, loginWithGoogle: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

type Callbacks = {
  onSuccess: (r: { code: string }) => void;
  onError: (r: { error: string }) => void;
  onNonOAuthError: (e: { type: string }) => void;
  flow?: string;
  ux_mode?: string;
};
const google = vi.hoisted(() => ({
  loaded: true,
  options: null as Callbacks | null,
  requestCode: vi.fn(),
}));
vi.mock('@react-oauth/google', () => ({
  useGoogleOAuth: () => ({ clientId: 'cid', scriptLoadedSuccessfully: google.loaded }),
  useGoogleLogin: (opts: Callbacks) => {
    google.options = opts;
    return google.requestCode;
  },
}));

function renderLogin() {
  render(
    <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<p>home</p>} />
        <Route path="/escolher-painel" element={<p>escolher painel</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const button = () => screen.getByRole('button', { name: /entrar com o google/i });

describe('Login com botão Google próprio (auth-code)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'cid');
    google.loaded = true;
    google.requestCode.mockReset();
    auth.loginWithGoogle.mockReset();
    sessionStorage.clear();
  });

  it('usa o fluxo auth-code em popup e abre o Google ao clicar', async () => {
    renderLogin();
    expect(google.options).toMatchObject({ flow: 'auth-code', ux_mode: 'popup' });
    await userEvent.click(button());
    expect(google.requestCode).toHaveBeenCalledTimes(1);
  });

  it('envia o code ao backend, mostra "Verificando acesso..." e entra', async () => {
    let resolve!: (v: { needsPanelSelection?: boolean }) => void;
    auth.loginWithGoogle.mockReturnValue(new Promise((r) => (resolve = r)));
    renderLogin();

    act(() => google.options!.onSuccess({ code: 'auth-code' }));

    expect(await screen.findByText('Verificando acesso...')).toBeInTheDocument();
    expect(auth.loginWithGoogle).toHaveBeenCalledWith({ code: 'auth-code' });
    resolve({});
    expect(await screen.findByText('home')).toBeInTheDocument();
  });

  it('leva à escolha de painel no login dual', async () => {
    auth.loginWithGoogle.mockResolvedValue({ needsPanelSelection: true });
    renderLogin();
    act(() => google.options!.onSuccess({ code: 'auth-code' }));
    expect(await screen.findByText('escolher painel')).toBeInTheDocument();
  });

  it('mostra a mensagem da API quando o e-mail não está cadastrado', async () => {
    auth.loginWithGoogle.mockRejectedValue({
      response: { data: { message: 'Nenhum profissional cadastrado com este e-mail.' } },
    });
    renderLogin();
    act(() => google.options!.onSuccess({ code: 'auth-code' }));
    expect(await screen.findByText('Nenhum profissional cadastrado com este e-mail.')).toBeInTheDocument();
    await waitFor(() => expect(button()).toBeEnabled());
  });

  it('mostra o aviso de clínica suspensa', async () => {
    auth.loginWithGoogle.mockRejectedValue({
      response: { data: { error: 'TENANT_SUSPENDED', message: 'Clínica X suspensa.' } },
    });
    renderLogin();
    act(() => google.options!.onSuccess({ code: 'auth-code' }));
    expect(await screen.findByText('Clínica suspensa')).toBeInTheDocument();
    expect(screen.getByText('Clínica X suspensa.')).toBeInTheDocument();
  });

  it('explica popup bloqueado e ignora popup fechado pelo usuário', async () => {
    renderLogin();
    act(() => google.options!.onNonOAuthError({ type: 'popup_closed' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => google.options!.onNonOAuthError({ type: 'popup_failed_to_open' }));
    expect(await screen.findByText(/permita pop-ups/i)).toBeInTheDocument();
  });

  it('não trata cancelamento no consentimento como erro, mas mostra outros erros OAuth', async () => {
    renderLogin();
    act(() => google.options!.onError({ error: 'access_denied' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => google.options!.onError({ error: 'server_error' }));
    expect(await screen.findByText(/erro ao conectar com o google/i)).toBeInTheDocument();
  });

  it('avisa sobre bloqueador quando o script do Google não carregou', async () => {
    google.loaded = false;
    renderLogin();
    await userEvent.click(button());
    expect(google.requestCode).not.toHaveBeenCalled();
    expect(screen.getByText(/desative bloqueadores/i)).toBeInTheDocument();
  });
});
