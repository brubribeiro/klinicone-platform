import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SkinAnamnesisWizard } from './SkinAnamnesisWizard';
import { SkinAnamnesisDialog } from './SkinAnamnesisDialog';
import type { AnamnesisQuestion, SkincareProduct, SkincareRoutine, SkincareRule } from '../../types';

vi.setConfig({ testTimeout: 30_000 });

const skin = vi.hoisted(() => ({
  listProducts: vi.fn(), listRules: vi.fn(), listRoutines: vi.fn(), createRoutine: vi.fn(), updateRoutine: vi.fn(),
}));
vi.mock('../../api/skincare', () => ({ skincareApi: skin }));
const patApi = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock('../../api/patients', () => ({ patientsApi: patApi }));
const anam = vi.hoisted(() => ({ listQuestions: vi.fn() }));
vi.mock('../../api/anamnesis', () => ({ anamnesisApi: anam }));
vi.mock('../../api/catalogs', () => ({ catalogsApi: { list: vi.fn().mockRejectedValue(new Error('offline')) } }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));
vi.mock('../../contexts/usePermissions', () => ({ usePermissions: () => ({ has: (p: string) => perms.granted.has(p) }) }));

const prod = (id: string, o: Partial<SkincareProduct>): SkincareProduct => ({
  id, name: id, brand: null, activeIngredient: null, moments: ['manha'], step: 'limpeza', tags: [], howTo: null, note: null,
  createdAt: '', updatedAt: '', ...o,
});
const rule = (id: string, o: Partial<SkincareRule>): SkincareRule => ({
  id, field: 'pele', value: 'seca', productIds: [], avoidTags: [], note: null, createdAt: '', updatedAt: '', ...o,
});

const products = [
  prod('Gel de limpeza', { moments: ['manha', 'noite'], brand: 'Lumière', howTo: 'Massagear 1 min' }),
  prod('Retinal', { moments: ['noite'], step: 'tratamento', tags: ['retinoide'], activeIngredient: 'Retinaldeído', note: 'Introduzir aos poucos' }),
  prod('Protetor FPS 50', { moments: ['manha'], step: 'protetor' }),
  prod('Hidratante extra', { moments: ['noite'], step: 'hidratacao', brand: 'Aqua' }),
];
const rules = [
  rule('r1', { field: 'pele', value: 'seca', productIds: ['Gel de limpeza'], note: 'Hidratar bastante' }),
  rule('r2', { field: 'afeccao', value: 'melasma', productIds: ['Protetor FPS 50', 'Retinal'], note: null }),
  rule('r3', { field: 'idade', value: '35', avoidTags: ['retinoide'] }),
];

const patient = { id: 'pt1', name: 'Maria Silva', phone: '(11) 98888-7777', email: 'maria@ex.com' };

function renderWizard(props: Partial<React.ComponentProps<typeof SkinAnamnesisWizard>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSaved = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <SkinAnamnesisWizard patient={patient} onSaved={onSaved} {...props} />
    </QueryClientProvider>,
  );
  return { onSaved };
}

const click = (text: string | RegExp) => userEvent.click(screen.getByText(text));
const btn = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));

async function fillCore(opts: { pele?: string; afec?: string[]; idade?: string } = {}) {
  await click(opts.pele ?? 'Seca');
  await btn('Continuar');
  for (const a of opts.afec ?? ['Melasma']) await click(a);
  await btn('Continuar');
  await click('Não');
  await btn('Continuar');
  await click(opts.idade ?? '35+');
  await btn('Continuar');
}

