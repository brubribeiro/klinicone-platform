/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_ADMIN_CONTACT_EMAIL?: string;
  /** Ambiente lógico: `dev` | `development` | `staging` | `prod` | `production`. */
  readonly VITE_APP_ENV?: string;
  /** Painel da clínica (URL completa via env; sem default de host). Alias legado: `VITE_CLINIC_APP_URL`. */
  readonly VITE_APP_URL?: string;
  readonly VITE_CLINIC_APP_URL?: string;
  /** Console admin (URL completa via env). Alias legado: `VITE_ADMIN_CONSOLE_URL`. */
  readonly VITE_ADMIN_URL?: string;
  readonly VITE_ADMIN_CONSOLE_URL?: string;
  /** Landing (URL completa via env). */
  readonly VITE_LANDING_URL?: string;
  readonly VITE_ADMIN_ROUTE_PREFIX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
