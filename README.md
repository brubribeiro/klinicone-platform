# KlinicOne — Plataforma de Gestão

Plataforma fullstack (SaaS) para clínicas de estética e saúde: agenda, pacientes, procedimentos, financeiro e estoque.

**Hosts de produção:** landing `klinicone.com.br` (+www), painel `app.klinicone.com.br`, admin `admin.klinicone.com.br`, API opcional `api.klinicone.com.br`.

## Stack

**Backend**
- NestJS 10 (Node + TypeScript)
- Prisma ORM
- PostgreSQL 16
- JWT + Passport (autenticação)
- class-validator (validação de DTOs)

**Frontend**
- React 18 + Vite + TypeScript
- Material UI (MUI) 5 com tema customizado (rosé gold)
- React Router 6
- TanStack Query (cache de dados)
- Axios

**Infra local**
- Docker Compose (PostgreSQL + Adminer)

## Estrutura

```
klinicone-platform/
├── backend/                NestJS API
│   ├── prisma/
│   │   ├── schema.prisma   Modelos do banco
│   │   └── seed.ts         Admin, procedimentos, pacientes demo, despesas recorrentes exemplo
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── prisma/         Prisma service global
│       ├── auth/           Google OAuth + JWT, guard, strategy
│       ├── users/          Usuários do sistema
│       ├── patients/       Pacientes (CRUD + busca)
│       ├── appointments/   Agendamentos
│       ├── procedures/     Procedimentos / serviços
│       ├── finance/        Lançamentos + summary
│       └── inventory/      Itens + movimentações
├── frontend/               React + Vite + MUI
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── theme/          Tema MUI customizado
│       ├── api/            Cliente axios + interceptors
│       ├── contexts/       AuthContext (login/logout)
│       ├── components/     Layout, PrivateRoute, PageHeader
│       └── pages/          Login, Dashboard + 5 módulos
├── apps/
│   ├── landing/            Site público (/) — VERSION própria
│   └── admin-console/      Console super-admin — VERSION própria
├── docker-compose.yml      PostgreSQL + Adminer
└── README.md
```

## Setup inicial

### 1. Subir o banco

```bash
docker compose up -d
```

Postgres em `localhost:5432` (user `klinicone`, pass `klinicone`, db `klinicone_platform` — só defaults locais).
Adminer (interface web do banco) em `http://localhost:8080`.

### 2. Backend

```bash
cd backend
cp .env.example .env       # JWT_SECRET + GOOGLE_CLIENT_ID (mesmo Client ID do frontend)
npm install
npx prisma migrate dev     # cria as tabelas
npm run prisma:seed        # usuários demo, procedimentos, despesas recorrentes de exemplo, etc.
npm run start:dev          # API em http://localhost:3333/api
```

**Credenciais padrão do seed:** `admin@mila.com` / `admin123`

**Dados de demonstração (só ambiente local):** para preencher as telas vazias (pacientes, agenda, pacotes vendidos, promoções, estoque, equipamentos, financeiro, metas, documentos, pendências, rotinas de skincare etc.), rode depois das migrations:

```bash
npm run prisma:seed:demo
```

Roda o seed principal e os seeds de pacientes, pacotes e promoções, e completa o que faltava, tudo com dados fictícios na clínica `TENANT_SLUG` (padrão `mila-barreto`). É idempotente (pode rodar de novo sem duplicar) e não cria arquivos (sem R2). Recusa rodar com `NODE_ENV=production` ou se `DATABASE_URL`/`DIRECT_URL` não apontar para `localhost`. Não faz parte do `prisma:seed` usado no deploy.

### 3. Frontend

```bash
cd frontend
cp .env.example .env       # VITE_GOOGLE_CLIENT_ID (OAuth Web Client do Google Cloud)
npm install
npm run dev                # http://localhost:5173
```

#### Rodar todos os apps juntos

Na raiz, `npm run dev` sobe a API e os três apps Vite (saída prefixada por `[backend]`, `[landing]`, `[clinic]`, `[admin]`):

