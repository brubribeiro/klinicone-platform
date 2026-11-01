import { AppointmentStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DEFAULT_PLATFORM_CATALOG } from '../src/admin/platform-catalog.constants';
import { demoAppointmentNotes } from './demo-appointment-notes';
import { SKINCARE_DEMO_PRODUCTS, SKINCARE_DEMO_RULES } from './skincare-demo-data';
import { createScriptClient, demoEmail, runInScriptTenant } from './tenant-script';

const prisma = createScriptClient();

const defaultUsers = [
  { name: 'Administrador', email: 'admin@mila.com', password: 'admin123', roleName: 'Administrador', providesAppointments: true },
  { name: 'Profissional Exemplo', email: 'profissional@mila.com', password: 'pro123', roleName: 'Profissional', providesAppointments: true },
  { name: 'Recepção', email: 'recepcao@mila.com', password: 'rec123', roleName: 'Recepção', providesAppointments: false },
];

/** Modelos demo com gatilhos — o scheduler (1h) enfileira envios em `message_dispatches` quando ativos. */
const defaultTemplates = [
  {
    name: 'Confirmação de agendamento',
    category: 'confirmacao',
    trigger: 'ON_BOOKING' as const,
    content:
      'Olá, {nome}! Seu horário para {procedimento} está confirmado para {data} às {hora} com {profissional}. Até breve! 💚',
  },
  {
    name: 'Lembrete 24h',
    category: 'lembrete',
    trigger: 'DAY_BEFORE' as const,
    content:
      'Oi, {nome}! Passando para lembrar do seu {procedimento} amanhã às {hora}. Pode confirmar a presença? Responda SIM 😊',
  },
  {
    name: 'Aniversário',
    category: 'aniversario',
    trigger: 'BIRTHDAY' as const,
    content: 'Feliz aniversário, {nome}! 🎉 Que esse novo ciclo traga muito bem-estar.',
  },
  {
    name: 'Pós-procedimento',
    category: 'retorno',
    trigger: 'AFTER_APPOINTMENT' as const,
    content:
      '{nome}, foi um prazer te atender! Lembre dos cuidados pós {procedimento}. Qualquer dúvida, estamos por aqui. 💧',
  },
  {
    name: 'Lembrete de retorno',
    category: 'retorno',
    trigger: 'INACTIVE_90_DAYS' as const,
    content:
      'Oi, {nome}! Já faz um tempinho da nossa última sessão de {procedimento}. Que tal agendarmos seu retorno? 💚',
  },
];

/** Despesas recorrentes fictícias (demonstração) — valores genéricos em BRL. */
const defaultRecurringExpenses = [
  {
    name: 'Internet e telefonia fixa',
    description: 'Plano combinado provedor.',
    amount: 189.9,
    category: 'Utilidades',
    expenseType: 'FIXED' as const,
    dueDay: 10,
  },
  {
    name: 'Energia elétrica',
    description: 'Média histórica mensal (variável conforme conta).',
    amount: 420,
    category: 'Utilidades',
    expenseType: 'VARIABLE' as const,
    dueDay: 15,
  },
  {
    name: 'Honorários contábeis',
    description: 'Mensalidade do escritório de contabilidade.',
    amount: 450,
    category: 'Serviços',
    expenseType: 'FIXED' as const,
    dueDay: 20,
  },
  {
    name: 'Assinatura de software / gestão',
    description: 'Sistema de agenda, financeiro ou similar.',
    amount: 149.9,
    category: 'Tecnologia',
    expenseType: 'FIXED' as const,
    dueDay: 1,
  },
  {
    name: 'Marketing e anúncios',
    description: 'Média mensal (Meta, Google, folder, etc.).',
    amount: 600,
    category: 'Marketing',
    expenseType: 'VARIABLE' as const,
    dueDay: 25,
  },
  {
    name: 'Reposição de insumos descartáveis',
    description: 'Luvas, gazes, aplicadores — média mensal.',
    amount: 350,
    category: 'Materiais',
    expenseType: 'VARIABLE' as const,
    dueDay: 28,
  },
];


