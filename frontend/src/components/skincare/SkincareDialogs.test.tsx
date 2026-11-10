import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SkincareProductDialog, SkincareRuleDialog } from './SkincareConfigDialogs';
import { SendRoutineDialog } from './SendRoutineDialog';
import { PatientSkinRoutinesCard } from './PatientSkinRoutinesCard';
import type { SkincareProduct, SkincareRoutine, SkincareRule, SkincareRoutineItem } from '../../types';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({
  createProduct: vi.fn(), updateProduct: vi.fn(), createRule: vi.fn(), updateRule: vi.fn(), listRoutines: vi.fn(),
}));
vi.mock('../../api/skincare', () => ({ skincareApi: api }));
vi.mock('../../api/catalogs', () => ({ catalogsApi: { list: vi.fn().mockRejectedValue(new Error('offline')) } }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));
vi.mock('../../contexts/usePermissions', () => ({ usePermissions: () => ({ has: (p: string) => perms.granted.has(p) }) }));
// O assistente tem testes próprios; aqui só importa qual rotina o cartão abre.
vi.mock('./SkinAnamnesisDialog', () => ({
  SkinAnamnesisDialog: ({ open, routine }: { open: boolean; routine?: SkincareRoutine | null }) =>
    open ? <div role="dialog">{routine ? `Rotina ${routine.id}` : 'Nova anamnese'}</div> : null,
}));

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

