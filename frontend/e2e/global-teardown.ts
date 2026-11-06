import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));

/** Apaga a clínica criada no global-setup (E2E_KEEP_DATA=1 mantém para depurar). */
export default function globalTeardown() {
  const file = path.resolve(e2eDir, '.auth/session.json');
  if (process.env.E2E_KEEP_DATA || !existsSync(file)) return;
  const { tenantId } = JSON.parse(readFileSync(file, 'utf8'));
  execFileSync('npx', ['ts-node', '--transpile-only', 'test/e2e/e2e-session.ts', '--purge', tenantId], {
    cwd: path.resolve(e2eDir, '../../backend'),
    stdio: 'inherit',
  });
}
