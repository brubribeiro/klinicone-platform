/**
 * Cria pacotes vendidos e agendamentos vinculados (passado + futuro).
 * Uso: npm run prisma:seed-package-appointments
 */
import { AppointmentStatus } from '@prisma/client';
import { createScriptClient, demoEmail, runInScriptTenant } from './tenant-script';

const prisma = createScriptClient();

const PACKAGE_NAME = 'Pacote Demo 5x Drenagem';
const NOTE_PREFIX = 'seedDemo:package-appt';

function localStartAt(daysOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function ensureDemoPackage(procedureId: string) {
  let pkg = await prisma.package.findFirst({ where: { name: PACKAGE_NAME } });
  if (!pkg) {
    pkg = await prisma.package.create({
      data: {
        name: PACKAGE_NAME,
        description: 'Pacote de demonstração — 5 sessões de drenagem linfática',
        type: 'SESSIONS',
        totalPrice: 500,
        validityDays: 180,
        sessionCount: 5,
        active: true,
        items: {
          create: [{ procedureId, quantity: 5, sortOrder: 0 }],
        },
      },
    });
    console.log(`  ✓ Pacote criado: ${PACKAGE_NAME}`);
  } else {
    console.log(`  • Pacote já existe: ${PACKAGE_NAME}`);
  }
  return pkg;
}

async function ensurePatientPackage(patientId: string, packageId: string, patientName: string) {
  const existing = await prisma.patientPackage.findFirst({
    where: {
      patientId,
      packageId,
      notes: { contains: NOTE_PREFIX },
    },
  });
  if (existing) {
    console.log(`  • Pacote do paciente já existe: ${patientName}`);
    return existing;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 180);

  const pp = await prisma.patientPackage.create({
    data: {
      patientId,
      packageId,
      totalPaid: 500,
      paymentMethod: 'PIX',
      sessionsTotal: 5,
      sessionsUsed: 0,
      financeGenerated: true,
      expiresAt,
      notes: `${NOTE_PREFIX} — venda demo`,
    },
  });
  console.log(`  ✓ Pacote vendido para ${patientName}`);
  return pp;
}

async function createPackageAppointment(params: {
  patientId: string;
  procedureId: string;
  professionalId: string;
  patientPackageId: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  seedKey: string;
  procedureName: string;
}) {
  const exists = await prisma.appointment.findFirst({
    where: {
      patientPackageId: params.patientPackageId,
      startAt: params.startAt,
    },
  });
  if (exists) return null;

  return prisma.appointment.create({
    data: {
      patientId: params.patientId,
      procedureId: params.procedureId,
      professionalId: params.professionalId,
      patientPackageId: params.patientPackageId,
      startAt: params.startAt,
      endAt: params.endAt,
      status: params.status,
      kind: 'PROCEDURE',
      notes: `${NOTE_PREFIX}:${params.seedKey} — ${params.procedureName} (pacote)`,
    },
  });
}

async function main() {
  console.log('\n→ Agendamentos demo — com pacote (passado + futuro)...');

  const procedure = await prisma.procedure.findFirst({ where: { name: 'Drenagem linfática' } });
  const professional = await prisma.user.findUnique({ where: { email: demoEmail('profissional@mila.com') } });
  const patients = await prisma.patient.findMany({ take: 2, orderBy: { createdAt: 'asc' } });

  if (!procedure || !professional) {
    console.log('  • Procedimento ou profissional não encontrado — rode `npm run prisma:seed`.');
    return;
  }
  if (patients.length < 2) {
    console.log('  • Menos de 2 pacientes — rode `npm run prisma:seed-patients`.');
    return;
  }

  const pkg = await ensureDemoPackage(procedure.id);
  const durationMs = procedure.durationMinutes * 60 * 1000;

  const scenarios = [
    {
      patient: patients[0],
      slots: [
        { key: 'p1-passado-1', days: -21, hour: 10, status: 'COMPLETED' as AppointmentStatus },
        { key: 'p1-passado-2', days: -14, hour: 11, status: 'COMPLETED' as AppointmentStatus },
        { key: 'p1-futuro-1', days: 7, hour: 14, status: 'SCHEDULED' as AppointmentStatus },
        { key: 'p1-futuro-2', days: 21, hour: 15, status: 'SCHEDULED' as AppointmentStatus },
      ],
    },
    {
      patient: patients[1],
      slots: [
        { key: 'p2-passado-1', days: -10, hour: 9, status: 'COMPLETED' as AppointmentStatus },
        { key: 'p2-futuro-1', days: 3, hour: 16, status: 'SCHEDULED' as AppointmentStatus },
        { key: 'p2-futuro-2', days: 17, hour: 10, status: 'SCHEDULED' as AppointmentStatus },
      ],
    },
  ];

  let created = 0;

  for (const { patient, slots } of scenarios) {
    const patientPackage = await ensurePatientPackage(patient.id, pkg.id, patient.name);
    let completedCount = 0;

    for (const slot of slots) {
      const startAt = localStartAt(slot.days, slot.hour);
      const endAt = new Date(startAt.getTime() + durationMs);

      const appt = await createPackageAppointment({
        patientId: patient.id,
        procedureId: procedure.id,
        professionalId: professional.id,
        patientPackageId: patientPackage.id,
        startAt,
        endAt,
        status: slot.status,
        seedKey: slot.key,
        procedureName: procedure.name,
      });

      if (appt) {
        created++;
        if (slot.status === 'COMPLETED') completedCount++;
        console.log(
          `  ✓ ${patient.name} — ${startAt.toLocaleDateString('pt-BR')} ${startAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (${slot.status})`,
        );
      }
    }

    const completedInDb = await prisma.appointment.count({
      where: {
        patientPackageId: patientPackage.id,
        status: 'COMPLETED',
      },
    });

    if (completedInDb !== patientPackage.sessionsUsed) {
      await prisma.patientPackage.update({
        where: { id: patientPackage.id },
        data: {
          sessionsUsed: completedInDb,
          status: completedInDb >= patientPackage.sessionsTotal ? 'COMPLETED' : 'ACTIVE',
        },
      });
    }
  }

  if (created === 0) {
    console.log('  • Agendamentos com pacote já existem, nada novo criado.');
  } else {
    console.log(`\n  Total: ${created} agendamento(s) com pacote criado(s).`);
  }
}

runInScriptTenant(prisma, main)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
