import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SkincareProduct, SkincareRule } from '../types';
import { SkincareRoutines } from './SkincareRoutines';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ listProducts: vi.fn(), listRules: vi.fn(), removeProduct: vi.fn(), removeRule: vi.fn() }));
vi.mock('../api/skincare', () => ({ skincareApi: api }));
vi.mock('../hooks/usePlatformCatalog', () => ({ usePlatformCatalog: () => [{ value: 'acido', label: 'Ácidos' }] }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialogs }));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));
vi.mock('../contexts/usePermissions', () => ({ usePermissions: () => ({ has: (p: string) => perms.granted.has(p) }) }));
vi.mock('../components/skincare/SkincareConfigDialogs', () => ({
  SkincareProductDialog: ({ open, editing }: { open: boolean; editing: SkincareProduct | null }) =>
    open ? <div role="dialog" aria-label="produto">{editing ? `Editar produto ${editing.name}` : 'Novo produto vazio'}</div> : null,
  SkincareRuleDialog: ({ open, editing, products }: { open: boolean; editing: SkincareRule | null; products: SkincareProduct[] }) =>
    open ? <div role="dialog" aria-label="regra">{editing ? `Editar regra ${editing.id}` : 'Nova regra vazia'} ({products.length} produtos)</div> : null,
}));

const product = (o: Partial<SkincareProduct>): SkincareProduct => ({
  id: 'p1', name: 'Sérum Vitamina C', brand: 'Marca X', activeIngredient: 'Ácido ascórbico', moments: ['manha'], step: 'tratamento',
  tags: ['acido'], howTo: null, note: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...o,
});
const PRODUCTS = [
  product({}),
  product({ id: 'p2', name: 'Gel de limpeza', brand: 'Marca Y', activeIngredient: null, moments: ['manha', 'noite'], step: 'limpeza', tags: [] }),
];
const rule = (o: Partial<SkincareRule>): SkincareRule => ({
  id: 'r1', field: 'pele', value: 'oleosa', productIds: ['p2', 'p-removido'], avoidTags: ['acido'], note: 'Usar à noite',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...o,
});

function renderIt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  render(
    <QueryClientProvider client={qc}>
      <SkincareRoutines />
    </QueryClientProvider>,
  );
  return { invalidate };
}

beforeEach(() => {
  vi.clearAllMocks();
  perms.granted = new Set(['routines:edit', 'routines:delete']);
  api.listProducts.mockResolvedValue(PRODUCTS);
  api.listRules.mockResolvedValue([rule({})]);
  api.removeProduct.mockResolvedValue(undefined);
  api.removeRule.mockResolvedValue(undefined);
  dialogs.confirm.mockResolvedValue(true);
});