/** Materiais de estoque para demonstração (identificados por SKU). */
const demoInventoryItems = [
  { sku: 'MAT-001', name: 'Sabonete facial neutro', unit: 'un', quantity: 50, minQuantity: 10, costPrice: 8.5, description: 'Limpeza inicial da pele' },
  { sku: 'MAT-002', name: 'Loção tônica facial', unit: 'ml', quantity: 500, minQuantity: 100, costPrice: 0.15, description: 'Tonificação pós-limpeza' },
  { sku: 'MAT-003', name: 'Máscara purificante', unit: 'un', quantity: 30, minQuantity: 5, costPrice: 12, description: 'Máscara de argila ou carvão' },
  { sku: 'MAT-004', name: 'Luva descartável (par)', unit: 'un', quantity: 200, minQuantity: 50, costPrice: 0.8 },
  { sku: 'MAT-005', name: 'Gaze estéril', unit: 'un', quantity: 500, minQuantity: 100, costPrice: 0.4 },
  { sku: 'MAT-006', name: 'Creme modelador drenagem', unit: 'ml', quantity: 2000, minQuantity: 300, costPrice: 0.12, description: 'Creme para massagem linfática' },
  { sku: 'MAT-007', name: 'Papel para drenagem', unit: 'un', quantity: 100, minQuantity: 20, costPrice: 2.5 },
  { sku: 'MAT-008', name: 'Óleo essencial drenagem', unit: 'ml', quantity: 500, minQuantity: 100, costPrice: 0.25 },
  { sku: 'MAT-009', name: 'Ácido glicólico 30%', unit: 'ml', quantity: 250, minQuantity: 50, costPrice: 1.2, description: 'Peeling químico superficial' },
  { sku: 'MAT-010', name: 'Neutralizante pH', unit: 'ml', quantity: 250, minQuantity: 50, costPrice: 0.9, description: 'Neutralização pós-peeling' },
  { sku: 'MAT-011', name: 'Protetor solar FPS 50', unit: 'un', quantity: 25, minQuantity: 5, costPrice: 18, description: 'Amostra pós-procedimento' },
  { sku: 'MAT-012', name: 'Soro fisiológico 0,9%', unit: 'ml', quantity: 1000, minQuantity: 200, costPrice: 0.05 },
  { sku: 'MAT-013', name: 'Disco microagulhamento', unit: 'un', quantity: 40, minQuantity: 10, costPrice: 22, description: 'Cartucho descartável 12 pinos' },
  { sku: 'MAT-014', name: 'Sérum vitamina C', unit: 'ml', quantity: 100, minQuantity: 20, costPrice: 2.5, description: 'Indução percutânea' },
  { sku: 'MAT-015', name: 'Máscara calmante pós-procedimento', unit: 'un', quantity: 20, minQuantity: 5, costPrice: 15 },
  { sku: 'MAT-016', name: 'Álcool 70%', unit: 'ml', quantity: 2000, minQuantity: 500, costPrice: 0.03, description: 'Assepsia de superfície' },
  { sku: 'MAT-017', name: 'Espátula descartável', unit: 'un', quantity: 150, minQuantity: 30, costPrice: 0.35 },
  { sku: 'MAT-018', name: 'Vaselina líquida', unit: 'ml', quantity: 300, minQuantity: 50, costPrice: 0.08, description: 'Lubrificante para microagulhamento' },
  { sku: 'MAT-019', name: 'Algodão hidrófilo', unit: 'un', quantity: 300, minQuantity: 60, costPrice: 0.25 },
  { sku: 'MAT-020', name: 'Máscara de hidratação intensiva', unit: 'un', quantity: 25, minQuantity: 5, costPrice: 14, description: 'Finalização limpeza de pele' },
] as const satisfies readonly { sku: string; name: string; unit: string; quantity: number; minQuantity: number; costPrice: number; description?: string }[];

