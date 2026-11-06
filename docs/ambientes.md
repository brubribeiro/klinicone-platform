# Ambientes KlinicOne (dev / prod)

Dois ambientes separados: **dev/staging** e **produção**. Criar os serviços (Supabase, Render, Vercel, DNS, OAuth) é passo manual — este repo só documenta e lê variáveis de ambiente.

## Hosts

| Papel | Dev / staging | Produção |
|-------|---------------|----------|
| Landing | `dev.klinicone.com.br` | `klinicone.com.br` (+ `www`) |
| Painel da clínica | `app.dev.klinicone.com.br` | `app.klinicone.com.br` |
| Console KlinicOne | `admin.dev.klinicone.com.br` | `admin.klinicone.com.br` |
| API | `api.dev.klinicone.com.br` | `api.klinicone.com.br` |

Local: API `3333`, Painel da clínica `5173`, landing `5174`, Console KlinicOne `5175`.

## Fluxo de entrega

```text
PR → develop  →  deploy/teste em *.dev  →  PR develop → main  →  produção
```

1. Abra o PR contra `develop` (ou `release/*` durante a onda de release).
2. CI (GitHub Actions) roda lint, TypeScript, testes e `prisma migrate deploy` num Postgres descartável.
3. Após merge em `develop`, valide em `app.dev` / `admin.dev` / `api.dev`.
4. Abra PR `develop` → `main` para promover a produção.

Não rode seed demo no start da API de produção. Versão (`VERSION`) só sobe quando a Bruna pedir.

## Variáveis (só por env)

| Variável | Onde | Notas |
|----------|------|--------|
| `APP_ENV` | Backend | `development` / `staging` → health `env: "dev"`; `production` → `"prod"` |
| `NODE_ENV` | Backend | Em staging no Render pode ser `production` (perf) com `APP_ENV=development` |
| `CORS_ORIGIN` | Backend | Obrigatório; vários hosts separados por vírgula |
| `GOOGLE_CLIENT_ID` | Backend + fronts (`VITE_`) | Client OAuth **do ambiente** (autorizar os hosts da tabela) |
| `VITE_APP_ENV` | Fronts | `development` / `staging` → `dev`; `production` → `prod` (alinha com o health da API; sem faixa na UI) |
| `VITE_API_URL` / `VITE_APP_URL` / `VITE_ADMIN_URL` / `VITE_LANDING_URL` | Fronts | Sem host default no código |

Exemplos por bloco: `backend/.env.example`, `frontend/.env.example`, `apps/landing/.env.example`, `apps/admin-console/.env.example`.

`GET /api/health` responde `{ status, version, env }` com `env` em `dev` \| `prod`.

## Seed demo

```bash
cd backend && npm run prisma:seed:demo
```

Recusa produção (`APP_ENV` / `NODE_ENV`). Banco remoto só com `APP_ENV=development` (ou `staging`). Não entra no `startCommand` do Render nem em `npm run start:prod`.

## Passos manuais (fora do repo)

1. **Supabase (ou Postgres) de dev** — projeto/banco separado do de prod; copiar `DATABASE_URL` / `DIRECT_URL` no Render de staging.
2. **Render** — serviço da API na branch `develop` (ex.: `api.dev`); `APP_ENV=development`, `CORS_ORIGIN` com os hosts `*.dev`, OAuth e R2 de staging. Prod continua na branch de produção com `APP_ENV=production`.
3. **Vercel** — três projetos (landing, painel, admin); produção nas branches/domínio apex; preview ou projeto/branch `develop` nos hosts `*.dev` com `VITE_APP_ENV=development` e URLs `*.dev`.
4. **OAuth Google** — client (ou credenciais) de dev com origins/redirects `*.dev` e localhost; client de prod só com hosts de produção.
5. **DNS** — registros para `dev`, `app.dev`, `admin.dev`, `api.dev` apontando aos serviços de staging.

Detalhes de install local: `README.md`.
