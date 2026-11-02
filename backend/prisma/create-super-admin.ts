/**
 * Cria ou promove super-admin da plataforma. Login via Google com o e-mail.
 * Se o e-mail já for usuário de clínica, define isSuperAdmin (mantém tenantId e grupo).
 * Uso: npm run prisma:create-super-admin -- --email voce@exemplo.com --name "Seu Nome"
 * (ou SUPER_ADMIN_EMAIL / SUPER_ADMIN_NAME no ambiente)
 */
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Client sem escopo de tenant (promove dual ou cria super-admin puro).
const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = (arg('email') ?? process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const nameProvided = arg('name') !== undefined || process.env.SUPER_ADMIN_NAME !== undefined;
  const name = (arg('name') ?? process.env.SUPER_ADMIN_NAME ?? 'Super-admin').trim();
  if (!email || !email.includes('@')) {
    throw new Error('Informe o e-mail: npm run prisma:create-super-admin -- --email voce@exemplo.com --name "Seu Nome"');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.isSuperAdmin) {
    if (nameProvided && existing.name !== name) {
      await prisma.user.update({ where: { email }, data: { name } });
      console.log(`✓ Nome do super-admin atualizado: ${email} → "${name}"`);
    } else {
      console.log(`• Super-admin já existe: ${email}`);
    }
    return;
  }
  if (existing) {
    const data: { isSuperAdmin: true; name?: string } = { isSuperAdmin: true };
    if (nameProvided) data.name = name;
    await prisma.user.update({ where: { email }, data });
    const nameNote = nameProvided ? ` · nome: "${name}"` : '';
    console.log(`✓ Usuário de clínica promovido a super-admin: ${email}${nameNote}`);
    return;
  }

  // Login é via Google; a senha só preenche o campo obrigatório.
  const password = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
  await prisma.user.create({
    data: { name, email, password, isSuperAdmin: true, tenantId: null, roleId: null, providesAppointments: false },
  });
  console.log(`✓ Super-admin criado: ${email}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