describe('SkincareRoutines — produtos', () => {
  it('lista produtos com ativo, momentos, etapa e características', async () => {
    renderIt();
    expect(await screen.findByText('Sérum Vitamina C')).toBeInTheDocument();
    expect(screen.getByText('Marca X')).toBeInTheDocument();
    expect(screen.getByText('Ácido ascórbico')).toBeInTheDocument();
    expect(screen.getByText('Tratamento / sérum')).toBeInTheDocument();
    expect(screen.getByText('Gel de limpeza')).toBeInTheDocument();
    expect(screen.getByText('Limpeza')).toBeInTheDocument();
    expect(screen.getAllByText('Manhã')).toHaveLength(2);
    expect(screen.getByText('Noite')).toBeInTheDocument();
    // tag traduzida pelo catálogo da plataforma; sem tags mostra traço
    expect(screen.getByText('Ácidos')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('estado vazio orienta o cadastro', async () => {
    api.listProducts.mockResolvedValue([]);
    renderIt();
    expect(await screen.findByText(/Nenhum produto cadastrado/)).toBeInTheDocument();
  });

  it('mostra esqueletos enquanto carrega', () => {
    api.listProducts.mockReturnValue(new Promise(() => {}));
    renderIt();
    expect(document.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });

  it('novo produto e editar abrem o diálogo certo', async () => {
    renderIt();
    await screen.findByText('Sérum Vitamina C');
    await userEvent.click(screen.getByRole('button', { name: 'Novo produto' }));
    expect(screen.getByRole('dialog', { name: 'produto' })).toHaveTextContent('Novo produto vazio');
  });

  it('editar um produto abre o diálogo com ele', async () => {
    renderIt();
    await screen.findByText('Sérum Vitamina C');
    await userEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    expect(screen.getByRole('dialog', { name: 'produto' })).toHaveTextContent('Editar produto Sérum Vitamina C');
  });

  it('excluir confirma, chama a API, recarrega e avisa', async () => {
    const { invalidate } = renderIt();
    await screen.findByText('Sérum Vitamina C');
    await userEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[0]);
    expect(dialogs.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Excluir "Sérum Vitamina C"?', confirmLabel: 'Excluir', confirmColor: 'error' }));
    await waitFor(() => expect(api.removeProduct).toHaveBeenCalled());
    expect(api.removeProduct.mock.calls[0][0]).toBe('p1');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Item excluído'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['skincare'] });
  });

  it('cancelar a confirmação não exclui', async () => {
    dialogs.confirm.mockResolvedValue(false);
    renderIt();
    await screen.findByText('Sérum Vitamina C');
    await userEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[0]);
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalled());
    expect(api.removeProduct).not.toHaveBeenCalled();
  });

  it('erro ao excluir mostra a mensagem do servidor', async () => {
    api.removeProduct.mockRejectedValue({ response: { data: { message: 'Produto em uso por regras' } } });
    renderIt();
    await screen.findByText('Sérum Vitamina C');
    await userEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[0]);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Produto em uso por regras'));
  });

  it('sem permissões esconde criar, editar e excluir', async () => {
    perms.granted = new Set();
    renderIt();
    await screen.findByText('Sérum Vitamina C');
    expect(screen.queryByRole('button', { name: 'Novo produto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
  });

  it('só editar: sem excluir', async () => {
    perms.granted = new Set(['routines:edit']);
    renderIt();
    await screen.findByText('Sérum Vitamina C');
    expect(screen.getAllByRole('button', { name: 'Editar' }).length).toBe(2);
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
  });
});

describe('SkincareRoutines — regras', () => {
  async function openRules() {
    renderIt();
    await screen.findByText('Sérum Vitamina C');
    await userEvent.click(screen.getByRole('button', { name: /^Regras/ }));
  }

  it('agrupa por critério, com produtos incluídos, restrições e orientação', async () => {
    await openRules();
    expect(screen.getByRole('button', { name: /^Regras/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Tipo de pele')).toBeInTheDocument();
    expect(screen.getByText('Pele oleosa')).toBeInTheDocument();
    expect(screen.getByText('1 regra')).toBeInTheDocument();
    expect(screen.getAllByText('0 regras')).toHaveLength(3);
    expect(screen.getAllByText('Nenhuma regra para este critério.')).toHaveLength(3);
    expect(screen.getByText('Inclui')).toBeInTheDocument();
    // produto removido não aparece; só o existente (p2)
    const inclui = screen.getByText('Inclui').parentElement!;
    expect(within(inclui).getByText('Gel de limpeza')).toBeInTheDocument();
    expect(within(screen.getByText('Evita').parentElement!).getByText('Ácidos')).toBeInTheDocument();
    expect(screen.getByText('Orientação: Usar à noite')).toBeInTheDocument();
  });

  it('regra sem produtos, restrições e nota esconde essas linhas', async () => {
    api.listRules.mockResolvedValue([rule({ productIds: [], avoidTags: [], note: null })]);
    await openRules();
    await screen.findByText('Pele oleosa');
    expect(screen.queryByText('Inclui')).not.toBeInTheDocument();
    expect(screen.queryByText('Evita')).not.toBeInTheDocument();
    expect(screen.queryByText(/Orientação/)).not.toBeInTheDocument();
  });

  it('nova regra abre o diálogo com os produtos; editar abre com a regra', async () => {
    await openRules();
    await userEvent.click(screen.getByRole('button', { name: 'Nova regra' }));
    expect(screen.getByRole('dialog', { name: 'regra' })).toHaveTextContent('Nova regra vazia (2 produtos)');
  });

  it('editar regra', async () => {
    await openRules();
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('dialog', { name: 'regra' })).toHaveTextContent('Editar regra r1');
  });

  it('excluir regra confirma e chama a API; erro avisa', async () => {
    await openRules();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(dialogs.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Excluir "Pele oleosa"?' }));
    await waitFor(() => expect(api.removeRule).toHaveBeenCalled());
    expect(api.removeRule.mock.calls[0][0]).toBe('r1');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Item excluído'));
  });

  it('erro ao excluir regra', async () => {
    api.removeRule.mockRejectedValue(new Error('falhou'));
    await openRules();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('falhou'));
  });

  it('cancelar a confirmação não exclui a regra', async () => {
    dialogs.confirm.mockResolvedValue(false);
    await openRules();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalled());
    expect(api.removeRule).not.toHaveBeenCalled();
  });

  it('mostra esqueleto das regras enquanto carrega', async () => {
    api.listRules.mockReturnValue(new Promise(() => {}));
    await openRules();
    expect(document.querySelectorAll('.MuiSkeleton-root').length).toBe(4);
  });

  it('volta para Produtos', async () => {
    await openRules();
    await userEvent.click(screen.getByRole('button', { name: /^Produtos/ }));
    expect(screen.getByText('Ativo principal')).toBeInTheDocument();
  });
});