beforeEach(() => {
  Object.values(skin).forEach((f) => f.mockReset());
  patApi.findOne.mockReset().mockResolvedValue({ id: 'pt1', name: 'Maria Silva', anamnesis: {} });
  anam.listQuestions.mockReset().mockResolvedValue([]);
  toast.error.mockReset();
  toast.success.mockReset();
  perms.granted = new Set(['routines:create', 'routines:edit', 'patients:view']);
  skin.listProducts.mockResolvedValue(products);
  skin.listRules.mockResolvedValue(rules);
  skin.listRoutines.mockResolvedValue([]);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('SkinAnamnesisWizard — assistente', () => {
  it('só avança com resposta válida em cada pergunta', async () => {
    renderWizard();
    expect(await screen.findByText('Pergunta 1 de 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await click('Oleosa');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
    await btn('Continuar');
    expect(screen.getByText('Pergunta 2 de 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    // "Outra" exige descrição; "Não" é exclusivo
    await click('Outra');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText('Ex.: dermatite seborreica'), 'Dermatite');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
    await click('Não');
    expect(screen.queryByPlaceholderText('Ex.: dermatite seborreica')).not.toBeInTheDocument();
    await btn('Continuar');
    // olheiras: sim exige tipo
    await click('Sim');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await click('Vasculares');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
    await click('Não');
    expect(screen.queryByText('Qual o tipo de olheira?')).not.toBeInTheDocument();
    await btn('Continuar');
    // idade com teclado
    const radio = screen.getByRole('radio', { name: /55\+/ });
    radio.focus();
    await userEvent.keyboard('{Enter}');
    expect(radio).toHaveAttribute('aria-checked', 'true');
    await btn('Continuar');
    expect(screen.getByText('Revise as respostas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar rotina' })).toBeEnabled();
  });

  it('voltar retorna à pergunta anterior', async () => {
    renderWizard();
    await click('Seca');
    await btn('Continuar');
    await btn('Voltar');
    expect(screen.getByText('Pergunta 1 de 4')).toBeInTheDocument();
  });

  it('revisão permite editar uma resposta e voltar à revisão', async () => {
    renderWizard();
    await fillCore();
    expect(screen.getByText('Revise as respostas')).toBeInTheDocument();
    expect(screen.getByText(/^Maria Silva · \d{2}\/\d{2}\/\d{4}$/)).toBeInTheDocument();
    const rows = screen.getAllByRole('button', { name: 'Editar' });
    await userEvent.click(rows[1]); // Tipo de pele
    await click('Mista');
    expect(screen.getByRole('button', { name: 'Cancelar edição' })).toBeInTheDocument();
    await btn('Voltar à revisão');
    expect(screen.getByText('Mista')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]); // paciente
    expect(screen.getByDisplayValue('Maria Silva')).toHaveAttribute('readonly');
    await btn('Cancelar edição');
    expect(screen.getByText('Revise as respostas')).toBeInTheDocument();
  });

  it('gera rotina pelas regras, com evitados e orientações, e salva na ficha', async () => {
    skin.createRoutine.mockResolvedValue({ id: 'new1' });
    const { onSaved } = renderWizard();
    await fillCore({ pele: 'Seca', afec: ['Melasma'], idade: '35+' });
    await btn('Gerar rotina');
    expect(await screen.findByText('Rotina de skincare personalizada')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Maria Silva' })).toBeInTheDocument();
    // itens: gel manhã+noite, protetor manhã; Retinal evitado
    expect(screen.getAllByText('Gel de limpeza')).toHaveLength(2);
    expect(screen.getByText('Protetor FPS 50')).toBeInTheDocument();
    expect(screen.getAllByText('Massagear 1 min')).toHaveLength(2);
    expect(screen.getByText('Evitados nesta rotina')).toBeInTheDocument();
    expect(screen.getByText(/Evitado por Retinoides · Faixa 35\+/)).toBeInTheDocument();
    expect(screen.getByText('Hidratar bastante')).toBeInTheDocument();
    expect(screen.getByText('Pele seca')).toBeInTheDocument();
    expect(screen.getAllByText('Sem indicação pelas regras atuais.').length).toBeGreaterThan(0);

    await userEvent.type(screen.getByPlaceholderText(/retorno em 30 dias/), '  Voltar em 30 dias ');
    await btn('Salvar na ficha');
    await waitFor(() => expect(skin.createRoutine).toHaveBeenCalled());
    const payload = skin.createRoutine.mock.calls[0][0];
    expect(payload).toMatchObject({
      patientId: 'pt1',
      notes: 'Voltar em 30 dias',
      answers: { pele: 'seca', afec: ['melasma'], olheira: 'nao', idade: '35' },
      avoided: [{ productId: 'Retinal', name: 'Retinal' }],
      guidelines: [{ text: 'Hidratar bastante', source: 'Pele seca' }],
    });
    expect(payload.consultDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.items.map((i: { name: string; moment: string }) => `${i.moment}:${i.name}`).sort()).toEqual(
      ['manha:Gel de limpeza', 'manha:Protetor FPS 50', 'noite:Gel de limpeza'],
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Rotina salva na ficha de Maria Silva'));
    expect(onSaved).toHaveBeenCalledWith({ id: 'new1' });
    expect(await screen.findByText('Salvo na ficha')).toBeInTheDocument();
    // editar depois do salvo volta a "Salvar"
    await userEvent.type(screen.getByPlaceholderText(/retorno em 30 dias/), '!');
    skin.updateRoutine.mockResolvedValue({ id: 'new1' });
    await btn('Salvar na ficha');
    await waitFor(() => expect(skin.updateRoutine.mock.calls[0]?.[0]).toBe('new1'));
  });

  it('erro ao salvar mostra aviso e mantém o botão', async () => {
    skin.createRoutine.mockRejectedValue(new Error('x'));
    renderWizard();
    await fillCore();
    await btn('Gerar rotina');
    await btn('Salvar na ficha');
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Salvar na ficha' })).toBeInTheDocument();
  });

  it('edição manual: remove produto e adiciona outro do catálogo na etapa', async () => {
    renderWizard();
    await fillCore();
    await btn('Gerar rotina');
    await btn('Editar rotina');
    const removes = await screen.findAllByRole('button', { name: 'Remover da rotina' });
    expect(removes.length).toBe(3);
    await userEvent.click(removes[2]);
    expect(screen.getAllByText('Gel de limpeza')).toHaveLength(1);
    // Adicionar "Hidratante extra" à etapa Hidratação da noite
    const selects = screen.getAllByText('+ Adicionar produto a esta etapa');
    let added = false;
    for (const sel of selects) {
      await userEvent.click(sel);
      const opt = screen.queryByRole('option', { name: /Hidratante extra/ });
      if (opt) {
        await userEvent.click(opt);
        added = true;
        break;
      }
      await userEvent.keyboard('{Escape}');
    }
    expect(added).toBe(true);
    expect(await screen.findByText('Hidratante extra')).toBeInTheDocument();
    await btn('Concluir edição');
    expect(screen.queryByRole('button', { name: 'Remover da rotina' })).not.toBeInTheDocument();
  });

  it('imprimir chama window.print; "Revisar respostas" volta à revisão; nova anamnese reinicia', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    renderWizard();
    await fillCore();
    await btn('Gerar rotina');
    await btn(/Imprimir/);
    expect(print).toHaveBeenCalled();
    await btn('Revisar respostas');
    expect(screen.getByText('Revise as respostas')).toBeInTheDocument();
    await btn('Gerar rotina');
    await btn('Iniciar nova anamnese');
    expect(await screen.findByText('Pergunta 1 de 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('sem permissão de criar não oferece salvar; enviar abre o diálogo de envio', async () => {
    perms.granted = new Set();
    renderWizard();
    await fillCore();
    await btn('Gerar rotina');
    expect(screen.queryByRole('button', { name: /Salvar na ficha/ })).not.toBeInTheDocument();
    await btn('Enviar para paciente');
    expect(await screen.findByText('Enviar rotina para a paciente')).toBeInTheDocument();
  });

  it('Gerar rotina espera o catálogo carregar', async () => {
    let resolve: (v: SkincareProduct[]) => void = () => undefined;
    skin.listProducts.mockReturnValue(new Promise<SkincareProduct[]>((r) => { resolve = r; }));
    renderWizard();
    await fillCore();
    expect(screen.getByRole('button', { name: 'Gerar rotina' })).toBeDisabled();
    resolve(products);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Gerar rotina' })).toBeEnabled());
  });
});

describe('SkinAnamnesisWizard — perguntas cadastradas e rotina salva', () => {
  const q = (o: Partial<AnamnesisQuestion>): AnamnesisQuestion => ({
    id: o.key ?? 'q', kind: 'SKIN', key: 'x', label: 'x', type: 'TEXT', options: [], section: null, placeholder: null,
    required: false, sortOrder: 0, active: true, system: false, ...o,
  });
  const questions = [
    q({ key: 'pele', label: 'Como está a pele?', system: true, sortOrder: 1 }),
    q({ key: 'fototipo', label: 'Fototipo', type: 'SINGLE_CHOICE', options: ['I', 'II', 'III'], required: true, sortOrder: 2 }),
    q({ key: 'obs', label: 'Algo mais?', type: 'TEXT', sortOrder: 3 }),
    q({ key: 'afec', label: 'Afecções', system: true, sortOrder: 4 }),
    q({ key: 'olheira', label: 'Olheiras', system: true, sortOrder: 5 }),
    q({ key: 'idade', label: 'Idade', system: true, sortOrder: 6 }),
    q({ key: 'desativada', label: 'Pergunta inativa', active: false, sortOrder: 7 }),
  ];

  it('usa a ordem cadastrada, agrupa perguntas extras, exige obrigatórias e pré-preenche do cadastro antigo', async () => {
    anam.listQuestions.mockResolvedValue(questions);
    patApi.findOne.mockResolvedValue({ id: 'pt1', name: 'Maria Silva', anamnesis: { fototipo: 'II', desativada: 'x' } });
    skin.createRoutine.mockResolvedValue({ id: 'n' });
    renderWizard();
    expect(await screen.findByText('Como está a pele?')).toBeInTheDocument();
    expect(screen.getByText('Pergunta 1 de 5')).toBeInTheDocument();
    await click('Normal');
    await btn('Continuar');
    // Etapa com perguntas da clínica; Fototipo vem preenchido (II)
    expect(await screen.findByText('Mais sobre a pele')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('II')).toBeInTheDocument());
    expect(screen.queryByText('Pergunta inativa')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
    // desmarcar o fototipo (toggle) torna a obrigatória pendente
    await click('II');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await click('III');
    await userEvent.type(screen.getByLabelText('Algo mais?'), 'Usa filtro');
    await btn('Continuar');
    await click('Rosácea');
    await btn('Continuar');
    await click('Não');
    await btn('Continuar');
    await click('25+');
    await btn('Continuar');
    expect(screen.getByText('Fototipo')).toBeInTheDocument();
    expect(screen.getByText('Usa filtro')).toBeInTheDocument();
    await btn('Gerar rotina');
    await btn('Salvar na ficha');
    await waitFor(() => expect(skin.createRoutine).toHaveBeenCalled());
    expect(skin.createRoutine.mock.calls[0][0].answers.extra).toEqual({ fototipo: 'III', obs: 'Usa filtro' });
  });

  it('pré-preenche com a última rotina da paciente', async () => {
    anam.listQuestions.mockResolvedValue(questions);
    skin.listRoutines.mockResolvedValue([
      { id: 'old', answers: { pele: 'seca', afec: [], afecOutra: '', olheira: '', olheiraTipo: '', idade: '', extra: { fototipo: 'I' } } },
    ]);
    renderWizard();
    await userEvent.click(await screen.findByText('Normal'));
    await btn('Continuar');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled());
  });

  const saved: SkincareRoutine = {
    id: 'rt9', patientId: 'pt1', consultDate: '2026-03-10T00:00:00.000Z',
    answers: { pele: 'oleosa', afec: ['outra'], afecOutra: 'Dermatite', olheira: 'sim', olheiraTipo: 'mistas', idade: '55' },
    items: [{ moment: 'noite', step: 'tratamento', productId: 'Retinal', name: 'Retinal', brand: 'Aqua', activeIngredient: 'Retinaldeído', howTo: null, note: 'Aos poucos' }],
    avoided: [], guidelines: [], notes: 'Obs antiga', createdById: null, createdByName: null, createdAt: '', updatedAt: '',
  };

  it('abre rotina salva direto no resultado, sem pré-preenchimento, e atualiza ao editar', async () => {
    skin.updateRoutine.mockResolvedValue(saved);
    renderWizard({ routine: saved });
    expect(await screen.findByText('Consulta de 10/03/2026')).toBeInTheDocument();
    expect(screen.getByText('Retinal')).toBeInTheDocument();
    expect(screen.getByText('Retinaldeído')).toBeInTheDocument();
    expect(screen.getByText('Aos poucos')).toBeInTheDocument();
    expect(screen.getByText('Outra: Dermatite')).toBeInTheDocument();
    expect(screen.getByText('Sim · Mistas')).toBeInTheDocument();
    expect(screen.getByText('Salvo na ficha')).toBeInTheDocument();
    expect(skin.listRoutines).not.toHaveBeenCalled();
    expect(patApi.findOne).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Obs antiga')).toBeInTheDocument();
    await userEvent.type(screen.getByDisplayValue('Obs antiga'), ' extra');
    await btn('Salvar na ficha');
    await waitFor(() => expect(skin.updateRoutine).toHaveBeenCalledWith('rt9', expect.objectContaining({ notes: 'Obs antiga extra' })));
  });

  it('dialog mostra paciente e rotina; fecha pelo botão', async () => {
    const onClose = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <SkinAnamnesisDialog open onClose={onClose} patient={patient} routine={saved} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Rotina de skincare personalizada')).toBeInTheDocument();
    expect(screen.getAllByText('Anamnese de pele')[0]).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button').find((b) => b.getAttribute('aria-label')?.match(/Fechar/i))!);
    expect(onClose).toHaveBeenCalled();
    rerender(
      <QueryClientProvider client={client}>
        <SkinAnamnesisDialog open onClose={onClose} patient={null} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.queryByText('Anamnese de pele')).not.toBeInTheDocument());
  });
});