/** Materiais previstos por procedimento (quantidade por atendimento). */
const demoProcedureMaterials: {
  procedureName: string;
  materials: { sku: string; quantity: number }[];
}[] = [
  {
    procedureName: 'Limpeza de pele',
    materials: [
      { sku: 'MAT-001', quantity: 1 },
      { sku: 'MAT-002', quantity: 5 },
      { sku: 'MAT-003', quantity: 1 },
      { sku: 'MAT-004', quantity: 1 },
      { sku: 'MAT-005', quantity: 2 },
      { sku: 'MAT-016', quantity: 10 },
      { sku: 'MAT-017', quantity: 1 },
      { sku: 'MAT-019', quantity: 3 },
      { sku: 'MAT-020', quantity: 1 },
    ],
  },
  {
    procedureName: 'Drenagem linfática',
    materials: [
      { sku: 'MAT-004', quantity: 1 },
      { sku: 'MAT-006', quantity: 15 },
      { sku: 'MAT-007', quantity: 1 },
      { sku: 'MAT-008', quantity: 3 },
      { sku: 'MAT-016', quantity: 5 },
    ],
  },
  {
    procedureName: 'Peeling químico',
    materials: [
      { sku: 'MAT-004', quantity: 1 },
      { sku: 'MAT-005', quantity: 3 },
      { sku: 'MAT-009', quantity: 5 },
      { sku: 'MAT-010', quantity: 5 },
      { sku: 'MAT-011', quantity: 1 },
      { sku: 'MAT-016', quantity: 10 },
      { sku: 'MAT-019', quantity: 2 },
    ],
  },
  {
    procedureName: 'Microagulhamento',
    materials: [
      { sku: 'MAT-004', quantity: 1 },
      { sku: 'MAT-012', quantity: 10 },
      { sku: 'MAT-013', quantity: 1 },
      { sku: 'MAT-014', quantity: 2 },
      { sku: 'MAT-015', quantity: 1 },
      { sku: 'MAT-016', quantity: 10 },
      { sku: 'MAT-018', quantity: 2 },
    ],
  },
];

const DEMO_DRENIAGEM_COUNT = 20;
const DEMO_DRENIAGEM_NOTE_PREFIX = 'seedDemo:drenagem-linfatica';

/** Agendamentos demo adicionais por procedimento (idempotentes via notes). */
const demoProcedureAppointments = [
  { procedureName: 'Limpeza de pele', count: 12, notePrefix: 'seedDemo:limpeza-de-pele', weekdayStart: -28 },
  { procedureName: 'Peeling químico', count: 10, notePrefix: 'seedDemo:peeling-quimico', weekdayStart: -22 },
  { procedureName: 'Microagulhamento', count: 10, notePrefix: 'seedDemo:microagulhamento', weekdayStart: -16 },
  { procedureName: 'Drenagem linfática', count: 8, notePrefix: 'seedDemo:drenagem-futuro', weekdayStart: 4 },
] as const;

/** Sexta (5) e sábado (6) — agendamentos demo extras (idempotentes via notes). */
const demoWeekendAppointments = [
  { procedureName: 'Limpeza de pele', count: 6, notePrefix: 'seedDemo:limpeza-sexta', dayOfWeek: 5 },
  { procedureName: 'Limpeza de pele', count: 4, notePrefix: 'seedDemo:limpeza-sabado', dayOfWeek: 6 },
  { procedureName: 'Drenagem linfática', count: 5, notePrefix: 'seedDemo:drenagem-sexta', dayOfWeek: 5 },
  { procedureName: 'Drenagem linfática', count: 4, notePrefix: 'seedDemo:drenagem-sabado', dayOfWeek: 6 },
  { procedureName: 'Peeling químico', count: 4, notePrefix: 'seedDemo:peeling-sexta', dayOfWeek: 5 },
  { procedureName: 'Peeling químico', count: 3, notePrefix: 'seedDemo:peeling-sabado', dayOfWeek: 6 },
  { procedureName: 'Microagulhamento', count: 4, notePrefix: 'seedDemo:micro-sexta', dayOfWeek: 5 },
  { procedureName: 'Microagulhamento', count: 3, notePrefix: 'seedDemo:micro-sabado', dayOfWeek: 6 },
] as const;

/** Avança N dias de atendimento a partir de hoje (seg–sáb; domingo não conta). */
function addClinicDays(from: Date, days: number): Date {
  const d = new Date(from);
  const dir = days >= 0 ? 1 : -1;
  let left = Math.abs(days);
  while (left > 0) {
    d.setDate(d.getDate() + dir);
    if (d.getDay() !== 0) left--;
  }
  return d;
}