| App | URL local | Só este app |
|-----|-----------|-------------|
| API (NestJS, `/api`) | http://localhost:3333/api | `npm run dev:backend` |
| Landing pública (`/`) | http://localhost:5174 | `npm run dev:landing` |
| Painel da clínica (`/`) | http://localhost:5173 | `npm run dev:clinic` |
| Console super-admin | http://localhost:5175 | `npm run dev:admin` |

```bash
npm install                                                 # na raiz: workspaces (frontend, apps/*)
cp apps/landing/.env.example apps/landing/.env              # VITE_APP_URL: botão "Entrar" leva ao painel
cp apps/admin-console/.env.example apps/admin-console/.env  # VITE_APP_URL: volta ao painel da clínica
npm run dev
```

Sem os `.env` das apps, o link "Entrar" da landing aponta para a própria landing (o painel fica em 5173). Se uma das portas estiver ocupada, o Vite escolhe outra sem avisar: confira a URL que aparece no log. Se a API parar, o `concurrently` encerra os demais (`-k`).

### 4. Autenticação (Google)

O painel **não** tem login por e-mail/senha. O fluxo é:

1. O usuário clica em **Entrar com o Google** na tela de login (`@react-oauth/google`).
2. O frontend envia o ID token (`credential`) para `POST /api/auth/google`.
3. O backend valida o token com `GOOGLE_CLIENT_ID`, localiza o usuário pelo **e-mail** do Google e devolve um JWT.
4. Nas requisições seguintes, o frontend envia `Authorization: Bearer <token>`; ao abrir o app, `GET /api/auth/me` hidrata o contexto.

