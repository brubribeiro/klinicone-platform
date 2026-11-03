/**
 * Prepara o smoke E2E (Playwright, frontend/e2e): cria uma clínica descartável com admin,
 * paciente, procedimento e forma de pagamento, e imprime em JSON um JWT de sessão do admin
 * assinado com o JWT_SECRET do backend (o login real é só Google).
 *
 *   npx ts-node --transpile-only test/e2e/e2e-session.ts            # cria e imprime JSON
 *   npx ts-node --transpile-only test/e2e/e2e-session.ts --purge ID # apaga a clínica ID
 *
 * Só para bancos de teste/CI: recusa rodar com NODE_ENV=production.
 */
import { randomUUID } from 'crypto';
import { sign } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

import '../load-env';
import { provisionTenant } from '../../src/tenancy/system-roles';
import { purgeTenants } from '../helpers/test-clinic';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('e2e-session não roda em produção');
  const base = new PrismaClient();
  try {
    const purgeIdx = process.argv.indexOf('--purge');
    if (purgeIdx > -1) {
      await purgeTenants(base, [process.argv[purgeIdx + 1]]);
      return;
    }

    const suffix = randomUUID().slice(0, 8);
    const email = `e2e-${suffix}@smoke.test`;
    const tenant = await provisionTenant(
      base,
      { name: `Clínica E2E ${suffix}`, slug: `e2e-${suffix}` },
      { name: 'Dra. Smoke', email, password: 'x' },
    );
    const admin = await base.user.findUniqueOrThrow({ where: { email } });
    const tenantId = tenant.id;
    const patient = await base.patient.create({ data: { tenantId, name: `Paciente Smoke ${suffix}` } });
    const procedure = await base.procedure.create({
      data: { tenantId, name: `Limpeza Smoke ${suffix}`, price: 180, durationMinutes: 60 },
    });
    const paymentMethod = await base.paymentMethod.create({
      data: { tenantId, name: `Pix Smoke ${suffix}`, kind: 'PIX', feePercent: 0 },
    });

    const token = sign(
      { sub: admin.id, email: admin.email, tenantId, tv: admin.tokenVersion },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' },
    );
    process.stdout.write(
      JSON.stringify({
        token,
        tenantId,
        patient: { id: patient.id, name: patient.name },
        procedure: { id: procedure.id, name: procedure.name },
        paymentMethod: { id: paymentMethod.id, name: paymentMethod.name },
        professional: { id: admin.id, name: admin.name },
      }),
    );
  } finally {
    await base.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