/** Data de um dia da semana (0=dom … 6=sáb), deslocada por semanas a partir da semana atual. */
function dateOnWeekday(weekOffset: number, dayOfWeek: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const currentDow = d.getDay();
  let delta = dayOfWeek - currentDow;
  if (delta < 0) delta += 7;
  delta += weekOffset * 7;
  d.setDate(d.getDate() + delta);
  return d;
}

function demoWeekdayStartAt(slotIndex: number, dayOfWeek: number): Date {
  const weekOffset = Math.floor(slotIndex / 4) - 3;
  const slotInDay = slotIndex % 4;
  const hours = [8, 9, 14, 16];
  const d = dateOnWeekday(weekOffset, dayOfWeek);
  d.setHours(hours[slotInDay], (slotIndex % 3) * 15, 0, 0);
  return d;
}

function demoDrenagemStartAt(slotIndex: number): Date {
  return demoProcedureStartAt(-18, slotIndex);
}

function demoProcedureStartAt(weekdayStart: number, slotIndex: number): Date {
  const weekdayOffset = weekdayStart + slotIndex * 2;
  const hours = [8, 9, 10, 11, 14, 15, 16, 17];
  const d = addClinicDays(new Date(), weekdayOffset);
  d.setHours(hours[slotIndex % hours.length], (slotIndex % 3) * 20, 0, 0);
  return d;
}

function demoDrenagemStatus(startAt: Date, slotIndex: number): AppointmentStatus {
  return demoProcedureStatus(startAt, slotIndex);
}

function demoProcedureStatus(startAt: Date, slotIndex: number): AppointmentStatus {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const apptDay = new Date(startAt);
  apptDay.setHours(0, 0, 0, 0);

  if (apptDay < todayStart) {
    return slotIndex % 7 === 0 ? 'CANCELLED' : 'COMPLETED';
  }
  if (apptDay.getTime() === todayStart.getTime()) return 'CONFIRMED';
  return 'SCHEDULED';
}

// Planos da plataforma (preço de referência + módulos; sem cobrança automática).
// Limites informativos; ausente = ilimitado. Só cria — edições no painel não são sobrescritas.
const essencialFeatures = [
  'appointments',
  'patients',
  'procedures',
  'availability',
  'documents',
  'messages',
];
const profissionalFeatures = [
  ...essencialFeatures,
  'packages',
  'promotions',
  'routines',
  'equipment',
  'inventory',
  'finance',
  'recurring_expenses',
  'payment_methods',
  'metrics',
  'goals',
];
const enterpriseFeatures = [
  'appointments',
  'patients',
  'procedures',
  'packages',
  'promotions',
  'routines',
  'availability',
  'equipment',
  'inventory',
  'finance',
  'recurring_expenses',
  'payment_methods',
  'metrics',
  'goals',
  'documents',
  'messages',
];

const defaultPlans = [
  {
    slug: 'essencial',
    name: 'Essencial',
    description: 'Para quem atende sozinha ou com uma pequena equipe.',
    priceCents: 9700,
    currency: 'BRL',
    features: essencialFeatures,
    limits: { maxUsers: 3, maxPatients: 500, storageGb: 5 },
  },
  {
    slug: 'profissional',
    name: 'Profissional',
    description: 'Para clínicas em crescimento, com equipe e agenda cheia.',
    priceCents: 19700,
    currency: 'BRL',
    features: profissionalFeatures,
    limits: { maxUsers: 10, maxPatients: 3000, storageGb: 25 },
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    description: 'Para redes e clínicas grandes; limites sob medida.',
    priceCents: 39700,
    currency: 'BRL',
    features: enterpriseFeatures,
    limits: undefined,
  },
];

