/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_ADMIN_CONTACT_EMAIL?: string;
  readonly VITE_CLINIC_APP_URL?: string;
  readonly VITE_ADMIN_CONSOLE_URL?: string;
  readonly VITE_ADMIN_ROUTE_PREFIX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
