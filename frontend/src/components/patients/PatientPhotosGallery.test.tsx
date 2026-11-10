import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PatientPhotosGallery } from './PatientPhotosGallery';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({
  listPhotos: vi.fn(),
  findOne: vi.fn(),
  addPhoto: vi.fn(),
  removePhoto2: vi.fn(),
}));
vi.mock('../../api/patients', () => ({ patientsApi: api }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

const photos = [
  { id: 'b1', phase: 'BEFORE', url: 'https://img/b1.jpg', appointmentId: 'a1', takenAt: '2026-02-01T10:00:00.000Z', appointment: { procedure: { name: 'Peeling' }, startAt: '2026-02-01T10:00:00.000Z' } },
  { id: 'a1p', phase: 'AFTER', url: 'https://img/a1.jpg', appointmentId: 'a1', takenAt: '2026-02-01T10:00:00.000Z', appointment: { procedure: { name: 'Peeling' }, startAt: '2026-02-01T10:00:00.000Z' } },
  { id: 'x', phase: 'BEFORE', url: null, label: 'Avulsa', takenAt: '2026-03-05T10:00:00.000Z' },
];

function setup(props: Partial<React.ComponentProps<typeof PatientPhotosGallery>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PatientPhotosGallery patientId="p1" canEdit {...props} />
    </QueryClientProvider>,
  );
}

describe('PatientPhotosGallery', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    toast.error.mockReset();
    toast.success.mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
  });

  it('estado vazio', async () => {
    api.listPhotos.mockResolvedValue([]);
    setup();
    expect(await screen.findByText('Nenhuma foto registrada ainda.')).toBeInTheDocument();
    expect(screen.getByText('Fotos · antes e depois')).toBeInTheDocument();
  });

  it('agrupa fotos por atendimento, mais recente primeiro', async () => {
    api.listPhotos.mockResolvedValue(photos);
    setup({ showTitle: false });
    expect(await screen.findByText('Peeling')).toBeInTheDocument();
    expect(screen.queryByText('Fotos · antes e depois')).not.toBeInTheDocument();
    const headings = screen.getAllByText(/^(Peeling|Avulsa)$/).map((e) => e.textContent);
    expect(headings).toEqual(['Avulsa', 'Peeling']);
    expect(screen.getByText('01/02/2026')).toBeInTheDocument();
    expect(screen.getByText('05/03/2026')).toBeInTheDocument();
  });

  it('exclui foto individual quando pode editar', async () => {
    api.listPhotos.mockResolvedValue(photos);
    api.removePhoto2.mockResolvedValue(undefined);
    setup();
    await screen.findByText('Peeling');
    const del = screen.getAllByRole('button', { name: 'Excluir foto DEPOIS' });
    await userEvent.click(del[0]);
    await waitFor(() => expect(api.removePhoto2).toHaveBeenCalledWith('p1', 'a1p'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Foto removida.'));
  });

  it('mostra erro ao falhar a exclusão', async () => {
    api.listPhotos.mockResolvedValue(photos);
    api.removePhoto2.mockRejectedValue({ response: { data: { message: 'Negado' } } });
    setup();
    await screen.findByText('Peeling');
    await userEvent.click(screen.getAllByRole('button', { name: 'Excluir foto ANTES' })[0]);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Negado'));
  });

  it('somente leitura esconde exclusão e usa onAddClick', async () => {
    api.listPhotos.mockResolvedValue(photos);
    const onAddClick = vi.fn();
    setup({ readOnly: true, onAddClick });
    await screen.findByText('Peeling');
    expect(screen.queryByRole('button', { name: /Excluir foto/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(onAddClick).toHaveBeenCalled();
    expect(screen.queryByText('Adicionar fotos')).not.toBeInTheDocument();
  });

  it('sem permissão não mostra o botão Adicionar', async () => {
    api.listPhotos.mockResolvedValue([]);
    setup({ canEdit: false });
    await screen.findByText('Nenhuma foto registrada ainda.');
    expect(screen.queryByRole('button', { name: 'Adicionar' })).not.toBeInTheDocument();
  });

  it('envia pares antes/depois vinculados ao atendimento escolhido', async () => {
    api.listPhotos.mockResolvedValue([]);
    api.findOne.mockResolvedValue({
      id: 'p1',
      appointments: [{ id: 'ap9', startAt: '2026-04-10T13:00:00.000Z', procedure: { name: 'Laser' } }],
    });
    api.addPhoto.mockResolvedValue({});
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar' }));
    const dlg = await screen.findByRole('dialog');
    const save = within(dlg).getByRole('button', { name: 'Salvar fotos' });
    expect(save).toBeDisabled();

    await userEvent.click(within(dlg).getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: /Laser/ }));

    const before = new File(['b'], 'antes.png', { type: 'image/png' });
    const after = new File(['a'], 'depois.png', { type: 'image/png' });
    const inputs = () => dlg.querySelectorAll<HTMLInputElement>('input[type="file"]');
    await userEvent.upload(inputs()[0], before);
    expect(within(dlg).getByRole('button', { name: 'Remover foto ANTES' })).toBeInTheDocument();

    await userEvent.click(within(dlg).getByRole('button', { name: 'Adicionar par de fotos' }));
    expect(within(dlg).getByText('Par 2')).toBeInTheDocument();
    await userEvent.upload(inputs()[3], after);
    // remove o par 1 (somente o rótulo "Remover" do par)
    await userEvent.click(within(dlg).getAllByRole('button', { name: 'Remover' })[0]);
    expect(within(dlg).queryByText('Par 2')).not.toBeInTheDocument();

    await userEvent.click(within(dlg).getByRole('button', { name: 'Remover foto DEPOIS' }));
    await userEvent.upload(inputs()[0], before);
    await userEvent.upload(inputs()[1], after);

    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    await waitFor(() => expect(api.addPhoto).toHaveBeenCalledTimes(2));
    expect(api.addPhoto.mock.calls[0]).toEqual(['p1', before, expect.objectContaining({ phase: 'BEFORE', appointmentId: 'ap9' })]);
    expect(api.addPhoto.mock.calls[1]).toEqual(['p1', after, expect.objectContaining({ phase: 'AFTER', appointmentId: 'ap9' })]);
    expect(api.addPhoto.mock.calls[0][2].pairId).toBe(api.addPhoto.mock.calls[1][2].pairId);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Fotos adicionadas.'));
  });

  it('indica quando não há atendimentos para vincular', async () => {
    api.listPhotos.mockResolvedValue([]);
    api.findOne.mockResolvedValue({ id: 'p1', appointments: [] });
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('combobox'));
    expect(await screen.findByText('Nenhum atendimento registrado')).toBeInTheDocument();
  });
});