const defaultDocumentTemplates = [
  {
    name: 'Modelo padrão — Consentimento Toxina',
    category: 'consentimento',
    content: `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO — TOXINA BOTULÍNICA

Eu, {{paciente}}, CPF {{cpf}}, nascido(a) em {{nascimento}}, declaro que fui informado(a) pelo(a) profissional {{profissional}} sobre o procedimento de aplicação de toxina botulínica, seus objetivos, benefícios esperados, riscos e possíveis efeitos adversos (como dor no local, hematomas, assimetrias temporárias e cefaleia).

Declaro que informei corretamente meu histórico de saúde, uso de medicamentos e alergias, e que tive a oportunidade de esclarecer todas as minhas dúvidas.

Autorizo a realização do procedimento.

Data: {{data}}

______________________________________
{{paciente}}`,
  },
  {
    name: 'Modelo padrão — Anamnese facial',
    category: 'anamnese',
    content: `FICHA DE ANAMNESE FACIAL

Paciente: {{paciente}}
CPF: {{cpf}}    Nascimento: {{nascimento}}
Telefone: {{telefone}}    E-mail: {{email}}

1. Possui alergias? ( ) Não ( ) Sim: ______________________
2. Faz uso de medicamentos? ( ) Não ( ) Sim: ______________
3. Está gestante ou amamentando? ( ) Não ( ) Sim
4. Já realizou procedimentos estéticos na face? ( ) Não ( ) Sim: ____
5. Tem histórico de herpes, queloides ou doenças autoimunes? ( ) Não ( ) Sim

Declaro que as informações acima são verdadeiras.

Data: {{data}}

______________________________________
{{paciente}}`,
  },
  {
    name: 'Modelo padrão — Autorização de imagem',
    category: 'autorizacao_imagem',
    content: `TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM

Eu, {{paciente}}, CPF {{cpf}}, autorizo a clínica a registrar e utilizar fotografias do antes e depois dos meus procedimentos para fins de prontuário e, de forma anônima, para divulgação científica e institucional.

Esta autorização pode ser revogada a qualquer momento mediante solicitação por escrito.

Data: {{data}}

______________________________________
{{paciente}}`,
  },
];

async function seedPlatformCatalogs() {
  console.log('\n→ Garantindo catálogos da plataforma...');
  // Só cria: itens editados no painel super-admin não são sobrescritos
  for (const item of DEFAULT_PLATFORM_CATALOG) {
    await prisma.platformCatalogItem.upsert({
      where: { kind_value: { kind: item.kind, value: item.value } },
      update: {},
      create: {
        kind: item.kind,
        value: item.value,
        label: item.label,
        sortOrder: item.sortOrder,
        ...(item.meta ? { meta: item.meta as Prisma.InputJsonValue } : {}),
      },
    });
  }
  console.log(`  ✓ ${DEFAULT_PLATFORM_CATALOG.length} itens de catálogo garantidos`);
}