**Variáveis:** `GOOGLE_CLIENT_ID` no backend e `VITE_GOOGLE_CLIENT_ID` no frontend devem ser o **mesmo** Client ID (tipo *Web application* no [Google Cloud Console](https://console.cloud.google.com/apis/credentials)). Opcional: `VITE_ADMIN_CONTACT_EMAIL` para o link “Fale com o administrador”.

**Desenvolvimento local:** o seed cria usuários de exemplo **só pelo e-mail** (ex.: `admin@mila.com` — ver tabela em [Usuários de exemplo](#usuários-de-exemplo-seed)). Para entrar, a conta Google precisa ter um e-mail **já cadastrado** na tabela `User`. Ajuste os e-mails no `prisma/seed.ts` para um endereço que você controla no Google, ou altere o registro no banco após o seed. O seed ainda grava hash de senha no banco por compatibilidade histórica; **a API não expõe login por senha** — em produção o acesso é exclusivamente Google para e-mails autorizados pela clínica.

## Comandos úteis

**Backend**
- `npm run start:dev` - desenvolvimento com watch
- `npm run build` - build de produção
- `npx prisma studio` - interface web do Prisma para o banco
- `npx prisma migrate dev --name <nome>` - nova migration

> **Atualizou o schema?** Sempre que `prisma/schema.prisma` mudar, rode `npx prisma migrate dev --name <descricao>` para aplicar a migration e regenerar o client. Exemplo: após adicionar a tabela `procedure_materials`, rode `npx prisma migrate dev --name add_procedure_materials`.

**Frontend** (painel da clínica; na raiz, `npm run dev` sobe todos os apps)
- `npm run dev` - dev server do painel (http://localhost:5173)
- `npm run build` - build de produção (gera `dist/`)
- `npm run preview` - servir build

## Apps, versões e deploy (Vercel)

O front é um monorepo npm (`workspaces` no `package.json` da raiz) com três apps Vite, cada um com deploy e versão próprios:

| App | Pasta | Versão | Sync da versão | Dev |
|-----|-------|--------|----------------|-----|
| Painel da clínica (`app.*`, `/`) | `frontend/` | `VERSION` da raiz (junto com o backend) | `npm run version:sync` | `npm run dev:clinic` (5173) |
| Landing pública (apex, `/`) | `apps/landing/` | `apps/landing/VERSION` | `npm run version:sync:landing` | `npm run dev:landing` (5174) |
| Console super-admin | `apps/admin-console/` | `apps/admin-console/VERSION` | `npm run version:sync:admin` | `npm run dev:admin` (5175) |

`npm run dev` na raiz sobe backend + os três apps. A versão de cada app aparece no próprio app (rodapé da landing; login e escolha de painel do console admin; login da clínica).

**Versões:** mudança só em `apps/landing` ou `apps/admin-console` **não** bumpa o `VERSION` da raiz nem entra no `RELEASE_NOTES.md` das clínicas — se for o caso, bumpe só o `VERSION` do app e rode o sync dele. O `npm run version:sync` da raiz atualiza só raiz, `frontend/` e `backend/`. O backend do console (`backend/src/admin/`) continua versionando com o backend (`VERSION` da raiz).

**Código compartilhado:** `apps/*` importam tema, contextos, API e páginas comuns (login, escolher painel) de `frontend/src`. O que é só do console fica em `apps/admin-console/src`; o que é só da landing, em `apps/landing/src`. Mexer em código compartilhado de `frontend/src` é mudança do painel (versão da raiz) e reconstrói os apps que o importam.

**Vercel — três projetos**, mesmo repositório, um por app:

| Projeto | Root Directory | Build | Output |
|---------|----------------|-------|--------|
| Painel da clínica | `frontend` | `npm run build` | `dist` |
| Landing | `apps/landing` | `npm run build` | `dist` |
| Console admin | `apps/admin-console` | `npm run build` | `dist` |

Em cada projeto deixe ligado **Include files outside the Root Directory** (os apps importam de `frontend/src` e de `scripts/`). O `vercel.json` de cada app define o **Ignored Build Step** (`ignoreCommand`), que tem precedência sobre o campo da tela: `scripts/vercel-ignore-build.mjs` compara o commit com o último deploy (`VERCEL_GIT_PREVIOUS_SHA`, ou `HEAD^`) e só constrói se mudou a pasta do app, um arquivo de fora que o código dele importa, `package.json`/`package-lock.json` da raiz ou, no painel, o `VERSION` da raiz. Assim o painel não reconstrói por mudança em `apps/*`, e landing/admin não reconstroem por mudança no painel que não usam. Para construir só certas branches (ex.: produção), defina `VERCEL_BUILD_BRANCHES=main,master` nas variáveis do projeto. Variáveis de URL entre apps: `VITE_APP_URL`, `VITE_ADMIN_URL` e `VITE_LANDING_URL` (aliases legados `VITE_CLINIC_APP_URL` / `VITE_ADMIN_CONSOLE_URL` ainda lidos; ver `.env.example` de cada app). Domínios padrão: `klinicone.com.br`, `app.klinicone.com.br`, `admin.klinicone.com.br`.

## Modelos de dados (resumo)

| Modelo            | Descrição                                                    |
|-------------------|--------------------------------------------------------------|
| User              | Usuários do sistema (ADMIN, PROFESSIONAL, RECEPTIONIST)      |
| Patient           | Pacientes com anamnese em JSON                               |
| Procedure         | Catálogo de procedimentos (nome, duração, preço)             |
| Appointment       | Agendamentos vinculando paciente, procedimento, profissional |
| FinancialEntry    | Lançamentos de receita/despesa, opcionalmente vinculados     |
| InventoryItem     | Itens de estoque com validade e estoque mínimo               |
| InventoryMovement | Entradas/saídas/ajustes com transação atômica                |

## Endpoints principais

```
POST /api/auth/google                 Login com ID token do Google (body: { credential })
GET  /api/auth/me                     Dados do usuário logado (JWT)
POST /api/auth/impersonate/:userId    Personificar outro usuário (admin)

GET  /api/users                       Listar usuários
POST /api/users                       Criar usuário

GET  /api/patients?search=...         Listar/buscar pacientes
POST /api/patients                    Criar paciente
GET  /api/patients/:id                Detalhe + últimos agendamentos

GET  /api/appointments?from=&to=      Agenda no intervalo
POST /api/appointments                Criar agendamento

GET  /api/procedures                  Listar procedimentos
POST /api/procedures                  Criar procedimento

GET  /api/finance?from=&to=           Lançamentos no período
GET  /api/finance/summary?from=&to=   Totais (income, expense, balance)
POST /api/finance                     Criar lançamento

GET  /api/inventory                   Listar itens
POST /api/inventory/:id/movements     Entrada/saída/ajuste de estoque
```

Todos os endpoints (exceto `POST /auth/google`) exigem `Authorization: Bearer <token>`.

## Módulos implementados

- **Dashboard** - cards de resumo (adaptam-se ao papel do usuário): agendamentos do dia, total de pacientes, faturamento do mês (só admin), itens em baixa.
- **Pacientes** - listagem com `@mui/x-data-grid`, busca por nome/email/telefone, dialog de cadastro/edição com `react-hook-form` e drawer lateral com ficha completa.
- **Agenda** - calendário full screen (`@fullcalendar/react`) com visões dia/semana/mês, criação por clique no slot ou botão, preview de materiais que serão deduzidos do estoque ao salvar. Profissionais veem apenas a própria agenda.
- **Procedimentos** - CRUD com DataGrid, formulário com nome, duração, preço, descrição, toggle ativo/inativo e lista de materiais necessários.
- **Financeiro** - cards de receita/despesa/saldo, gráfico de barras diário (`recharts`), tabela filtrável, dialog de lançamento.
- **Estoque** - DataGrid com indicadores de baixo estoque e validade próxima, dialog de cadastro e dialog dedicado de movimentação. Recebe movimentações automáticas quando agendamentos são criados/cancelados.
- **Profissionais** - gestão de usuários da plataforma com grupos customizáveis e controle de acesso enforcement no backend.
- **Notificações** - sininho com badge na topbar, polling a cada 30s. Dialog de preferências permite ligar/desligar cada tipo individualmente.
- **Mensagens (templates)** - catálogo de modelos de WhatsApp com variáveis `{paciente_nome}`, `{procedimento}`, `{data}`, `{hora}`, `{profissional}`.
- **Horários e indisponibilidade** - horário semanal de atendimento por profissional + bloqueios pontuais (folga/férias).

## Novidades v3

- **Bloqueio de agenda por indisponibilidade** — backend valida que o horário escolhido não cai em uma `Unavailability` do profissional nem fora do `WorkingHours` semanal, e bloqueia conflitos com outros agendamentos ativos. Mensagem clara de erro retornada.
- **Exportar lista de baixo estoque** — botão "Exportar baixo estoque" na página Estoque gera CSV com BOM UTF-8 (Excel reconhece acentos).
- **Procedimento opcional em Avaliação/Retorno** — campo "Procedimento" some no dialog de agendamento quando o tipo é EVALUATION ou RETURN; backend aceita `procedureId` nulo para esses casos (e exige para PROCEDURE).
- **Despesas fixas e variáveis** — novo enum `ExpenseType` (FIXED/VARIABLE) em `FinancialEntry`. Quando o tipo do lançamento é DESPESA, aparece um seletor "Tipo de despesa".
- **Atalho para nova consulta na dashboard** — botão "Novo agendamento" no header da dashboard leva direto para `/agenda`.
- **Upload de documentos** — módulo `Documentos` com upload via Multer (limite 25MB, armazenamento local em `backend/uploads/`). Documentos podem ser vinculados a paciente ou equipamento. Download autenticado via blob.
- **Equipamentos com manutenção** — módulo `Equipamentos` com cadastro, intervalo de manutenção em meses (calcula próxima automaticamente), botão "Registrar manutenção" que atualiza última e recalcula próxima, alerta visual de manutenções vencidas ou próximas (≤30 dias).
- **Materiais fracionados** — `quantity` em `InventoryItem`, `ProcedureMaterial` e `InventoryMovement` agora são `Decimal(12,3)`. Permite cadastrar quantidades como `2.5 ml` ou `0.5 g`. UI ajustada.
- **Bloqueio frontend de agendamento com material faltando** — quando o procedimento selecionado tem material com estoque insuficiente, o botão Salvar fica desabilitado e um alerta vermelho explica.

### Como aplicar v3

```bash
cd backend
npm install               # instala multer e tipos
npx prisma migrate dev --name add_equipment_documents_decimal
# responde 'y' para reset
npm run prisma:seed
npm run start:dev
```

A pasta `backend/uploads/` é criada automaticamente no primeiro upload — adicione-a ao `.gitignore`.

## Novidades v2

- **Custo base por procedimento** - calculado automaticamente a partir do custo dos materiais cadastrados.
- **Lançamento financeiro automático** - quando um agendamento vira COMPLETED, um `FinancialEntry` do tipo INCOME é criado vinculado ao agendamento.
- **Controle de notas de serviço** - flag `invoiceIssued` por lançamento, com filtro "pendentes" e contador no card do financeiro.
- **Dashboard com seletor de período** - alternar entre mês completo ou intervalo customizado (padrão = mês atual).
- **Tipo de agendamento** - cada appointment tem `kind`: Avaliação / Procedimento / Retorno (mostrado como tag no calendário).
- **Sugestão de retorno** - ao marcar agendamento como Concluído, dialog oferece criar agendamento de retorno usando `recurrenceDays` do procedimento.
- **Anotações clínicas no atendimento** - campo `clinicalNotes` separado das observações administrativas.
- **Validação e máscara de CPF** - input com máscara `000.000.000-00` e validação do algoritmo dos dígitos verificadores.
- **Máscara de telefone** - input com máscara `(00) 00000-0000`.
- **WhatsApp em pacientes e agenda** - botão verde abre dialog para escolher template, ajustar mensagem e abrir WhatsApp Web já preenchido.
- **Botão de confirmação na agenda** - usa template da categoria `confirmacao` por padrão.
- **Horário semanal por profissional** - definir início/término por dia da semana.
- **Indisponibilidades (folga/férias)** - cadastrar intervalos bloqueados na agenda.

## Controle de acesso (RBAC dinâmico)

A plataforma usa um sistema de **grupos customizáveis** com permissões granulares. Os admins podem criar quantos grupos quiserem (ex: "Esteticista", "Gerente", "Caixa") e escolher exatamente o que cada um pode **visualizar**, **criar**, **editar** e **excluir** em cada módulo.

### Permissões disponíveis

São 7 recursos × 4 ações = **28 permissões granulares**:

| Recurso              | Permissões                                       |
|----------------------|--------------------------------------------------|
| Pacientes            | `patients:view`, `:create`, `:edit`, `:delete`   |
| Agendamentos         | `appointments:view`, `:create`, `:edit`, `:delete` |
| Procedimentos        | `procedures:view`, `:create`, `:edit`, `:delete` |
| Financeiro           | `finance:view`, `:create`, `:edit`, `:delete`    |
| Estoque              | `inventory:view`, `:create`, `:edit`, `:delete`  |
| Profissionais        | `users:view`, `:create`, `:edit`, `:delete`      |
| Grupos / Permissões  | `roles:view`, `:create`, `:edit`, `:delete`      |

Cada grupo também tem uma flag **"Restringir à própria agenda"**: quando ativa, usuários desse grupo só veem/editam seus próprios agendamentos (e só podem alterar status/notas — não data ou procedimento).

### Grupos do sistema (criados pelo seed)

| Nome           | Permissões                                                                       | Flag agenda |
|----------------|----------------------------------------------------------------------------------|-------------|
| Administrador  | Todas as 28                                                                      | —           |
| Profissional   | patients view/edit, appointments view/edit, procedures/inventory view             | ✓ própria   |
| Recepção       | patients CRUD, appointments CRUD, procedures/inventory view, inventory create/edit | —           |

Grupos do sistema **não podem ser excluídos** (têm `isSystem=true`). O grupo "Administrador" não pode ter permissões removidas (evita perder acesso ao sistema). Outros grupos do sistema podem ter permissões editadas livremente.

### Como funciona tecnicamente

**Backend** (`backend/src/common/`):
- `@RequirePermissions('patients:create')` em rotas exige a permissão indicada. Sem decorator, qualquer autenticado passa (ex: `/users/active` para dropdowns).
- `PermissionsGuard` lê o metadata da rota e compara com `req.user.permissions` (carregado fresh do banco em cada request pelo `JwtStrategy.validate`).
- `@CurrentUser()` injeta o usuário com `permissions[]` e `restrictToOwnAppointments`.
- `AppointmentsService` filtra automaticamente por `professionalId` quando `user.restrictToOwnAppointments` for true.
- `RolesService` valida permissões contra `ALL_PERMISSIONS` antes de salvar (rejeita strings inválidas).

**Frontend** (`frontend/src/contexts/`):
- `permissions.ts` exporta o catálogo de RESOURCES e ACTIONS.
- `usePermissions().has('patients:create')` checa se a permissão está no `user.permissions`.
- `<PermissionRoute permission="finance:view">` protege rotas inteiras.
- A página `/grupos` permite criar/editar/excluir grupos com uma matriz visual (7 linhas × 4 colunas de checkboxes, com botões "todos da linha" e "todos da coluna").

### Usuários de exemplo (seed)

E-mails criados no banco para **dev local** (login via Google quando o e-mail da conta coincidir):

| E-mail                  | Grupo          |
|-------------------------|----------------|
| `admin@mila.com`        | Administrador  |
| `profissional@mila.com` | Profissional   |
| `recepcao@mila.com`     | Recepção       |

### Migration

Após puxar o código novo, **resete o banco** para aplicar o schema novo (Role table, User.roleId):

```bash
cd backend
npx prisma migrate reset --force
npm run prisma:seed
```

⚠ `migrate reset` apaga **todos os dados** (era usado para dev). O seed recria os 3 grupos, 3 usuários e 4 procedimentos de exemplo.

## Notificações

A plataforma tem notificações **in-app** disparadas automaticamente por eventos do sistema. O sininho fica na topbar, com badge mostrando a contagem de não lidas. Click → dropdown com últimas 10. Click em uma notificação marca como lida e navega para o link relacionado.

### Tipos disparados atualmente

| Tipo                    | Quando dispara                                      | Quem recebe                             |
|-------------------------|-----------------------------------------------------|-----------------------------------------|
| `APPOINTMENT_CREATED`   | Novo agendamento ativo criado                       | Profissional designado                  |
| `APPOINTMENT_CANCELLED` | Agendamento muda para status CANCELADO              | Profissional designado                  |
| `INVENTORY_LOW_STOCK`   | Movimentação manual cruza o estoque mínimo          | Usuários com permissão `inventory:edit` |
| `PATIENT_CREATED`       | Novo paciente cadastrado                            | Usuários com permissão `users:view`     |
| `USER_CREATED`          | Novo usuário criado (exceto o próprio recém-criado) | Outros com permissão `users:view`       |

### Preferências por usuário

Cada usuário pode desligar tipos individualmente: ícone de engrenagem no dropdown do sininho → dialog com lista de toggles. Por padrão tudo vem ligado; quando desliga, o backend simplesmente não cria a notificação daquele tipo para esse usuário (não é só esconder na UI — é não persistir).

### Como funciona tecnicamente

**Backend** (`backend/src/notifications/`):
- `NotificationsModule` é `@Global()` — outros services injetam `NotificationsService` sem importar o módulo.
- `notify(input)` checa preferência do usuário antes de criar; se desabilitado, retorna `null` silenciosamente.
- `notifyMany(userIds, data)` dispara em paralelo com `Promise.allSettled` (falhas não cascateiam).
- `findUsersWithPermission(perm)` lista usuários cujo grupo tem essa permissão — usado para "notifique quem pode editar estoque".
- Os services de Appointments/Inventory/Patients/Users chamam o `notify` em fire-and-forget (`.catch(() => undefined)`) — falhas de notificação **não quebram** a operação principal.

**Frontend** (`frontend/src/components/notifications/`):
- `NotificationsBell` poll a cada 30s buscando contagem de não lidas (leve — só `GET /notifications/unread-count`).
- Lista completa só carrega quando o popover abre.
- `NotificationPreferencesDialog` toca o backend a cada toggle (`PATCH /notifications/preferences`).

### Migration

Como o schema mudou (novos modelos Notification e NotificationPreference), rode:

```bash
cd backend
npx prisma migrate dev --name add_notifications
```

Quando perguntar para resetar o banco, responda `y` (em dev). Depois roda `npm run prisma:seed` para recriar os usuários de exemplo.

### Scheduler (jobs em background)

O `SchedulerService` (`backend/src/scheduler/scheduler.service.ts`) inicia com a API NestJS:

- **Intervalo:** a cada **1 hora**, percorre cada clínica ativa (`TenantContext.run`) e roda manutenção de equipamentos, validade de estoque, retorno de pacientes, reativação e **gatilhos de mensagens WhatsApp**.
- **Gatilhos WhatsApp:** modelos ativos com `trigger` ≠ `MANUAL` geram registros em `message_dispatches` (mensagem renderizada + URL `wa.me`). A deduplicação usa `dedupKey` (ex.: um lembrete `DAY_BEFORE` por agendamento/modelo). Pacientes sem telefone geram registro `SKIPPED`.
- **Envio:** MVP abre o deep link no navegador (tela **Mensagens** → fila pendente, ou modais manuais). API oficial do WhatsApp fica para uma fase posterior.
- **Keep-alive:** query `SELECT 1` a cada 4,5 min entre 7h e 21h (fuso do servidor) para evitar cold start em hospedagem serverless.

### Roadmap

- **Lembretes agendados** (`APPOINTMENT_REMINDER`) — precisa de cron job, ainda não implementado.
- **Alertas de validade próxima** (`INVENTORY_EXPIRING`) — também precisa de cron diário.
- **Canais adicionais** — e-mail e WhatsApp via integrações.
- **Notificações de estoque baixo via agendamentos** — atualmente só dispara em movimentação manual.

## Integração Procedimentos ↔ Agenda ↔ Estoque

Quando um agendamento é criado em status ativo (`SCHEDULED`, `CONFIRMED` ou `COMPLETED`), os materiais configurados no procedimento são deduzidos do estoque automaticamente, gerando uma movimentação `OUT` para cada item. Se algum material estiver com estoque insuficiente, a criação é bloqueada com uma mensagem detalhando quais itens faltam.

Quando o status muda para `CANCELLED` ou `NO_SHOW`, os materiais voltam ao estoque (movimentação `IN`). O mesmo acontece se o agendamento for excluído. Se o procedimento do agendamento for alterado, os materiais antigos são devolvidos e os novos são deduzidos atomicamente.

A flag `Appointment.materialsDeducted` mantém a operação idempotente: a lógica considera o estado atual antes de mexer no estoque, então qualquer ciclo de mudança de status converge corretamente.

## Roadmap

1. **Anamnese estruturada** - formulário customizável por procedimento, salvo em `Patient.anamnesis` (JSON).
2. **Upload de fotos** - fotos antes/depois por paciente (S3 ou local com Multer).
3. **Contas a receber/pagar** - separar lançamentos com `dueDate` futura e marcar como pagos.
4. **Vínculo automático finance ↔ appointment** - ao concluir um agendamento, gerar lançamento financeiro automaticamente.
5. **Notificações** - lembretes de agendamento por WhatsApp/e-mail.
6. **Multi-tenant futuro** - adicionar `clinicId` em todos os modelos e middleware de tenant.

## Notas de segurança

- Trocar `JWT_SECRET` em produção (mínimo 32 caracteres aleatórios).
- Configurar `GOOGLE_CLIENT_ID` (backend) e o mesmo Client ID no frontend; restringir origens autorizadas no Google Cloud.
- Em produção, habilitar HTTPS, configurar `CORS_ORIGIN` específico e usar variáveis de ambiente seguras.
- Novos acessos: cadastrar o e-mail Google do profissional em **Profissionais** — só usuários existentes e ativos conseguem autenticar.
