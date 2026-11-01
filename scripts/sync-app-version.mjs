import { readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

// Versão própria de um app em apps/ (landing, admin-console): apps/<app>/VERSION → apps/<app>/package.json.
// Não mexe no VERSION da raiz nem em frontend/backend.
const appDir = resolve(process.argv[2] ?? '.');
const version = readFileSync(join(appDir, 'VERSION'), 'utf8').trim();

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid VERSION format in ${appDir}: "${version}" (expected MAJOR.MINOR.PATCH)`);
  process.exit(1);
}

const pkgPath = join(appDir, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`Synced ${pkg.name} version ${version}`);
