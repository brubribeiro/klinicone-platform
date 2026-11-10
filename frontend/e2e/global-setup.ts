import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));

/** Cria a clínica descartável no banco (backend/test/e2e/e2e-session.ts) e grava o cookie de sessão. */
export default function globalSetup() {
  const backendDir = path.resolve(e2eDir, '../../backend');
  const out = execFileSync('npx', ['ts-node', '--transpile-only', 'test/e2e/e2e-session.ts'], {
    cwd: backendDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const session = JSON.parse(out.slice(out.indexOf('{')));
  const authDir = path.resolve(e2eDir, '.auth');
  mkdirSync(authDir, { recursive: true });
  writeFileSync(path.join(authDir, 'session.json'), JSON.stringify(session, null, 2));

  const baseUrl = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:5173');
  const host = baseUrl.hostname;
  // Tours guiados abrem sozinhos 800 ms após a primeira visita e cobririam o formulário
  const seenTours = ['agenda', 'dashboard'].map((key) => ({
    name: `mila.tourSeen.${session.professional.id}.${key}`,
    value: new Date().toISOString(),
  }));
  writeFileSync(
    path.join(authDir, 'state.json'),
    JSON.stringify({
      cookies: [
        {
          name: 'access_token',
          value: session.token,
          domain: host,
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 3600,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [{ origin: baseUrl.origin, localStorage: seenTours }],
    }),
  );
}
