/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_ADMIN_CONTACT_EMAIL?: string;
  /** Painel da clínica (`https://app.klinicone.com.br`). Alias legado: `VITE_CLINIC_APP_URL`. */
  readonly VITE_APP_URL?: string;
  readonly VITE_CLINIC_APP_URL?: string;
  /** Console admin (`https://admin.klinicone.com.br`). Alias legado: `VITE_ADMIN_CONSOLE_URL`. */
  readonly VITE_ADMIN_URL?: string;
  readonly VITE_ADMIN_CONSOLE_URL?: string;
  /** Landing (`https://klinicone.com.br`). */
  readonly VITE_LANDING_URL?: string;
  readonly VITE_ADMIN_ROUTE_PREFIX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