async function main() {
  console.log('\n→ Garantindo planos da plataforma...');
  // Só cria: planos editados no painel super-admin não são sobrescritos
  for (const plan of defaultPlans) {
    await prisma.plan.upsert({ where: { slug: plan.slug }, update: {}, create: plan });
  }

  await seedPlatformCatalogs();

  // Grupos de sistema da clínica: criados/atualizados por runInScriptTenant (ensureSystemRoles)
  console.log('\n→ Garantindo usuários...');
  for (const u of defaultUsers) {
    const role = await prisma.role.findFirst({ where: { name: u.roleName } });
    if (!role) continue;
    const email = demoEmail(u.email);
    const exists = await prisma.user.findUnique({ where: { email } });
    if (!exists) {
      const password = await bcrypt.hash(u.password, 10);
      await prisma.user.create({
        data: {
          name: u.name,
          email,
          password,
          roleId: role.id,
          providesAppointments: u.providesAppointments,
        },
      });
      console.log(`  ✓ Usuário criado: ${email} / ${u.password} (${u.roleName})`);
    } else {
      await prisma.user.update({
        where: { email },
        data: { providesAppointments: u.providesAppointments },
      });
      console.log(`  • Usuário já existe: ${email}`);
    }
  }

  console.log('\n→ Garantindo procedimentos de exemplo...');
  const procedureCount = await prisma.procedure.count();
  if (procedureCount === 0) {
    await prisma.procedure.createMany({
      data: [
        { name: 'Limpeza de pele', durationMinutes: 60, price: 150.0, recurrenceDays: 30 },
        { name: 'Drenagem linfática', durationMinutes: 50, price: 120.0, recurrenceDays: 15 },
        { name: 'Peeling químico', durationMinutes: 45, price: 250.0, recurrenceDays: 45 },
        { name: 'Microagulhamento', durationMinutes: 90, price: 350.0, recurrenceDays: 30 },
      ],
    });
    console.log('  ✓ Procedimentos criados.');
  } else {
    console.log('  • Procedimentos já existem, pulando.');
  }

  console.log('\n→ Materiais de estoque e vínculos com procedimentos...');
  for (const item of demoInventoryItems) {
    const existing = await prisma.inventoryItem.findFirst({ where: { sku: item.sku } });
    if (existing) {
      console.log(`  • Material já existe: ${item.name}`);
      continue;
    }
    await prisma.inventoryItem.create({
      data: {
        sku: item.sku,
        name: item.name,
        description: 'description' in item ? item.description : undefined,
        unit: item.unit,
        quantity: item.quantity,
        minQuantity: item.minQuantity,
        costPrice: item.costPrice,
      },
    });
    console.log(`  ✓ Material criado: ${item.name}`);
  }

  for (const link of demoProcedureMaterials) {
    const procedure = await prisma.procedure.findFirst({ where: { name: link.procedureName } });
    if (!procedure) {
      console.log(`  • Procedimento não encontrado: ${link.procedureName}`);
      continue;
    }

    const existingLinks = await prisma.procedureMaterial.count({ where: { procedureId: procedure.id } });
    if (existingLinks > 0) {
      console.log(`  • ${link.procedureName} já possui materiais vinculados, pulando.`);
      continue;
    }

    let linked = 0;
    for (const m of link.materials) {
      const inventoryItem = await prisma.inventoryItem.findFirst({ where: { sku: m.sku } });
      if (!inventoryItem) {
        console.log(`  • Item ${m.sku} não encontrado para ${link.procedureName}`);
        continue;
      }
      await prisma.procedureMaterial.create({
        data: {
          procedureId: procedure.id,
          itemId: inventoryItem.id,
          quantity: m.quantity,
        },
      });
      linked++;
    }
    console.log(`  ✓ ${link.procedureName}: ${linked} material(is) vinculado(s).`);
  }

  console.log('\n→ Garantindo templates de mensagem...');
  for (const t of defaultTemplates) {
    const exists = await prisma.messageTemplate.findFirst({ where: { name: t.name } });
    if (!exists) {
      await prisma.messageTemplate.create({ data: t });
      console.log(`  ✓ Template criado: ${t.name}`);
    }
  }

  console.log('\n→ Garantindo modelos de documento...');
  for (const t of defaultDocumentTemplates) {
    const exists = await prisma.documentTemplate.findFirst({ where: { name: t.name } });
    if (!exists) {
      await prisma.documentTemplate.create({ data: t });
      console.log(`  ✓ Modelo criado: ${t.name}`);
    }
  }

  console.log('\n→ Despesas recorrentes de exemplo...');
  for (const re of defaultRecurringExpenses) {
    const exists = await prisma.recurringExpense.findFirst({ where: { name: re.name } });
    if (!exists) {
      await prisma.recurringExpense.create({ data: { ...re, active: true } });
      console.log(`  ✓ Despesa recorrente: ${re.name}`);
    } else {
      console.log(`  • Já cadastrada: ${re.name}`);
    }
  }

  // Pacientes: rode separadamente com `npm run prisma:seed-patients`

  console.log('\n→ Agendamentos demo — Drenagem linfática...');
  const drenagemProcedure = await prisma.procedure.findFirst({
    where: { name: 'Drenagem linfática' },
  });
  const drenagemProfessional = await prisma.user.findUnique({
    where: { email: demoEmail('profissional@mila.com') },
  });
  const drenagemPatients = await prisma.patient.findMany({
    take: DEMO_DRENIAGEM_COUNT,
    orderBy: { createdAt: 'asc' },
  });

  if (!drenagemProcedure || !drenagemProfessional) {
    console.log('  • Procedimento ou profissional não encontrado, pulando agendamentos.');
  } else if (drenagemPatients.length === 0) {
    console.log('  • Nenhum paciente cadastrado — rode `npm run prisma:seed-patients` antes.');
  } else {
    const durationMs = drenagemProcedure.durationMinutes * 60 * 1000;
    let created = 0;

    for (let i = 0; i < DEMO_DRENIAGEM_COUNT; i++) {
      const seedKey = `${DEMO_DRENIAGEM_NOTE_PREFIX}:${String(i + 1).padStart(2, '0')}`;
      const patient = drenagemPatients[i % drenagemPatients.length];
      const startAt = demoDrenagemStartAt(i);
      const endAt = new Date(startAt.getTime() + durationMs);
      const status = demoDrenagemStatus(startAt, i);

      const exists = await prisma.appointment.findFirst({
        where: {
          professionalId: drenagemProfessional.id,
          procedureId: drenagemProcedure.id,
          startAt,
        },
      });
      if (exists) continue;

      const { notes, clinicalNotes } = demoAppointmentNotes(seedKey, drenagemProcedure.name, status);

      await prisma.appointment.create({
        data: {
          patientId: patient.id,
          procedureId: drenagemProcedure.id,
          professionalId: drenagemProfessional.id,
          startAt,
          endAt,
          status,
          kind: 'PROCEDURE',
          notes,
          clinicalNotes,
        },
      });
      created++;
      console.log(
        `  ✓ ${patient.name} — ${startAt.toLocaleDateString('pt-BR')} ${startAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (${status})`,
      );
    }

    if (created === 0) {
      console.log(`  • ${DEMO_DRENIAGEM_COUNT} agendamentos de drenagem já existem, pulando.`);
    }
  }

  console.log('\n→ Agendamentos demo — demais procedimentos...');
  const demoProfessional = await prisma.user.findUnique({
    where: { email: demoEmail('profissional@mila.com') },
  });
  const demoPatients = await prisma.patient.findMany({
    orderBy: { createdAt: 'asc' },
  });

  if (!demoProfessional) {
    console.log('  • Profissional não encontrado, pulando agendamentos extras.');
  } else if (demoPatients.length === 0) {
    console.log('  • Nenhum paciente cadastrado — rode `npm run prisma:seed-patients` antes.');
  } else {
    for (const cfg of demoProcedureAppointments) {
      const procedure = await prisma.procedure.findFirst({ where: { name: cfg.procedureName } });
      if (!procedure) {
        console.log(`  • Procedimento não encontrado: ${cfg.procedureName}`);
        continue;
      }

      const durationMs = procedure.durationMinutes * 60 * 1000;
      let createdForProcedure = 0;

      for (let i = 0; i < cfg.count; i++) {
        const seedKey = `${cfg.notePrefix}:${String(i + 1).padStart(2, '0')}`;
        const patient = demoPatients[i % demoPatients.length];
        const startAt = demoProcedureStartAt(cfg.weekdayStart, i);
        const endAt = new Date(startAt.getTime() + durationMs);
        const status = demoProcedureStatus(startAt, i);

        const exists = await prisma.appointment.findFirst({
          where: {
            professionalId: demoProfessional.id,
            procedureId: procedure.id,
            startAt,
          },
        });
        if (exists) continue;

        const { notes, clinicalNotes } = demoAppointmentNotes(seedKey, procedure.name, status);

        await prisma.appointment.create({
          data: {
            patientId: patient.id,
            procedureId: procedure.id,
            professionalId: demoProfessional.id,
            startAt,
            endAt,
            status,
            kind: 'PROCEDURE',
            notes,
            clinicalNotes,
          },
        });
        createdForProcedure++;
      }

      if (createdForProcedure === 0) {
        console.log(`  • ${cfg.procedureName}: ${cfg.count} agendamentos já existem, pulando.`);
      } else {
        console.log(`  ✓ ${cfg.procedureName}: ${createdForProcedure} agendamento(s) criado(s).`);
      }
    }
  }

  console.log('\n→ Agendamentos demo — sexta e sábado...');
  if (!demoProfessional) {
    console.log('  • Profissional não encontrado, pulando agendamentos de fim de semana.');
  } else if (demoPatients.length === 0) {
    console.log('  • Nenhum paciente cadastrado — rode `npm run prisma:seed-patients` antes.');
  } else {
    for (const cfg of demoWeekendAppointments) {
      const procedure = await prisma.procedure.findFirst({ where: { name: cfg.procedureName } });
      if (!procedure) {
        console.log(`  • Procedimento não encontrado: ${cfg.procedureName}`);
        continue;
      }

      const durationMs = procedure.durationMinutes * 60 * 1000;
      let createdForProcedure = 0;
      const dayLabel = cfg.dayOfWeek === 5 ? 'sexta' : 'sábado';

      for (let i = 0; i < cfg.count; i++) {
        const seedKey = `${cfg.notePrefix}:${String(i + 1).padStart(2, '0')}`;
        const patient = demoPatients[i % demoPatients.length];
        const startAt = demoWeekdayStartAt(i, cfg.dayOfWeek);
        const endAt = new Date(startAt.getTime() + durationMs);
        const status = demoProcedureStatus(startAt, i);

        const exists = await prisma.appointment.findFirst({
          where: {
            professionalId: demoProfessional.id,
            procedureId: procedure.id,
            startAt,
          },
        });
        if (exists) continue;

        const { notes, clinicalNotes } = demoAppointmentNotes(seedKey, procedure.name, status);

        await prisma.appointment.create({
          data: {
            patientId: patient.id,
            procedureId: procedure.id,
            professionalId: demoProfessional.id,
            startAt,
            endAt,
            status,
            kind: 'PROCEDURE',
            notes,
            clinicalNotes,
          },
        });
        createdForProcedure++;
      }

      if (createdForProcedure === 0) {
        console.log(`  • ${cfg.procedureName} (${dayLabel}): ${cfg.count} agendamentos já existem, pulando.`);
      } else {
        console.log(`  ✓ ${cfg.procedureName} (${dayLabel}): ${createdForProcedure} agendamento(s) criado(s).`);
      }
    }
  }

  console.log('\n→ Formas de pagamento...');
  const defaultPaymentMethods = [
    { name: 'Dinheiro', feePercent: 0, kind: 'CASH' as const, settlementDays: 0 },
    { name: 'PIX', feePercent: 0, kind: 'PIX' as const, settlementDays: 0 },
    { name: 'Débito', feePercent: 1.39, kind: 'DEBIT' as const, settlementDays: 1 },
    { name: 'Crédito à vista', feePercent: 3.19, kind: 'CREDIT' as const, settlementDays: 30 },
    { name: 'Crédito parcelado', feePercent: 4.99, kind: 'CREDIT' as const, settlementDays: 30 },
  ];

  for (const pm of defaultPaymentMethods) {
    const exists = await prisma.paymentMethod.findFirst({ where: { name: pm.name } });
    if (!exists) {
      await prisma.paymentMethod.create({
        data: {
          name: pm.name,
          feePercent: pm.feePercent,
          kind: pm.kind,
          settlementDays: pm.settlementDays,
          active: true,
        },
      });
      console.log(`  ✓ Forma de pagamento criada: ${pm.name} (taxa ${pm.feePercent}%)`);
    } else {
      await prisma.paymentMethod.update({
        where: { id: exists.id },
        data: { kind: pm.kind, settlementDays: pm.settlementDays },
      });
      console.log(`  • Já existe: ${pm.name} (tipo/prazo atualizados)`);
    }
  }

  console.log('\n→ Rotinas de skincare (produtos e regras da anamnese de pele)...');
  if ((await prisma.skincareProduct.count()) === 0) {
    const idByKey = new Map<string, string>();
    for (const { key, ...product } of SKINCARE_DEMO_PRODUCTS) {
      const created = await prisma.skincareProduct.create({ data: product });
      idByKey.set(key, created.id);
    }
    if ((await prisma.skincareRule.count()) === 0) {
      await prisma.skincareRule.createMany({
        data: SKINCARE_DEMO_RULES.map(({ productKeys, ...rule }) => ({
          ...rule,
          productIds: productKeys.map((k) => idByKey.get(k)).filter((id): id is string => !!id),
        })),
      });
    }
    console.log(`  ✓ ${SKINCARE_DEMO_PRODUCTS.length} produtos e ${SKINCARE_DEMO_RULES.length} regras criados.`);
  } else {
    console.log('  • Produtos já existem, pulando.');
  }

  console.log('\nSeed concluído.\n');
}

runInScriptTenant(prisma, main, { create: true })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
