import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));

interface Session {
  tenantId: string;
  patient: { id: string; name: string };
  procedure: { id: string; name: string };
  paymentMethod: { id: string; name: string };
  professional: { id: string; name: string };
}

const session: Session = JSON.parse(readFileSync(path.resolve(e2eDir, '.auth/session.json'), 'utf8'));

// Retry no CI: apaga o que uma tentativa anterior deixou (o novo agendamento usa o horário atual).
test.beforeEach(async ({ request }) => {
  const from = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const to = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const res = await request.get(`/api/appointments?from=${from}&to=${to}`);
  expect(res.ok()).toBe(true);
  for (const appt of (await res.json()) as { id: string; patientId: string }[]) {
    if (appt.patientId === session.patient.id) await request.delete(`/api/appointments/${appt.id}`);
  }
});

test('agendar, concluir e pagar um atendimento', async ({ page }) => {
  // 1. Novo agendamento a partir da agenda, com a paciente já escolhida (?novo=1&paciente=)
  await page.goto(`/agenda?novo=1&paciente=${session.patient.id}`);
  const form = page.getByRole('dialog').filter({ hasText: 'Novo agendamento' });
  await expect(form).toBeVisible();
  await expect(form.getByText(session.patient.name).first()).toBeVisible();

  await form.getByPlaceholder('Selecione um ou mais procedimentos').click();
  await page.getByRole('option', { name: session.procedure.name }).click();
  await page.keyboard.press('Escape');
  await expect(form.getByText(session.professional.name).first()).toBeVisible();

  const created = page.waitForResponse(
    (r) => r.url().endsWith('/api/appointments') && r.request().method() === 'POST',
  );
  await form.getByRole('button', { name: 'Confirmar agendamento' }).click();
  const createdRes = await created;
  expect(createdRes.status()).toBe(201);
  const appointment = (await createdRes.json()) as { id: string; startAt: string };
  await expect(form).toBeHidden();

  // 2. Abre o agendamento na agenda e marca como concluído
  await page.locator('.fc-event').filter({ hasText: session.patient.name }).first().click();
  const edit = page.getByRole('dialog').filter({ hasText: 'Editar agendamento' });
  await expect(edit).toBeVisible();
  // select de status no cabeçalho (rótulo "Status" não está ligado ao combobox)
  await edit.getByRole('combobox').filter({ hasText: 'Agendado' }).click();
  await page.getByRole('option', { name: 'Concluído' }).click();
  await edit.getByRole('button', { name: 'Salvar alterações' }).click();

  // 3. Forma de pagamento ao concluir
  const payment = page.getByRole('dialog').filter({ hasText: 'Registrar no financeiro' });
  await expect(payment).toBeVisible();
  await expect(payment.getByText(/R\$\s*180,00/)).toBeVisible();
  await payment.getByRole('combobox').first().click();
  await page.getByRole('option', { name: session.paymentMethod.name }).click();
  const saved = page.waitForResponse(
    (r) => r.url().includes(`/api/appointments/${appointment.id}`) && r.request().method() === 'PATCH',
  );
  await payment.getByRole('button', { name: 'Confirmar e registrar' }).click();
  expect((await saved).ok()).toBe(true);

  // 4. Conferência pela API com a mesma sessão
  const appt = await (await page.request.get(`/api/appointments/${appointment.id}`)).json();
  expect(appt).toMatchObject({ status: 'COMPLETED', financeGenerated: true });

  const entries = (await (await page.request.get(`/api/finance?patientId=${session.patient.id}`)).json()) as {
    appointmentId: string;
    amount: string;
    type: string;
    paymentMethodId: string;
  }[];
  const income = entries.find((e) => e.appointmentId === appointment.id && e.type === 'INCOME');
  expect(income).toBeDefined();
  expect(Number(income!.amount)).toBe(180);
  expect(income!.paymentMethodId).toBe(session.paymentMethod.id);
});
