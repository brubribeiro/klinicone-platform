import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../api/client';
import type { User } from '../types';
import { adminConsoleUrl, clinicPanelUrl } from '../utils/appUrls';
import { appPath } from '../utils/appPath';

type LoginResult = { needsPanelSelection?: boolean };

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** `code`: fluxo auth-code do botão próprio; `credential`: ID token (compatibilidade). */
  loginWithGoogle: (google: { code: string } | { credential: string }) => Promise<LoginResult>;
  selectPanel: (panel: 'clinic' | 'admin') => Promise<void>;
  impersonate: (userId: string) => Promise<void>;
  /** Super-admin: entra numa clínica como administrador (modo "visualizando como"). */
  enterTenant: (tenantId: string) => Promise<void>;
  stopImpersonating: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sessão vem do cookie HttpOnly; tenta hidratar via /auth/me
    api
      .get<User>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function handleLoginResponse(data: { user: User }) {
    try {
      const me = await api.get<User>('/auth/me');
      setUser(me.data);
    } catch {
      setUser(data.user);
    }
  }

  async function loginWithGoogle(google: { code: string } | { credential: string }): Promise<LoginResult> {
    const { data } = await api.post<{ access_token: string; user: User; needsPanelSelection?: boolean }>(
      '/auth/google',
      google,
    );
    await handleLoginResponse(data);
    return { needsPanelSelection: data.needsPanelSelection };
  }

  async function selectPanel(panel: 'clinic' | 'admin') {
    const { data } = await api.post<{ access_token: string; user: User }>('/auth/select-panel', { panel });
    await handleLoginResponse(data);
  }

  async function impersonate(userId: string) {
    // Backend move o cookie atual para admin_token e seta o novo access_token (HttpOnly)
    const { data } = await api.post<{ access_token: string; user: User }>(
      `/auth/impersonate/${userId}`,
    );
    try {
      const me = await api.get<User>('/auth/me');
      setUser(me.data);
    } catch {
      setUser(data.user);
    }
  }

  async function enterTenant(tenantId: string) {
    await api.post<{ access_token: string }>(`/admin/tenants/${tenantId}/enter`);
    const me = await api.get<User>('/auth/me');
    setUser(me.data);
  }

  async function stopImpersonating() {
    const wasSuperAdmin = !!user?.isSuperAdmin;
    const tenantId = user?.tenantId;
    try {
      await api.post('/auth/stop-impersonating');
    } catch {
      return;
    }
    window.location.href =
      wasSuperAdmin && tenantId ? adminConsoleUrl(`/clinicas/${tenantId}`) : clinicPanelUrl('/');
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Mesmo se a API falhar, limpa o estado local e redireciona
    }
    setUser(null);
    window.location.href = appPath('/login');
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, loginWithGoogle, selectPanel, impersonate, enterTenant, stopImpersonating, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
