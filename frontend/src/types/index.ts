export interface Role {
  id: string;
  name: string;
  description?: string;
  color?: string | null;
  permissions: string[];
  isSystem: boolean;
  restrictToOwnAppointments: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: { users: number };
}

export interface User {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  restrictToOwnAppointments: boolean;
  active: boolean;
  providesAppointments: boolean;
  /** Módulos efetivos da clínica ((plano ∪ extra) − denied). Sem plano = todos. */
  features?: string[];
  /** true quando um admin está personificando este usuário */
  impersonating?: boolean;
  impersonatorName?: string;
  /** Clínica do usuário; null para o super-admin fora de uma clínica */
  tenantId?: string | null;
  /** Dono da plataforma: usa só a área /admin (ou "entra como" uma clínica) */
  isSuperAdmin?: boolean;
  /** Nome da clínica quando o super-admin "entrou como" ela */
  tenantName?: string;
  /** Após login Google quando o e-mail tem clínica e super-admin */
  panelSelectionPending?: boolean;
  /** Pode alternar entre painel da clínica e /admin */
  canChoosePanel?: boolean;
}

// ===== Painel administrativo da plataforma (super-admin) =====

export interface AdminTenantMetrics {
  activeUsers: number;
  patients: number;
  appointmentsThisMonth: number;
  lastAccessAt: string | null;
}

/** Limites do plano, aplicados pela API (ausente = ilimitado). */
export interface PlanLimits {
  maxUsers?: number;
  maxPatients?: number;
  storageGb?: number;
}

export interface AdminPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number | null;
  currency: string;
  features: string[] | null;
  limits: PlanLimits | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tenantCount: number;
}

export type AdminPlanSummary = Pick<AdminPlan, 'id' | 'name' | 'slug' | 'active' | 'features' | 'priceCents' | 'currency'>;

export interface AdminTenantProfile {
  specialties: string[];
  foundedAt: string | null;
  legalName: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
}

export interface AdminTenant extends AdminTenantProfile {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  suspendedAt: string | null;
  planId: string | null;
  plan: AdminPlanSummary | null;
  featuresExtra?: string[] | null;
  featuresDenied?: string[] | null;
  effectiveFeatures?: string[];
  createdAt: string;
  updatedAt: string;
  metrics: AdminTenantMetrics;
}

export interface AdminTenantDetail extends Omit<AdminTenant, 'metrics'> {
  admins: { id: string; name: string; email: string; active: boolean; lastAccessAt: string | null }[];
  metrics: AdminTenantMetrics & { totalUsers: number; storageBytes: number; files: number };
}

export type PlatformAuditAction =
  | 'TENANT_CREATE'
  | 'TENANT_UPDATE'
  | 'TENANT_SUSPEND'
  | 'TENANT_REACTIVATE'
  | 'TENANT_ENTER'
  | 'TENANT_PLAN_CHANGE'
  | 'TENANT_FEATURES_CHANGE'
  | 'PLAN_CREATE'
  | 'PLAN_UPDATE'
  | 'PLAN_ACTIVATE'
  | 'PLAN_DEACTIVATE'
  | 'CATALOG_CREATE'
  | 'CATALOG_UPDATE'
  | 'CATALOG_ACTIVATE'
  | 'CATALOG_DEACTIVATE'
  | 'FEEDBACK_STATUS_CHANGE'
  | 'ANNOUNCEMENT_GENERATE'
  | 'ANNOUNCEMENT_CREATE'
  | 'ANNOUNCEMENT_UPDATE'
  | 'ANNOUNCEMENT_DELETE'
  | 'ANNOUNCEMENT_SCHEDULE'
  | 'ANNOUNCEMENT_UNSCHEDULE'
  | 'ANNOUNCEMENT_SEND';

/** Aviso de novidades/correções do super-admin para as clínicas (vira notificação no sino). */
export type AnnouncementKind = 'FEATURE' | 'FIX';
export type AnnouncementStatus = 'DRAFT' | 'SCHEDULED' | 'SENT';

