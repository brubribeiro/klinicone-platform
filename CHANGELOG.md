# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Fixed

- Modal "Anamnese de pele" aberta sobre "Editar agendamento" agora é menor (~90%) que a de baixo, com sombra mais forte e margem visível, para ler como camada sobreposta; também inset no mobile.

## [0.2.1] - 2026-10-26

### Security

- RBAC (#33): `users:create`/`users:edit` não podem atribuir nem remover o grupo Administrador a menos que o ator já seja Administrador; ninguém pode alterar o próprio `roleId` (bloqueia auto-promoção).
- RBAC (#34): `roles:create`/`roles:edit`/`roles:delete` restritos a Administradores da clínica; o grupo Administrador continua forçado ao catálogo completo de permissões (não esvazia a hierarquia).

### Added

- Catálogos globais da plataforma: model Prisma `PlatformCatalogItem` (kinds `document_category`, `message_category`, `message_trigger`, `procedure_category`, `inventory_unit`; sem `tenantId`), migration `20261026160000_platform_catalogs`, seed com os valores que o front usava hardcoded; CRUD ` /admin/catalogs` (SuperAdminGuard) com auditoria `CATALOG_*`; leitura autenticada `GET /catalogs` (só ativos) para o app da clínica.
- Frontend admin: página Aurora `/admin/catalogos` para gerenciar itens por tipo; menu Catálogos no painel super-admin.
- Frontend clínica: selects de documentos, mensagens (categoria/gatilho), sugestões de procedimento e unidades de estoque passam a consumir o catálogo via React Query (fallback local enquanto carrega).
- Feedback: model Prisma `FeedbackReport` (BUG|SUGGESTION) com `tenantId` (FK Tenant, índice, escopo automático e trigger same-tenant em `userId`), migration `20261026010000_feedback_reports`, `POST /feedback` (qualquer autenticado) e `GET /feedback` (`feedback:view` / Administrador da própria clínica).
- Feedback: dialog no menu do usuário (sidebar) para escolher tipo, preencher título/descrição e enviar; página mínima `/feedback` para leitura admin.
- Header Aurora: "Novo agendamento" preenchido, relógio global de histórico (`AuditHistoryDialog` pela rota, substitui os 16 botões por tela) e olho para ocultar valores (`utils/money.ts`).
- `AuditHistoryDialog` no padrão Aurora: tabela em grid e select de ação/período no estilo das listas (Usuários), paginação própria no rodapé, no lugar do DataGrid; relógio do header fica desabilitado nas telas sem histórico.
- Modo escuro Aurora: `createAppTheme(mode)` em `theme/`, `ColorModeContext` (lua do header, salvo em `localStorage` `mila.colorMode`, 1ª visita segue `prefers-color-scheme`); paleta escura derivada do verde-água, escala de cinza invertida, FullCalendar/WhatsApp/badges com tokens do tema; botões do header 34px no mobile.
- Pacientes: lista Aurora com cards de estatísticas (`GET /patients/stats`), score de confiabilidade, última visita, total gasto e paginação.
- Ficha do paciente redesenhada (abas Geral, Agendamentos, Pacotes, Anamnese, Fotos).
- Fotos **antes/depois** por paciente vinculadas a agendamento (`PatientPhoto`, upload R2 comprimido).
- `AppointmentDialogProvider` para abrir modal de agendamento globalmente (Layout, ficha, drawer).
- Componente compartilhado `LabeledField` (padrão Aurora).
- Backend: `getBrazilWallClock` para validação de expediente em `America/Sao_Paulo`.
- Agenda: badge **Sessão X/Y** em eventos vinculados a pacote; API retorna `sessionIndex` por agendamento.
- Formulário de agendamento: resumo do paciente (popover), modal de sessões do pacote, agendamento em lote das sessões faltantes.
- Conclusão de agendamento: campo **mês de referência** (`referenceMonth`) para competência financeira de atendimentos passados.
- Backend: `resolveRevenuePaidAt` projeta `paidAt` da receita conforme mês de referência.
- Seed: notas clínicas demo (`demo-appointment-notes.ts`), agendamentos de sexta/sábado, script `prisma:seed-package-appointments`.
- Tema: scrollbar global via `MuiCssBaseline`; estilos refinados em `MuiOutlinedInput` e `MuiSelect`.
- Procedimentos: campo **categoria**, flag **applicationMap**, vínculo `ProcedureEquipment` com custo por uso; migrations Prisma.
- Procedimentos: lista Aurora com filtro por categoria, paginação e colunas financeiras (margem, custos).
- Componente compartilhado `FormSection` para seções de modais.
- Pacotes: campo **highlight** (Mais vendido / Recorrente), `GET /packages/stats/summary`, agregações na listagem (preço, economia, pacientes ativos).
- Promoções: tipo de desconto **COMBO** no enum Prisma; migration `20260730140000_promotion_combo_discount_type`.
- Hook `useUrlState` / `useUrlGridState` (`frontend/src/hooks/useUrlState.ts`): busca, filtros, ordenação e página das listas na query string (`history.replace`, valores padrão omitidos). Aplicado em Pacientes (mantém `?ficha=`), Financeiro, Estoque, Documentos, Agenda (`visao`, `data`, `profissionais`), Procedimentos, Pacotes, Promoções, Equipamentos, Usuários, Auditoria, Despesas recorrentes e Mensagens.
- Grupos: campo `color` em `Role` (migration `20261012120000_role_color`, `#RRGGBB` validado no DTO, cores padrão no seed).
- Mensagens: enum Prisma `MessageTrigger` e campos `trigger`/`active` em `MessageTemplate` (migration `20261012120000_message_template_trigger`, que deriva o gatilho da categoria dos modelos existentes); DTOs aceitam `trigger`, `active` e `category: null`; seed com modelos Lembrete 24h e Pós-procedimento.
- Frontend: tela Mensagens no layout Aurora (lista de modelos + detalhe com prévia do WhatsApp), modal `MessageTemplateFormDialog` com gatilho e status, `VariableChip`; variável `{nome}` (alias de `{paciente_nome}`, que segue aceita); `SendWhatsAppDialog` lista só modelos ativos e sugere pelo gatilho.
- Metas: modelo Prisma `Goal` (enums `GoalMetric`, `GoalFormat`, `GoalPeriodType`), migration `20261011120000_goals`, módulo `goals/` com CRUD, `GET /goals?scope=current|upcoming|past|all&at=` e `GET /goals/preview`; valor atual calculado (faturamento, novos pacientes, procedimentos, ticket médio, ocupação da agenda, taxa de retorno) ou manual; permissões `goals:*`.
- Frontend: página `/metas` (`Goals.tsx`, `GoalFormDialog`, `goalUtils`) no menu Análise; card `GoalsCard` no Dashboard com metas reais.
- Pendências: modelo Prisma `PendingTask` (enums `PendingRule`, `PendingCategory`), migration `20261013120000_pendencias` (também concede `pendencias:*` aos grupos de sistema Recepção e Profissional), módulo `pendencias/` com `GET /pendencias`, `GET /pendencias/resolved`, `GET|PUT /pendencias/rules`, `POST /pendencias/resolve`, `POST /pendencias/assign`, `POST /pendencias/:id/reopen` e CRUD de pendências manuais; permissões `pendencias:*` e auditoria (`PendingTask`, `PendingRules`).
- Pendências geradas por regras a cada consulta (estoque abaixo do mínimo, validade próxima, contas a vencer, agendamento sem desfecho, manutenção de equipamento, documento sem assinatura, data comemorativa sem promoção), com parâmetros e responsável padrão em `app_settings.pending_rules`; resolução e responsável das geradas persistidos em `PendingTask.sourceKey`. Utilitário `common/utils/commemorative-dates.util.ts`. `AppointmentsModule` e `FinanceModule` passam a exportar seus serviços.
- Frontend: página `/pendencias` (`Pendencias.tsx`, `PendingRulesDialog`, `PendingTaskDialog`, `pendenciasUtils`) no menu Principal, com Foco de hoje, abas Urgentes/Atrasadas/Próximas, Resolvidas, filtro por categoria, rosca por categoria, ações rápidas e relatório CSV.
- Rotinas de skincare (anamnese de pele): modelos Prisma `SkincareProduct`, `SkincareRule` e `SkincareRoutine` (FK para `Patient`, cascade), migration `20261020120000_skincare_routines` (também concede `routines:view|create|edit` ao Profissional e `routines:view` à Recepção), módulo `skincare/` com CRUD de `/skincare/products`, `/skincare/rules` e `/skincare/routines` (`GET ?patientId=`); excluir produto o retira das regras; permissões `routines:*` e auditoria (`SkincareProduct`, `SkincareRule`, `SkincareRoutine`). A rotina salva guarda as respostas e uma cópia dos produtos (nome, marca, ativo, modo de uso), para o histórico não mudar quando o catálogo muda.
- Seed: catálogo inicial da anamnese de pele (`prisma/skincare-demo-data.ts`, 20 produtos e 15 regras do protótipo), criado só quando não há produtos.
- Frontend: página `/rotinas` (`SkincareRoutines.tsx`, `SkincareProductDialog`, `SkincareRuleDialog`) no menu Catálogo; assistente `SkinAnamnesisWizard` (6 etapas, rotina Manhã/Noite/Semanal gerada por `generateRoutine` em `skincareUtils`, edição, impressão, envio por WhatsApp/e-mail via `SendRoutineDialog`) aberto em `SkinAnamnesisDialog` pelo card `PatientSkinRoutinesCard` (aba Anamnese da ficha) e pelo atalho no modal de agendamento em edição.

- Multi-tenant (banco único, coluna `tenantId`): modelo Prisma `Tenant` (`name`, `slug` único, `active`, `suspendedAt`) e `tenantId` obrigatório com índice em todos os models de dados da clínica (inclusive tabelas filhas como `PackageItem` e `AppointmentMaterial`); `User.tenantId` nulo só para super-admin. Migration `20261025120000_multi_tenant` cria a clínica inicial **Mila Barreto** (`mila-barreto`) e move para ela todos os registros existentes.
- Escopo automático por clínica em `src/tenancy/`: `TenantContext` (AsyncLocalStorage aberto por `TenantContextMiddleware`, preenchido pelo `JwtAuthGuard`) e extensão Prisma `tenantScopeExtension` aplicada no `PrismaService`, que filtra `tenantId` em find/count/aggregate/groupBy/update/delete/upsert e o preenche em create/createMany e escritas aninhadas (create, createMany, connectOrCreate, upsert; `connect`/`set` também ficam presos à clínica). Sem tenant no contexto a consulta é recusada (`TenantContextMissingError`, 403); `TenantContext.run(tenantId)` e `runUnscoped()` para jobs, login e super-admin. `$queryRaw` não é coberto.
- Banco: trigger `enforce_same_tenant` em todas as 38 FKs entre tabelas de clínica recusa referência a registro de outra clínica (vira P2003/400), e CHECK `users_tenant_or_super_admin_check` impede usuário de clínica sem `tenantId`/grupo.
- JWT passa a levar `tenantId`, conferido contra o banco a cada requisição; `/auth/me` e o login retornam `tenantId` e `isSuperAdmin`.
- Clínica suspensa (`Tenant.active = false`): login e requisições dos usuários dela respondem 401 com `error: 'TENANT_SUSPENDED'` e mensagem explicando a suspensão.
- Super-admin da plataforma: `User.isSuperAdmin` (sem clínica nem grupo), `SuperAdminGuard` pronto para o módulo admin e comando `npm run prisma:create-super-admin -- --email ... --name ...`.
- `ensureSystemRoles(prisma, tenantId)` e `provisionTenant(prisma, { name, slug })` em `src/tenancy/system-roles.ts` criam os grupos de sistema (Administrador, Profissional, Recepção) de cada clínica; o seed passou a usá-los.
- Scripts de `prisma/` rodam na clínica `TENANT_SLUG` (padrão `mila-barreto`) via `prisma/tenant-script.ts`; o seed principal cria a clínica se faltar (usuários demo de outras clínicas usam `@<slug>.demo`).
- Testes: `tenant-scope.extension.spec.ts` (reescrita dos args) e `npm run test:tenancy` (`test/tenant-isolation.int-spec.ts`, Postgres real) provando isolamento entre duas clínicas em pacientes, agendamentos, financeiro, usuários/grupos, configurações, JWT, suspensão e super-admin.
- Painel do super-admin: módulo `src/admin/` (`JwtAuthGuard` + `SuperAdminGuard`) com `GET|POST /admin/tenants` (busca por nome/identificador e `status=active|suspended`), `GET|PATCH /admin/tenants/:id`, `POST /admin/tenants/:id/suspend|reactivate|enter` e `GET /admin/audit`. Criar clínica gera o identificador a partir do nome se vazio e cria o primeiro usuário (grupo Administrador) com o e-mail informado. Métricas por clínica: usuários ativos, pacientes, agendamentos do mês (fuso do Brasil), último acesso e armazenamento (soma de `size` de `Document` e `PatientPhoto`).
- "Entrar como" uma clínica: `AuthService.signTenantAccess` emite token de 2h do próprio super-admin com `tenantId` da clínica alvo e `impersonatorId` = ele mesmo; o `JwtStrategy` o trata como administrador da clínica (todas as permissões, `tenantName` no `/auth/me`), inclusive se ela estiver suspensa. Nesse modo o super-admin não pode personificar usuários da clínica.
- Auditoria da plataforma: model `PlatformAuditLog` (`platform_audit_logs`, sem `tenantId`, fora do escopo automático) registra criar, editar (diff de nome/identificador), suspender (motivo opcional), reativar e entrar como, com quem fez e o nome da clínica na hora.
- `User.lastAccessAt`: gravado pelo `JwtStrategy` no máximo a cada 5 min (personificação não conta). Migration `20261025233216_admin_panel`.
- `provisionTenant(prisma, data, admin?)` cria, na mesma transação, o primeiro usuário da clínica no grupo Administrador.
- Frontend: área `/admin` separada do app da clínica (`AdminLayout` com menu próprio, `SuperAdminRoute`): Clínicas (lista com busca e status na URL, criar/editar em `TenantFormDialog`, suspender/reativar/entrar como com confirmação), detalhe com métricas, administradores e histórico, e Auditoria da plataforma. Super-admin logado vai direto para `/admin`; usuário de clínica é mandado para `/`. Durante o "entrar como" a faixa de personificação mostra a clínica e volta ao detalhe dela no painel.
- Planos da plataforma (sem cobrança automática): model `Plan` (`plans`, `slug` único, `description`, `priceCents`/`currency`, `features` JSON string[] do catálogo fixo, `limits` JSON opcional `{ maxUsers, maxPatients, storageGb }` só informativo, `active`; sem `tenantId`, fora do escopo automático, RLS ligado) e `Tenant.planId` opcional (FK `ON DELETE SET NULL`) + overrides `featuresExtra` / `featuresDenied`. Migrations `20261026120000_platform_plans` e `20261026140000_plan_features_pricing`. Efetivo = (módulos do plano ∪ extra) − denied; sem plano = catálogo completo (legado). `PlansController` em `/admin/plans` (`JwtAuthGuard` + `SuperAdminGuard`): CRUD + activate/deactivate com `tenantCount`. `PATCH /admin/tenants` aceita `planId` e overrides de módulos. Auditoria: `PLAN_*`, `TENANT_PLAN_CHANGE`, `TENANT_FEATURES_CHANGE`. Helper `resolveEffectiveFeatures` / `tenantHasFeature` em `common/platform-features.ts`; `@RequireFeature` + `FeatureGuard` (depois do JWT) nas rotas dos módulos; `/auth/me` e login devolvem `features`. Seed: Essencial/Profissional/Enterprise com preço e módulos exemplo (só cria).
- Frontend: `/admin/planos` com preço, contagem de módulos e `PlanFormDialog` (preço + checkboxes de módulos + limites); detalhe da clínica com `TenantFeaturesEditor` (extras/removidos); menu e rotas da clínica filtrados por feature (`FeatureRoute`); rótulos de auditoria. Testes: `platform-features.spec.ts`, `feature.guard.spec.ts`, planos/admin e formatadores.
- Login: aviso **Clínica suspensa** quando o login ou a sessão em andamento recebe `TENANT_SUSPENDED` (o interceptor do axios guarda a mensagem em `sessionStorage` para a tela de login).
- Testes: `admin.service.spec.ts`, `super-admin.guard.spec.ts`, `jwt.strategy.spec.ts` e casos novos em `auth.service.spec.ts`; `test:tenancy` usa `provisionTenant` com o primeiro administrador. Frontend: rotas do super-admin, aviso de suspensão e formatadores do painel.

### Changed

- Refatoração sem mudança visual de Financeiro, Despesas recorrentes, Documentos, Equipamentos, Estoque, `ProcedureFormDialog` e `BulkPurchaseDialog` (comparação pixel a pixel antes/depois em 1440px e 390px, incluindo estados vazios, carregamento, paginação e modais):
  - Peças compartilhadas de listagem: `ListPageButtons` (+ `utils/pagination.ts` `pageWindow`), `ListEmptyState`/`ListSkeletonRows` (`ListStates.tsx`), `ListTableHeader`, `StatCard`, `RowActionButton` e o hook `usePagination`; `ListCardHeader` ganhou `breakpoint`, `nowrapFrom` e `sx`, e `ListSearchField` ganhou `width`, `ariaLabel` e `compact`, mais os estilos `LIST_HEADER_PAPER_SELECT_SX`, `LIST_HEADER_COMPACT_SELECT_SX`, `LIST_HEADER_ICON_BUTTON_SX` e `LIST_HEADER_PRIMARY_ACTION_SX`.
  - Subcomponentes extraídos das páginas: `TransactionRow`, `FinanceKpiCard`, `PeriodField`, hook `useFinanceBackgroundSync`; `RecurringSummaryCards`, `HourlyCostCard` (com suas queries e o switch de custo variável), `RecurringExpenseRow`, `recurringDue.ts`; `DocumentListRow`, `DocumentActionsMenu`; `EquipmentCard`, `equipmentMaintenance.ts`; `InventoryListRow`; `ProcedureToggleCard`, `ProcedureCostSummary`; `BulkPurchaseLineRow`, `BulkPurchaseTotals`, `bulkPurchase.ts` (rateio de frete) e `inventoryUnits.ts` (unidades compartilhadas com `InventoryFormDialog`).
  - Código morto removido em `ProcedureFormDialog` (imports, `FIELD_SX` vazio, `DIALOG_HEIGHT_DESKTOP`, `watchedName`, `watchedActive`, `estimatedMargin`) e funções `pageWindow` duplicadas.
  - Acessibilidade (sem efeito visual): a busca de Equipamentos, Despesas recorrentes e Documentos passa a ter `aria-label`, e os números de página de todas essas listas marcam `aria-current="page"`.

- Refatoração sem mudança visual ou de comportamento: `Dashboard.tsx`, `Appointments.tsx` e `Layout.tsx` divididos em subcomponentes e hooks (`components/dashboard/` — `SummaryCard`, `WeekAgendaCard`, `BirthdaysCard`, `useDashboardData`; `components/appointments/` — `AgendaToolbar`, `AgendaStatusLegend`, `PendingAppointmentsBanner`, `AgendaCalendarSkeleton`, `agendaCalendarContent`, `agendaCalendarSx`, `agendaConfig`, `useAgendaData`, `useCalendarKeyboardScroll`; `components/layout/` — `navConfig`, `pageMeta`, `layoutTheme`, `SidebarContent`, `HeaderActions`, `ImpersonationBanner`). Removido código morto: seletor de período oculto do Dashboard (`{false && …}`), `DashboardDetailItem` sem uso, helpers/imports sem uso e estilos de toolbar do FullCalendar que nunca renderizavam (`headerToolbar={false}`).
- `Patients.tsx`: substitui DataGrid por lista customizada Aurora.
- `PatientDetail.tsx`, `PatientDetailDrawer`, `PatientFormDialog`: alinhados ao visual Aurora.
- Pacientes (refatoração sem mudança de comportamento ou visual): `PatientDetail`, `PatientDetailDrawer`, `PatientFormDialog` e `Patients` divididos em subcomponentes e hooks em `components/patients/`. Compartilhados entre ficha, gaveta e lista: `usePatientChart` (paciente + score), `patientChart.ts` (`scoreTone`, `patientAgeLabel`, rótulos de status/tipo de agendamento), `ReliabilityBadge`, `PatientWhatsAppButton`, `PatientAnamnesisSection` e `EmptyBlock`. Ficha: `PatientSummarySidebar`, `PatientOverviewTab`, `PatientAppointmentsTab`, `PatientPackagesTab`. Gaveta: `PatientDrawerHeader`, `PatientDrawerSummaryTab`, `PatientDrawerAppointmentsTab`. Formulário: `patientFormValues.ts` (valores iniciais e payload), `useCepAddressLookup`, `usePatientPhotoDraft`, `PatientPhotoPicker`, `PatientFormBasicFields`, `PatientFormAddressSection`, `LabeledField`. Lista: `PatientListRow`, `PatientListColumns`, `PatientListPagination`, `PatientListEmptyState`, `PatientStatCard`.
- `AnamnesisFormDialog` / `AnamnesisView`: seções em cards, campos com `LabeledField`.
- `AppointmentFormDialog`: suporte a `defaultPatientId`; busca de profissionais só após init do form; redesign Aurora (seções, modais de pagamento e confirmação).
- Agenda: skeleton de carregamento no calendário; remoção de scrollbar customizada local (usa tema global).
- Dashboard: semana da agenda = 7 dias a partir do anchor (não mais segunda–domingo fixos).
- `UpcomingExpensesCard`: skeleton no lugar de texto "Carregando...".
- `DialogCloseButton`: bordas arredondadas, rodapé cinza claro, botão fechar estilizado.
- `Procedures.tsx`: substitui DataGrid por lista customizada Aurora; `ProcedureFormDialog` com equipamentos e categoria.
- Modais de cadastro: adotam `FormSection` (paciente, financeiro, estoque, pacotes, profissionais, roles, etc.).
- `Layout`: botão **Novo agendamento** outlined; sino de notificações reposicionado.
- Dashboard: scroll na lista de aniversariantes; botão WhatsApp desabilitado sem telefone.
- `Packages.tsx`: substitui DataGrid por cards Aurora; `PackageFormDialog` reorganizada.
- `Promotions.tsx`: substitui DataGrid por cards Aurora; `PromotionFormDialog` com tipo Combo e escopo (procedimentos/pacotes).
- Backend (refactor, sem mudança de API/comportamento): `AppointmentsService` dividido em `AppointmentRulesService` (referências, disponibilidade, intervalo de retorno), `AppointmentMaterialsService` (baixa/devolução de estoque), `AppointmentFinanceService` (receita, custo de materiais, backfill) e `AppointmentEventsService` (notificações/auditoria), mais `appointment.helpers.ts`; regra de receita de pacote unificada entre conclusão e backfill; removido cálculo morto de `costDetails` e consultas duplicadas em `update`.
- Backend (refactor, sem mudança de API/comportamento): `PatientsService` dividido em `PatientPhotoStorageService` (R2, validação e URLs assinadas), `PatientStatsService` (agregações e confiabilidade), `PatientEventsService` (auditoria/notificação) e `patient-fields.util.ts` (normalização de campos com regra única para nulos/trim).
- Testes: spec de pacientes passa a prover `CompressionService` e mock de `financialEntry` (12 testes que falhavam na montagem do módulo voltam a passar).
- `Metrics.tsx`: redesign Aurora sem Recharts (barras, divisão proporcional e donut em MUI); KPIs de topo (receita de procedimentos, ticket médio, taxa de retorno, no-show) com delta vs. período anterior de mesma duração (segunda chamada a `GET /metrics`); abas em pílulas; indicadores por aba em faixa única; aba Financeiro com resumo de receitas/despesas/saldo e receita por categoria.
- `PaymentMethods.tsx`: substitui DataGrid por grade de cards Aurora (taxa, valor líquido a cada R$ 100, uso em lançamentos); `PaymentMethodFormDialog` com `FormSection`/`LabeledField` e status em select.
- `RecurringExpenses.tsx`: substitui DataGrid por layout Aurora (cards de resumo com divisão fixo/variável e vencimentos em 7 dias, painel de custo por hora minimizável, tabela paginada com próximo vencimento); `RecurringExpenseFormDialog` em coluna única com `LabeledField`. API e cálculo de custo/hora inalterados.
- `Roles.tsx`: substitui DataGrid por layout Aurora (cards de grupo + matriz de permissões editável na página, com salvar/descartar); `RoleFormDialog` em coluna única (520px) com cor do grupo e "Copiar permissões de".
- Documentos: status `DocumentStatus` (`PENDING`/`SENT`/`SIGNED`, com `signedAt`), texto gerado (`content`) e vínculo opcional a modelo; novo model `DocumentTemplate` (`document_templates`). Migration `20261011120000_document_status_templates` marca os documentos existentes como `SIGNED`.
- Backend Documentos: `POST /documents/from-template` (preenche `{{paciente}}`, `{{cpf}}`, `{{nascimento}}`, `{{telefone}}`, `{{email}}`, `{{endereco}}`, `{{data}}`, `{{profissional}}`), `GET /documents/:id`, `PATCH /documents/:id`, `POST /documents/:id/file` (anexa a versão assinada no R2 e marca `SIGNED`); upload aceita `status`. Listagem devolve `hasContent` sem o texto.
- Backend: CRUD `/document-templates` (permissões `documents:*`, auditoria `DocumentTemplate`); seed com 3 modelos padrão (consentimento, anamnese, autorização de imagem).
- `Documents.tsx`: layout Aurora com cards Total/Assinados/Pendentes/Modelos ativos, tabela paginada (documento, paciente, tipo, data, status) e menu por linha (abrir, visualizar/imprimir, anexar versão assinada, marcar status, editar, excluir); filtros de status/tipo/vínculo. `DocumentFormDialog` (substitui `DocumentUploadDialog`: modelo ou arquivo, status, observações, edição), `DocumentViewerDialog` (texto + impressão) e `DocumentTemplatesDialog` (CRUD de modelos com inserção de campos); remove `DocumentCard`.
- `Equipment.tsx`: substitui DataGrid por cards Aurora (stats, ciclo de manutenção, paginação); `EquipmentFormDialog` em coluna única com `LabeledField`.
- `PrivacyPolicy.tsx`: layout Aurora (cabeçalho fixo com marca e botão "Voltar ao login", selo "Documento legal", conteúdo em card branco e rodapé com link para os Termos de Uso), responsivo; texto legal e rota `/privacidade` inalterados.
- `Login.tsx`: layout Aurora (painel de marca verde-escuro com gradiente e orbes animados, painel claro com botão “Entrar com o Google”, caixa de acesso exclusivo, contato do administrador e links de Termos/Privacidade); o botão oficial do `GoogleLogin` fica invisível sobre o botão visual, mantendo o fluxo de ID token; painel de marca some abaixo de `md`. Novo ícone `lock` em `AuroraIcon`, token `fontSizes['8xl']` (38px) e variável opcional `VITE_ADMIN_CONTACT_EMAIL` (link `mailto:` de “Fale com o administrador”).
- `TermsOfUse.tsx`: layout Aurora (cabeçalho fixo com marca e botão Voltar ao login, selo Documento legal, seções em card único, rodapé com link para `/privacidade`); texto legal e rota `/termos` inalterados.
- Layout: rotas autenticadas envolvidas por `PAGE_SHELL_SX` (`theme/layout.ts`, largura total sem `maxWidth` centralizado); `PAGE_MAX_WIDTH` mantido só para scroll horizontal de grades (procedimentos); removidos limites locais em rotinas, detalhe de estoque e páginas legais.
- Formulários: componente `MoneyField` (máscara R$ "1.234,56", digitação por centavos) nos campos de valor de equipamentos, procedimentos, estoque, financeiro, despesas recorrentes, promoções, pacotes, movimentação e compra em lote; `masks.ts` ganha `formatMoneyInput`, `parseMoneyInput`, `isValidPhone` e `EMAIL_PATTERN`.
- Formulários: `noValidate` nos `<form>` (mensagens do react-hook-form em português no lugar das do navegador), `inputMode` numeric/decimal/tel/email, `autoComplete="off"` em dados de terceiros, autoFocus no primeiro campo de paciente, usuário e procedimento, mensagens para regras que falhavam sem texto (duração, dia de vencimento, quantidades, valores, materiais e equipamentos).
- Paciente: validação de telefone (DDD + número) e e-mail; erro de CEP passa a aparecer.
- Refatoração sem mudança de comportamento ou visual: `Metrics.tsx` (1.303 → 90 linhas) e `Availability.tsx` (1.237 → 57) viram composição; abas, blocos de gráfico, KPIs, filtro de período e `useMetricsData` em `components/metrics/`; cards, diálogos de horário/bloqueio, `useAvailabilityData`, `useWorkingHoursForm`, `useUnavailabilityForm`, constantes e formatadores em `components/availability/` (sx dos diálogos, skeleton, invalidação de bloqueios e mensagem de erro da API deixam de ser duplicados).

- `AppointmentFormDialog`: formulário reorganizado em seções numeradas e colapsáveis (paciente → procedimento/profissional → data/horário → pacote/pagamento → materiais → observações), com resumo fixo (lateral em `lg+`, barra acima do rodapé abaixo disso) e botão de salvar sempre visível; ao enviar com erro, as seções inválidas reabrem. Arquivo de ~3.400 linhas dividido em seções, diálogos (`CompletePaymentDialog`, `ReturnAppointmentDialog`, `SellPackageDialog`, `BatchSessionsDialog`, `PackageSessionsDialog`) e hooks (`useAppointmentProfessionals`, `useSessionTimer`, `useAppointmentMaterials`) em `components/appointments/`. Regras de negócio e API inalteradas.
- `AppointmentFormDialog`: fechar com alterações não salvas (backdrop, Esc, X ou Cancelar) pede confirmação via `confirm` do `AppDialogContext` (`isDirty` do react-hook-form + materiais extras e pacote); avisos e erros que usavam `alert` do `AppDialogContext` passam a usar toast (`AppToastContext`).

- Multi-tenant: unicidades que eram globais passam a ser por clínica (`Role.name`, `MessageTemplate.name`, `DocumentTemplate.name`, `PaymentMethod.name`, `InventoryItem.sku`, `PendingTask.sourceKey`); `AppSetting` com chave primária `(tenantId, key)`. `User.email` continua único no sistema e `User.roleId` passa a ser opcional (só super-admin fica sem grupo).
- Scheduler roda as verificações (manutenção, validade, retorno, reativação) uma clínica ativa por vez, cada uma no próprio contexto.
- Uploads no R2 passam a usar a chave `tenants/<tenantId>/...`; arquivos antigos continuam nas chaves anteriores.
- Tokens emitidos antes do multi-tenant (sem `tenantId`) são recusados: todos precisam entrar de novo após o deploy.
### Fixed

- Disponibilidade: dia/hora do expediente extraídos no fuso do Brasil, não UTC do servidor.
- Formulário de agendamento: elimina requisição extra de profissionais disponíveis ao abrir.
- Acessibilidade: `aria-label` descritivo (com o nome do item) em todos os `IconButton`; busca, selects e switches com rótulo acessível; avatares decorativos com `alt=""`/`aria-hidden`; paginação com `aria-current`; filtros com `aria-pressed`.
- Acessibilidade: linhas e cards clicáveis (Pacientes, Agenda, Dashboard, Financeiro, notificações, emojis, histórico de auditoria) focáveis por Tab e ativáveis com Enter/Espaço via `clickableProps` (`src/utils/a11y.ts`).
- Tema: contorno de foco visível (`:focus-visible`) para navegação por teclado; botão de excluir foto aparece também ao receber foco.
- Telas Usuários, Horários, Estoque, Financeiro, Metas, Documentos, Formas de pagamento, Mensagens, Grupos e permissões e Relatórios voltam a ocupar a largura total (removido `maxWidth: 1320` centralizado no wrapper raiz).
- Dashboard: card **Metas do mês** alinhado ao card da Agenda (espaçamento do cabeçalho, estado vazio em largura total e botão "Definir metas" dentro da caixa vazia).
- Horários: cabeçalhos dos cards **Disponibilidade da equipe** e **Bloqueios de agenda** com a mesma altura (`minHeight` no `CARD_HEADER_SX`), divisores alinhados.
- Contraste: textos auxiliares abaixo do valor principal (`60h por semana` em Horários e linhas equivalentes em Mensagens, Documentos, Formas de pagamento, Metas, Pendências, Grupos, Despesas recorrentes e nota de Usuários) passam de `text.disabled` para `text.secondary`; os de 11px sobem para 12px.
- Procedimentos: filtro de categoria passa de pills para select no cabeçalho do card (`LIST_HEADER_SELECT_SX`, compartilhado com Usuários); título do card mostra a categoria selecionada.
- Usuários: removido o texto explicativo que ficava fora do card.
- Listagens: filtros/busca/ações de Procedimentos e Usuários movidos para dentro do card da tabela (como Pacientes, Documentos, Estoque, Financeiro, Despesas recorrentes e Mensagens), via novo `ListCardHeader` (`ListSearchField`, `ListHistoryButton`, `LIST_HEADER_ACTION_SX`); Pacientes passa a usá-lo.

### Removed

- Pacientes: código morto da ficha, gaveta e formulário (abas Observações/Financeiro/Documentos e suas queries nunca exibidas, `InfoRow`, `NoteBlock`, `AppointmentNotesCard`, `PackageCard` e query de pacotes da gaveta, constantes de estilo e `TabPanel` sem uso no formulário, imports não usados). Some com isso os dois erros de `tsc` em `PatientDetail.tsx` (comparação de aba com `'finance'`/`'documents'`).

## [0.2.0] - 2026-07-15

### Added

- Componente `AuroraIcon` com ícones de traço no estilo do protótipo Aurora (sidebar e notificações).
- Sidebar reorganizada em grupos (Principal, Catálogo, Financeiro, Equipe, Configurações) com rótulos de seção.

### Changed

- Redesign visual **Aurora**: paleta verde-água, tipografia Plus Jakarta Sans, cards e botões com bordas mais arredondadas.
- Menu lateral escuro com destaque ativo em verde; barra superior e sino de notificações alinhados ao novo visual.
- `PageHeader` oculta título/subtítulo por padrão (prop `showTitle` para telas que precisam exibir).

## [0.1.6] - 2026-06-09

### Added

- Agenda: alerta de **pendências** — agendamentos passados ainda sem conclusão, com lista expansível e acesso rápido ao formulário.
- Endpoint `GET /api/appointments/pending` com filtro por profissional quando aplicável.
- Anamnese: seção **Medidas corporais** (peso e altura) com cálculo automático de **IMC** e classificação.
- Estados de carregamento (skeletons/spinner) no dashboard, financeiro, agenda, indisponibilidades e despesas recorrentes.
- Histórico de auditoria: rótulos em português para enums (status, tipo, canal, etc.) e nomes legíveis de relações (paciente, procedimento, etc.).

### Fixed

- Notificações: rotas `read-all` e `:id/read` reordenadas para evitar conflito de roteamento no NestJS.
- Ficha do paciente: campos pessoais vazios (ex.: CPF) deixam de aparecer na visualização.
- Toast de feedback ao marcar todas as notificações como lidas.

### Changed

- Serviços de auditoria passam a incluir relações Prisma ao registrar alterações, exibindo nomes em vez de IDs.

### Security

- Migration habilitando Row-Level Security (RLS) em todas as tabelas do Postgres.

## [0.1.5] - 2026-06-08

### Fixed

- Modal de agendamento: botão **Salvar** deixa de ficar desabilitado ao selecionar procedimento enquanto a disponibilidade é atualizada em segundo plano.
- Modal de agendamento: profissional escolhido manualmente não é mais substituído ao alterar data, horário ou procedimento.
- Verificação de conflito de horário ignora estado obsoleto durante refetch da lista de profissionais disponíveis.

### Changed

- Remoção de comentários redundantes no código (frontend e backend).

## [0.1.4] - 2026-06-08

### Added

- Sistema global de **toasts** (sucesso, erro, info) no painel; feedback ao salvar, excluir e em ações rápidas em formulários e listagens.
- Keep-alive do banco em horário comercial (7h–21h) para reduzir cold start do Neon em produção.
- Templates `.env.local.example` e `.env.production.example` para separar config local (Docker Postgres) de produção.

### Fixed

- Exclusão de agendamento com atualização otimista: modal fecha na hora e evento some do calendário sem esperar o refetch.
- Modal de confirmação de exclusão: header original, mensagem contextual (paciente e horário) e espaçamento do corpo.
- Transações Prisma com retry automático em conexões pooled (Neon), reduzindo falhas intermitentes em procedimentos, estoque e pacotes.
- Backend carrega `.env.local` com prioridade sobre `.env` no desenvolvimento local.

## [0.1.3] - 2026-06-11

### Fixed

- Agendamento de **procedimento** retornava erro 500 em produção (Render + Neon pooler); API passa a usar conexão direta ao Postgres para transações com dedução de estoque.
- Validação de paciente, profissional, procedimento e pacote antes de criar agendamento; erros de referência inválida retornam 400 em vez de 500.
- Modal de agendamento: payload sanitizado, mensagens de erro da API mais claras, limpeza de `procedureId` obsoleto ao trocar tipo de atendimento.
- Filtro global de exceções Prisma com mensagens legíveis (FK, conflito de transação, etc.).
- Build no Render: `prisma migrate deploy` no pipeline de deploy.

## [0.1.2] - 2026-06-09

### Fixed

- Toggle de preferências de notificação responde na hora (atualização otimista, sem esperar a API).

### Added

- Notas de release para usuários em `RELEASE_NOTES.md`.

## [0.1.1] - 2026-06-09

### Fixed

- Logout e redirect de sessão expirada passam a respeitar o base path `/painel`.
- Modais de formulário com scroll em monitores de altura reduzida (conteúdo não fica mais cortado).
- Rewrites no Vercel para rotas SPA sob `/painel` (refresh e links diretos deixam de retornar 404).

## [0.1.0] - 2026-06-08

### Added

- Versionamento centralizado via arquivo `VERSION` na raiz do repositório.
- Exibição da versão no painel (menu lateral e login).
- Endpoint público `GET /api/health` com versão da API.
