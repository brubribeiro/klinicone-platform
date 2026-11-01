// Ignored Build Step da Vercel (`ignoreCommand` no vercel.json de cada app).
// Roda no Root Directory do projeto (frontend/, apps/landing/ ou apps/admin-console/).
// Saída 0 = pular o build; 1 = construir.
//
// Constrói só quando mudou algo que o app usa: a própria pasta, os arquivos de fora dela
// que o código importa (ex.: apps/* importam de frontend/src), os manifests da raiz e os
// caminhos extras passados como argumento (ex.: ../VERSION no painel da clínica).
// Opcional: VERCEL_BUILD_BRANCHES="main,master" pula o build em qualquer outra branch.
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appDir = process.cwd();
const extraPaths = process.argv.slice(2).map((p) => resolve(appDir, p));

const build = (reason) => {
  console.log(`Build: ${reason}`);
  process.exit(1);
};
const skip = (reason) => {
  console.log(`Skip: ${reason}`);
  process.exit(0);
};

const branch = process.env.VERCEL_GIT_COMMIT_REF;
const allowedBranches = (process.env.VERCEL_BUILD_BRANCHES ?? '')
  .split(',')
  .map((b) => b.trim())
  .filter(Boolean);
if (branch && allowedBranches.length && !allowedBranches.includes(branch)) {
  skip(`branch ${branch} fora de VERCEL_BUILD_BRANCHES`);
}

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const base = process.env.VERCEL_GIT_PREVIOUS_SHA || 'HEAD^';
let changed;
try {
  git('cat-file', '-e', `${base}^{commit}`);
  changed = git('diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean);
} catch {
  build(`commit base ${base} indisponível no clone`);
}

const SRC_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
const RESOLVE_EXT = ['', ...SRC_EXT, ...SRC_EXT.map((e) => `/index${e}`)];
const IMPORT_RE = /(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g;

const sourceFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist') return [];
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return SRC_EXT.some((e) => name.endsWith(e)) ? [full] : [];
  });

const resolveImport = (from, spec) => {
  const base = resolve(dirname(from), spec);
  for (const ext of RESOLVE_EXT) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
};

// Fecho dos imports relativos a partir do código do app, para achar o que ele usa fora da pasta.
const used = new Set();
const queue = sourceFiles(appDir);
while (queue.length) {
  const file = queue.pop();
  if (used.has(file)) continue;
  used.add(file);
  if (!SRC_EXT.some((e) => file.endsWith(e))) continue;
  for (const [, spec] of readFileSync(file, 'utf8').matchAll(IMPORT_RE)) {
    const target = resolveImport(file, spec);
    if (target && !used.has(target)) queue.push(target);
  }
}

const watched = [appDir, ...extraPaths, join(root, 'package.json'), join(root, 'package-lock.json'), fileURLToPath(import.meta.url)];
const isWatched = (file) => {
  const abs = join(root, file);
  return used.has(abs) || watched.some((w) => abs === w || abs.startsWith(`${w}/`));
};

const hit = changed.find(isWatched);
if (hit) build(`${hit} mudou desde ${base.slice(0, 7)}`);
skip(`nada de ${relative(root, appDir) || '.'} mudou desde ${base.slice(0, 7)}`);