export interface PlatformAnnouncement {
  id: string;
  /** Versão do release de origem; null = escrito à mão. */
  version: string | null;
  kind: AnnouncementKind;
  title: string;
  body: string;
  status: AnnouncementStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAuditLog {
  id: string;
  action: PlatformAuditAction;
  actorId: string;
  actorName: string;
  actorEmail: string;
  targetTenantId: string | null;
  targetName: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export type PlatformCatalogKind =
  | 'document_category'
  | 'message_category'
  | 'message_trigger'
  | 'procedure_category'
  | 'inventory_unit'
  | 'skincare_tag';

/** Item completo (painel /admin). */
export interface PlatformCatalogItem {
  id: string;
  kind: PlatformCatalogKind;
  value: string;
  label: string;
  sortOrder: number;
  active: boolean;
  meta?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Leitura no app da clínica (só ativos). */
export type PlatformCatalogOption = Pick<
  PlatformCatalogItem,
  'id' | 'kind' | 'value' | 'label' | 'sortOrder' | 'meta'
>;

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  active: boolean;
  providesAppointments: boolean;
  isPrimary?: boolean;
  roleId: string;
  createdAt: string;
  role: { id: string; name: string; isSystem: boolean };
  // Perfil de profissional (preenchido quando providesAppointments = true)
  specialty?: string | null;
  specialties?: string[];
  councilRegister?: string | null;
  calendarColor?: string | null;
  bio?: string | null;
  photoStorageKey?: string | null;
  photoUrl?: string | null;
  appointmentsCount?: number;
  appointmentsCountMonth?: number;
  appointmentsCountWeek?: number;
  availability?: ProfessionalAvailability | null;
}

export type ProfessionalAvailability = 'IN_SERVICE' | 'OFF' | 'OUTSIDE_HOURS' | 'AVAILABLE';

/** M = masculino, F = feminino */
export type PatientSex = 'M' | 'F';

export type PatientReferralSource =
  | 'INSTAGRAM'
  | 'REFERRAL'
  | 'GOOGLE'
  | 'LOCATION'
  | 'OTHER';

export interface Patient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  sex?: PatientSex | null;
  document?: string;
  cep?: string | null;
  addressStreet?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  address?: string;
  notes?: string;
  referralSource?: PatientReferralSource | null;
  referralSourceOther?: string | null;
  photoStorageKey?: string | null;
  photoUrl?: string | null;
  anamnesis?: Record<string, any> | null;
  createdAt: string;
  /** Agregações retornadas na listagem */
  lastVisit?: string | null;
  totalSpent?: number;
  reliabilityPercent?: number;
  appointmentsCount?: number;
}

export interface PatientStats {
  total: number;
  active90: number;
  newThisMonth: number;
  averageTicket: number;
}

export type PatientPhotoPhase = 'BEFORE' | 'AFTER';

export interface PatientPhoto {
  id: string;
  patientId: string;
  appointmentId: string;
  phase: PatientPhotoPhase;
  label?: string | null;
  pairId?: string | null;
  takenAt: string;
  url?: string | null;
  mimeType?: string | null;
  size?: number | null;
  createdAt: string;
  appointment?: {
    id: string;
    startAt: string;
    kind?: AppointmentKind;
    procedure?: { name: string } | null;
  } | null;
}

export interface PatientMeasurement {
  id: string;
  patientId: string;
  appointmentId?: string | null;
  measuredAt: string;
  weightKg: number | null;
  heightCm: number | null;
  waistCm: number | null;
  abdomenCm: number | null;
  hipCm: number | null;
  notes?: string | null;
  createdAt: string;
  appointment?: {
    id: string;
    startAt: string;
    kind?: AppointmentKind;
    procedure?: { name: string } | null;
  } | null;
}

export interface Procedure {
  id: string;
  name: string;
  description?: string;
  category?: string | null;
  durationMinutes: number;
  price: number | string;
  active: boolean;
  recurrenceDays?: number | null;
  applicationMap?: boolean;
  appointmentsCount?: number;
  baseCost?: number;
  equipmentCost?: number;
  maxFeePercent?: number;
  maxFeeCost?: number;
  fixedCostShare?: number;
  hourlyCost?: number;
  totalCost?: number;
  profitMargin?: number;
  materials?: ProcedureMaterial[];
  equipments?: ProcedureEquipmentLink[];
}

export interface ProcedureEquipmentLink {
  id: string;
  equipmentId: string;
  costPerUse: number | string;
  equipment?: { id: string; name: string };
}

export interface ProcedureMaterial {
  id: string;
  procedureId: string;
  itemId: string;
  quantity: number;
  item?: InventoryItem;
}

export interface AppointmentMaterial {
  id: string;
  appointmentId: string;
  itemId: string;
  quantity: number;
  item?: InventoryItem;
}

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type AppointmentKind = 'EVALUATION' | 'PROCEDURE' | 'RETURN';

export interface Appointment {
  id: string;
  patientId: string;
  procedureId: string;
  professionalId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  kind: AppointmentKind;
  notes?: string;
  clinicalNotes?: string;
  financeGenerated?: boolean;
  materialsDeducted?: boolean;
  patientPackageId?: string | null;
  patient?: Patient;
  procedure?: Procedure;
  professional?: UserSummary;
  patientPackage?: PatientPackage;
  /** Número da sessão (1-based) deste agendamento dentro do pacote. */
  sessionIndex?: number | null;
  /** Receitas (INCOME) vinculadas — para exibir forma/valor pago. */
  financialEntries?: {
    id: string;
    amount: number | string;
    netAmount?: number | string | null;
    paymentMethod?: { name: string } | null;
  }[];
  extraMaterials?: AppointmentMaterial[];
  /** Pontos marcados no atendimento quando o procedimento usa mapa de aplicação. */
  applicationMap?: ApplicationMap | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

/** Ponto do mapa de aplicação; x/y em % da largura/altura do desenho. */
export interface ApplicationMapPoint {
  x: number;
  y: number;
  note?: string;
}

export interface ApplicationMap {
  template: 'face';
  points: ApplicationMapPoint[];
}

export type PackageType = 'COMBO' | 'SESSIONS';
export type PackageHighlight = 'BEST_SELLER' | 'RECURRING';
export type PatientPackageStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export interface PackageItem {
  id: string;
  packageId: string;
  procedureId: string;
  quantity: number;
  sortOrder: number;
  procedure?: Procedure;
}

export interface Package {
  id: string;
  name: string;
  description?: string;
  type: PackageType;
  totalPrice?: number | string | null;
  discountPercent?: number | string | null;
  validityDays?: number | null;
  sessionCount: number;
  active: boolean;
  /** Destaque manual: 'BEST_SELLER' | 'RECURRING' | null */
  highlight?: PackageHighlight | null;
  items: PackageItem[];
  _count?: { patientPackages: number };
  createdAt?: string;
  /** Agregações retornadas na listagem */
  originalPrice?: number;
  salePrice?: number;
  savingsPercent?: number;
  activePatientsCount?: number;
  bestSeller?: boolean;
}

export interface PackageStats {
  activePackages: number;
  patientsWithPackage: number;
}

export interface PatientPackage {
  id: string;
  patientId: string;
  packageId: string;
  status: PatientPackageStatus;
  totalPaid: number | string;
  paymentMethod?: string;
  purchaseDate: string;
  expiresAt?: string | null;
  sessionsTotal: number;
  sessionsUsed: number;
  notes?: string;
  financeGenerated?: boolean;
  patient?: Patient;
  package?: Package;
  appointments?: Appointment[];
}

export type FinancialType = 'INCOME' | 'EXPENSE';

export type ExpenseType = 'FIXED' | 'VARIABLE';

export type PaymentMethodKind = 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT' | 'OTHER';

export interface PaymentMethodEntry {
  id: string;
  name: string;
  kind?: PaymentMethodKind;
  settlementDays?: number;
  feePercent: number | string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: { financialEntries: number };
}

export interface FinancialEntry {
  id: string;
  type: FinancialType;
  description: string;
  amount: number | string;
  netAmount?: number | string | null;
  feePercent?: number | string | null;
  paymentMethodId?: string | null;
  paymentMethod?: PaymentMethodEntry | null;
  installments?: number | null;
  cardBrand?: string | null;
  authorizationCode?: string | null;
  category?: string;
  paidAt?: string;
  dueDate?: string;
  patientId?: string;
  appointmentId?: string;
  equipmentId?: string;
  invoiceIssued?: boolean;
  invoiceIssuedAt?: string;
  expenseType?: ExpenseType;
  recurringExpenseId?: string;
  materialCost?: number | null;
  profitMargin?: number | null;
  appointment?: {
    id: string;
    procedure?: { name: string };
  };
  equipment?: { id: string; name: string };
}

export interface RecurringExpense {
  id: string;
  name: string;
  description?: string;
  amount: number | string;
  category?: string;
  expenseType: ExpenseType;
  dueDay: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: { generatedEntries: number };
}

export type MessageTrigger =
  | 'ON_BOOKING'
  | 'DAY_BEFORE'
  | 'BIRTHDAY'
  | 'AFTER_APPOINTMENT'
  | 'INACTIVE_90_DAYS'
  | 'MANUAL';

export interface MessageTemplate {
  id: string;
  name: string;
  category?: string | null;
  trigger: MessageTrigger;
  active: boolean;
  content: string;
  procedureId?: string | null;
  procedure?: { id: string; name: string; price: number | string } | null;
  createdAt?: string;
  updatedAt?: string;
}

export type MessageDispatchStatus = 'PENDING' | 'SENT' | 'SKIPPED';

export interface MessageDispatch {
  id: string;
  templateId: string;
  patientId: string;
  appointmentId?: string | null;
  trigger: MessageTrigger;
  phone?: string | null;
  renderedMessage: string;
  waMeUrl?: string | null;
  status: MessageDispatchStatus;
  createdAt: string;
  sentAt?: string | null;
  template?: { id: string; name: string; trigger: MessageTrigger };
  patient?: { id: string; name: string; phone?: string | null };
  appointment?: { id: string; startAt: string; procedure?: { name: string } | null };
}

export interface WorkingHours {
  id: string;
  userId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface Unavailability {
  id: string;
  userId: string;
  startAt: string;
  endAt: string;
  reason?: string;
}

export interface UnavailabilityCalendarItem extends Unavailability {
  user: { id: string; name: string };
}

export interface Equipment {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseValue?: number;
  maintenanceValue?: number;
  maintenanceIntervalMonths?: number;
  maintenanceNotifyDaysBefore?: number;
  lastMaintenanceAt?: string;
  nextMaintenanceAt?: string;
  scheduledMaintenanceAt?: string;
  notes?: string;
  active: boolean;
  createdAt?: string;
}

export type DocumentStatus = 'PENDING' | 'SENT' | 'SIGNED';

export interface DocumentFile {
  id: string;
  name: string;
  category?: string | null;
  status: DocumentStatus;
  signedAt?: string | null;
  storageKey?: string | null;
  /** Sempre null na API — abrir via `documentsApi.getAccessUrl` (presign). */
  fileUrl?: string | null;
  mimeType?: string | null;
  size?: number | null;
  notes?: string | null;
  /** Texto gerado a partir de um modelo; só vem em GET /documents/:id */
  content?: string | null;
  /** Indica se há texto gerado (a listagem não traz `content`) */
  hasContent?: boolean;
  templateId?: string | null;
  patientId?: string | null;
  equipmentId?: string | null;
  createdAt: string;
  updatedAt?: string;
  /** `phone` e `email` só vêm em GET /documents/:id */
  patient?: { id: string; name: string; phone?: string | null; email?: string | null } | null;
  equipment?: { id: string; name: string } | null;
  template?: { id: string; name: string } | null;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  category?: string | null;
  content: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { documents: number };
}

export interface InventoryItem {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  quantity: number;
  minQuantity: number;
  unit?: string;
  costPrice?: number | string;
  expiresAt?: string;
  expiryNotifyDaysBefore?: number;
}

export type DiscountType = 'PERCENTAGE' | 'FIXED' | 'COMBO';

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  commemorativeDate?: string;
  startAt: string;
  endAt: string;
  discountType: DiscountType;
  discountValue: number | string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  procedures?: { procedureId: string; procedure: { id: string; name: string; price: number | string } }[];
  packages?: { packageId: string; package: { id: string; name: string; totalPrice: number | string } }[];
  _count?: { appointments: number };
}

/** Valor cheio, desconto e valor final com a melhor promoção ativa (prévia do backend). */
export interface PromotionQuote {
  originalPrice: number;
  discount: number;
  finalPrice: number;
  promotion: { id: string; name: string; discountType: DiscountType; discountValue: number } | null;
}

export type NotificationType =
  | 'APPOINTMENT_CREATED'
  | 'APPOINTMENT_CANCELLED'
  | 'INVENTORY_LOW_STOCK'
  | 'INVENTORY_EXPIRING'
  | 'PATIENT_CREATED'
  | 'PATIENT_RETURN_DUE'
  | 'PATIENT_REACTIVATION'
  | 'USER_CREATED'
  | 'EQUIPMENT_MAINTENANCE'
  | 'PLATFORM_ANNOUNCEMENT'
  | 'FEEDBACK_CLOSED';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  readAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationPreference {
  type: NotificationType;
  enabled: boolean;
}

export type FeedbackType = 'BUG' | 'SUGGESTION';

export type FeedbackStatus = 'OPEN' | 'TRIAGED' | 'CLOSED';

/** Report na central do super-admin (todas as clínicas). */
export interface AdminFeedbackReport {
  id: string;
  type: FeedbackType;
  status: FeedbackStatus;
  title: string;
  pageUrl: string | null;
  createdAt: string;
  statusChangedAt: string | null;
  tenant: { id: string; name: string };
  user: { id: string; name: string; email: string };
  /** Só no detalhe. */
  description?: string;
}

export interface PlatformModuleUsage {
  key: string;
  label: string;
  /** null = módulo sem registro próprio (ex.: Métricas). */
  metricLabel: string | null;
  enabledTenants: number;
  activeTenants: number | null;
  periodCount: number | null;
  totalCount: number | null;
  /** Requisições à API do módulo no período (medidas desde a observabilidade). */
  requests: number;
}

export interface PlatformTenantUsage {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  plan: { id: string; name: string } | null;
  features: string[];
  activeUsers: number;
  usersAccessedInPeriod: number;
  lastAccessAt: string | null;
  storageBytes: number;
  files: number;
  usage: Record<string, { period: number; total: number } | null>;
}

export interface PlatformUsage {
  range: { from: string; to: string };
  totals: {
    tenants: number;
    activeTenants: number;
    activeUsers: number;
    usersAccessedInPeriod: number;
    storageBytes: number;
    files: number;
  };
  modules: PlatformModuleUsage[];
  tenants: PlatformTenantUsage[];
}

export interface ApiRouteStats {
  method: string;
  /** Padrão da rota, ex.: /api/patients/:id */
  route: string;
  count: number;
  clientErrors: number;
  serverErrors: number;
  /** 5xx / total (0–1) */
  errorRate: number;
  avgMs: number | null;
  /** Estimado pelo histograma (limite superior da faixa). */
  p95Ms: number | null;
  maxMs: number | null;
}

export interface ApiRequestErrorEntry {
  id: string;
  createdAt: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  errorName: string | null;
  message: string | null;
  tenant: { id: string; name: string } | null;
}

export interface ApiObservability {
  window: { hours: number; since: string };
  totals: Omit<ApiRouteStats, 'method' | 'route'> & { routes: number };
  slowRoutes: ApiRouteStats[];
  errorRoutes: ApiRouteStats[];
  recentErrors: ApiRequestErrorEntry[];
}

export interface FeedbackReport {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  pageUrl?: string | null;
  userId: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export type GoalMetric =
  | 'REVENUE'
  | 'NEW_PATIENTS'
  | 'PROCEDURES'
  | 'AVERAGE_TICKET'
  | 'OCCUPANCY'
  | 'RETURN_RATE'
  | 'MANUAL';
export type GoalFormat = 'CURRENCY' | 'NUMBER' | 'PERCENT';
export type GoalPeriodType = 'MONTH' | 'QUARTER' | 'YEAR';

export interface Goal {
  id: string;
  name: string;
  metric: GoalMetric;
  format: GoalFormat;
  target: number;
  manualValue: number | null;
  periodType: GoalPeriodType;
  /** Primeiro dia do período (YYYY-MM-DD). */
  periodStart: string;
  /** Último dia do período (YYYY-MM-DD). */
  periodEnd: string;
  color: string;
  currentValue: number;
  /** Percentual do objetivo (pode passar de 100). */
  progress: number;
  createdAt?: string;
  updatedAt?: string;
}

export type PendingRule =
  | 'LOW_STOCK'
  | 'EXPIRING_STOCK'
  | 'BILLS_DUE'
  | 'APPOINTMENT_NO_OUTCOME'
  | 'EQUIPMENT_MAINTENANCE'
  | 'DOCUMENT_UNSIGNED'
  | 'COMMEMORATIVE_DATE';

export type PendingCategory =
  | 'ADMINISTRATIVE'
  | 'FINANCE'
  | 'INVENTORY'
  | 'OPERATIONAL'
  | 'MAINTENANCE'
  | 'HEALTH_SURVEILLANCE'
  | 'MARKETING'
  | 'TEAM'
  | 'PATIENTS'
  | 'MANAGEMENT';

export type PendingGroup = 'URGENT' | 'OVERDUE' | 'UPCOMING';

export interface PendingItem {
  /** `MANUAL:<id>` para pendências manuais; chave da origem para as geradas por regra. */
  key: string;
  taskId: string | null;
  rule: PendingRule | null;
  category: PendingCategory;
  group: PendingGroup;
  title: string;
  subtitle: string;
  description: string | null;
  deadlineLabel: string;
  dueDate: string | null;
  urgent: boolean;
  link: string | null;
  assignee: { id: string; name: string } | null;
}

export interface PendingList {
  items: PendingItem[];
  resolvedCount: number;
  activeRules: number;
  totalRules: number;
}

export interface PendingTask {
  id: string;
  rule: PendingRule | null;
  sourceKey: string | null;
  title: string;
  description: string | null;
  category: PendingCategory;
  dueDate: string | null;
  urgent: boolean;
  link: string | null;
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  createdAt: string;
}

export interface PendingRuleConfig {
  rule: PendingRule;
  enabled: boolean;
  param: number | null;
  assigneeId: string | null;
}

// =========================
// ROTINAS DE SKINCARE (anamnese de pele)
// =========================

export type SkincareMoment = 'manha' | 'noite' | 'semanal';
export type SkincareStep = 'limpeza' | 'tratamento' | 'hidratacao' | 'protetor' | 'olhos' | 'esfoliacao' | 'mascara';
/** Valor do catálogo global `skincare_tag`. */
export type SkincareTag = string;
export type SkincareRuleField = 'pele' | 'afeccao' | 'olheira' | 'idade';

export interface SkincareProduct {
  id: string;
  name: string;
  brand: string | null;
  activeIngredient: string | null;
  moments: SkincareMoment[];
  step: SkincareStep;
  tags: SkincareTag[];
  howTo: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkincareRule {
  id: string;
  field: SkincareRuleField;
  value: string;
  productIds: string[];
  avoidTags: SkincareTag[];
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Respostas da anamnese de pele. */
export interface SkinAnswers {
  pele: string;
  afec: string[];
  afecOutra: string;
  olheira: '' | 'sim' | 'nao';
  olheiraTipo: string;
  idade: string;
}

/** Produto na rotina, copiado do catálogo no momento em que a rotina foi gerada. */
export interface SkincareRoutineItem {
  moment: SkincareMoment;
  step: SkincareStep;
  productId: string | null;
  name: string;
  brand: string | null;
  activeIngredient: string | null;
  howTo: string | null;
  note: string | null;
}

export interface SkincareAvoided {
  productId: string | null;
  name: string;
  reason: string;
}

export interface SkincareGuideline {
  text: string;
  source: string;
}

export interface SkincareRoutine {
  id: string;
  patientId: string;
  patient?: { id: string; name: string; phone?: string | null; email?: string | null };
  consultDate: string;
  answers: SkinAnswers;
  items: SkincareRoutineItem[];
  avoided: SkincareAvoided[];
  guidelines: SkincareGuideline[];
  notes: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}
