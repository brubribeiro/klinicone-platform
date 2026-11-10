# Smoke E2E (Playwright)

Um teste (`smoke.e2e.ts`): abre a agenda com a paciente escolhida, cria o agendamento,
abre o evento, marca **Concluído**, escolhe a forma de pagamento e confere pela API que o
atendimento ficou concluído com a receita lançada.

## Como roda

- `global-setup.ts` chama `backend/test/e2e/e2e-session.ts`, que cria uma clínica descartável
  (admin, paciente, procedimento, forma de pagamento) direto no banco e assina um JWT do admin
  com o `JWT_SECRET` do backend. O login real é só Google; aqui a sessão vai no cookie
  `access_token`.
- `global-teardown.ts` apaga a clínica no fim (`E2E_KEEP_DATA=1` mantém para depurar).
- O `webServer` do `playwright.config.ts` sobe backend (`nest start`, 3333) e painel (Vite, 5173)
  se ainda não estiverem rodando (o painel em build de produção + `vite preview`). `E2E_BASE_URL` aponta para um painel já no ar e não sobe nada.

## Local

Pré-requisitos: Postgres com migrations (`backend/.env`, `npx prisma migrate deploy`).

```bash
cd frontend
npx playwright install chromium   # uma vez
npm run test:e2e
```

`PW_CHROMIUM_PATH=/caminho/do/chromium` usa um Chromium já instalado.

## CI

O workflow pronto está em `docs/ci/e2e.yml`: copie para `.github/workflows/e2e.yml`.