const product = (o: Partial<SkincareProduct> = {}): SkincareProduct => ({
  id: 'p1', name: 'Sérum C', brand: 'Lumière', activeIngredient: 'Ácido ascórbico', moments: ['manha'], step: 'tratamento',
  tags: ['acido'], howTo: '3 gotas', note: 'Aos poucos', createdAt: '', updatedAt: '', ...o,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  toast.error.mockReset();
  toast.success.mockReset();
  perms.granted = new Set(['routines:create']);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('SkincareProductDialog', () => {
  it('valida nome e momento antes de salvar', async () => {
    const onClose = vi.fn();
    wrap(<SkincareProductDialog open onClose={onClose} editing={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar produto' }));
    expect(toast.error).toHaveBeenCalledWith('Informe o nome do produto');
    await userEvent.type(screen.getByPlaceholderText(/Sérum vitamina C/), 'Gel de limpeza');
    await userEvent.click(screen.getByText('Manhã'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar produto' }));
    expect(toast.error).toHaveBeenCalledWith('Escolha ao menos um momento de uso');
    expect(api.createProduct).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cadastra produto com momentos, etapa e características', async () => {
    api.createProduct.mockResolvedValue(product());
    const onClose = vi.fn();
    wrap(<SkincareProductDialog open onClose={onClose} editing={null} />);
    expect(screen.getByText('Novo produto')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/Sérum vitamina C/), 'Sérum C');
    await userEvent.type(screen.getByPlaceholderText(/Lumière Lab/), 'Lumière');
    await userEvent.click(screen.getByText('Noite'));
    await userEvent.click(screen.getAllByRole('combobox')[0]);
    await userEvent.click(await screen.findByRole('option', { name: 'Hidratação' }));
    await userEvent.click(screen.getByPlaceholderText('Buscar características…'));
    await userEvent.click(await screen.findByRole('option', { name: 'Retinoides' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar produto' }));
    await waitFor(() =>
      expect(api.createProduct).toHaveBeenCalledWith({
        name: 'Sérum C', brand: 'Lumière', activeIngredient: '', moments: ['manha', 'noite'], step: 'hidratacao',
        tags: ['retinoide'], howTo: '', note: '',
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Produto cadastrado');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('edita produto existente e mostra erro da API', async () => {
    api.updateProduct.mockRejectedValue(new Error('x'));
    wrap(<SkincareProductDialog open onClose={vi.fn()} editing={product()} />);
    expect(screen.getByText('Editar produto')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sérum C')).toBeInTheDocument();
    expect(screen.getByText('Ácidos (baixa concentração)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar produto' }));
    await waitFor(() => expect(api.updateProduct.mock.calls[0]?.[0]).toBe('p1'));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});

describe('SkincareRuleDialog', () => {
  const products = [product(), product({ id: 'p2', name: 'Protetor FPS 50', step: 'protetor' })];

  it('exige ao menos um produto ou restrição', async () => {
    wrap(<SkincareRuleDialog open onClose={vi.fn()} editing={null} products={products} />);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar regra' }));
    expect(toast.error).toHaveBeenCalledWith('Inclua ao menos um produto ou restrição');
    expect(api.createRule).not.toHaveBeenCalled();
  });

  it('cria regra trocando o critério (resposta volta ao primeiro valor)', async () => {
    api.createRule.mockResolvedValue({});
    const onClose = vi.fn();
    wrap(<SkincareRuleDialog open onClose={onClose} editing={null} products={products} />);
    await userEvent.click(screen.getAllByRole('combobox')[0]);
    await userEvent.click(await screen.findByRole('option', { name: 'Faixa etária' }));
    expect(screen.getAllByRole('combobox')[1]).toHaveTextContent('25+');
    await userEvent.click(screen.getByPlaceholderText('Buscar produtos…'));
    await userEvent.click(await screen.findByRole('option', { name: /Protetor FPS 50/ }));
    await userEvent.click(screen.getByPlaceholderText('Buscar características…'));
    await userEvent.click(await screen.findByRole('option', { name: 'Fragrância' }));
    await userEvent.type(screen.getByPlaceholderText(/um ativo novo por vez/), 'Reaplicar');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar regra' }));
    await waitFor(() =>
      expect(api.createRule).toHaveBeenCalledWith({
        field: 'idade', value: '25', productIds: ['p2'], avoidTags: ['fragrancia'], note: 'Reaplicar',
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Regra criada');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('edita regra existente', async () => {
    api.updateRule.mockResolvedValue({});
    const rule: SkincareRule = {
      id: 'r1', field: 'afeccao', value: 'melasma', productIds: ['p2'], avoidTags: [], note: null, createdAt: '', updatedAt: '',
    };
    wrap(<SkincareRuleDialog open onClose={vi.fn()} editing={rule} products={products} />);
    expect(screen.getByText('Editar regra')).toBeInTheDocument();
    expect(screen.getByText('Protetor FPS 50')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar regra' }));
    await waitFor(() =>
      expect(api.updateRule).toHaveBeenCalledWith('r1', { field: 'afeccao', value: 'melasma', productIds: ['p2'], avoidTags: [], note: '' }),
    );
    expect(toast.success).toHaveBeenCalledWith('Regra atualizada');
  });

  it('sem produtos cadastrados orienta o cadastro', () => {
    wrap(<SkincareRuleDialog open onClose={vi.fn()} editing={null} products={[]} />);
    expect(screen.getByPlaceholderText('Cadastre produtos na aba Produtos')).toBeInTheDocument();
  });
});

describe('SendRoutineDialog', () => {
  let open: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    open = vi.spyOn(window, 'open').mockReturnValue(null);
  });
  const items: SkincareRoutineItem[] = [
    { moment: 'manha', step: 'limpeza', productId: 'p1', name: 'Gel de limpeza', brand: 'Lumière', activeIngredient: null, howTo: 'Massagear', note: null },
    { moment: 'noite', step: 'tratamento', productId: 'p2', name: 'Retinal', brand: null, activeIngredient: null, howTo: null, note: 'Introduzir aos poucos' },
  ];
  const patient = { id: 'pt', name: 'Maria Silva', phone: '(11) 98888-7777', email: 'maria@ex.com' };

  function setup(p: { id: string; name: string; phone?: string | null; email?: string | null } = patient) {
    const onClose = vi.fn();
    wrap(
      <SendRoutineDialog open onClose={onClose} patient={p} consultDate="2026-03-10" items={items}
        guidelines={[{ text: 'Use protetor', source: 'Pele seca' }]} notes="Retorno em 30 dias" />,
    );
    return { onClose };
  }

  it('abre wa.me com mensagem e rotina em texto', async () => {
    const { onClose } = setup();
    expect(screen.getByDisplayValue(/Olá, Maria! .* consulta de 10\/03\/2026/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('(11) 90000-0000')).toHaveValue('(11) 98888-7777');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    const url = String(open.mock.calls[0][0]);
    expect(url.startsWith('https://wa.me/5511988887777?text=')).toBe(true);
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toContain('*Manhã*');
    expect(text).toContain('1. Limpeza: Gel de limpeza (Lumière)');
    expect(text).toContain('   Massagear');
    expect(text).toContain('⚠ Introduzir aos poucos');
    expect(text).toContain('• Use protetor');
    expect(text).toContain('Retorno em 30 dias');
    expect(open.mock.calls[0][1]).toBe('_blank');
    expect(onClose).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Rotina aberta no WhatsApp');
  });

  it('e-mail monta mailto sem asteriscos de formatação', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'E-mail' }));
    expect(screen.getByPlaceholderText('email@exemplo.com')).toHaveValue('maria@ex.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    const url = String(open.mock.calls[0][0]);
    expect(url).toContain('mailto:maria%40ex.com?subject=Sua%20rotina%20de%20skincare&body=');
    expect(decodeURIComponent(url)).not.toContain('*Manhã*');
    expect(decodeURIComponent(url)).toContain('Manhã');
    expect(toast.success).toHaveBeenCalledWith('Rotina aberta no seu e-mail');
  });

  it('exige contato antes de enviar', async () => {
    const { onClose } = setup({ id: 'pt', name: 'Ana', phone: null, email: null });
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(toast.error).toHaveBeenCalledWith('Informe o WhatsApp da paciente');
    await userEvent.click(screen.getByRole('button', { name: 'E-mail' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(toast.error).toHaveBeenCalledWith('Informe o e-mail da paciente');
    expect(open).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('PatientSkinRoutinesCard', () => {
  const patient = { id: 'pt', name: 'Maria Silva' };
  const routine = (o: Partial<SkincareRoutine> = {}): SkincareRoutine => ({
    id: 'r1', patientId: 'pt', consultDate: '2026-03-10T00:00:00.000Z',
    answers: { pele: 'seca', afec: ['melasma', 'rosacea'], afecOutra: '', olheira: 'nao', olheiraTipo: '', idade: '35' },
    items: [
      { moment: 'manha', step: 'limpeza', productId: 'p1', name: 'Gel', brand: null, activeIngredient: null, howTo: null, note: null },
      { moment: 'noite', step: 'limpeza', productId: 'p1', name: 'Gel', brand: null, activeIngredient: null, howTo: null, note: null },
    ],
    avoided: [], guidelines: [], notes: null, createdById: 'u1', createdByName: 'Dra. Mila', createdAt: '', updatedAt: '', ...o,
  });

  it('lista rotinas com resumo e abre a escolhida', async () => {
    api.listRoutines.mockResolvedValue([routine(), routine({ id: 'r2', items: [routine().items[0]], createdByName: null })]);
    wrap(<PatientSkinRoutinesCard patient={patient} />);
    expect(await screen.findAllByText(/Rotina de skincare · 10\/03\/2026/)).toHaveLength(2);
    expect(api.listRoutines).toHaveBeenCalledWith('pt');
    expect(screen.getAllByText('Pele seca · Melasma, Rosácea · 35+')).toHaveLength(2);
    expect(screen.getByText('2 produtos · Dra. Mila')).toBeInTheDocument();
    expect(screen.getByText('1 produto')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /Rotina de skincare/ })[1]);
    expect(screen.getByRole('dialog')).toHaveTextContent('Rotina r2');
  });

  it('abre pelo teclado e inicia nova anamnese quando tem permissão', async () => {
    api.listRoutines.mockResolvedValue([routine()]);
    wrap(<PatientSkinRoutinesCard patient={patient} />);
    const row = await screen.findByRole('button', { name: /Rotina de skincare/ });
    row.focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('dialog')).toHaveTextContent('Rotina r1');
  });

  it('estado vazio e botão de nova anamnese', async () => {
    api.listRoutines.mockResolvedValue([]);
    wrap(<PatientSkinRoutinesCard patient={patient} />);
    expect(await screen.findByText('Nenhuma rotina de skincare gerada para esta paciente.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Nova anamnese de pele/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Nova anamnese');
  });

  it('sem permissão de criar não mostra o botão', async () => {
    perms.granted = new Set();
    api.listRoutines.mockResolvedValue([]);
    wrap(<PatientSkinRoutinesCard patient={patient} />);
    await screen.findByText(/Nenhuma rotina/);
    expect(screen.queryByRole('button', { name: /Nova anamnese de pele/ })).not.toBeInTheDocument();
  });
});
