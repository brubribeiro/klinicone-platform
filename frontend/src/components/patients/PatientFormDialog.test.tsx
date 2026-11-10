import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PatientFormDialog } from './PatientFormDialog';
import type { Patient } from '../../types';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  uploadPhoto: vi.fn(),
  removePhoto: vi.fn(),
}));
vi.mock('../../api/patients', () => ({ patientsApi: api }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
const viaCep = vi.hoisted(() => ({ fetchViaCepDigits: vi.fn() }));
vi.mock('../../utils/viaCep', () => viaCep);

function setup(patient?: Patient | null) {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const utils = render(
    <QueryClientProvider client={client}>
      <PatientFormDialog open onClose={onClose} patient={patient} />
    </QueryClientProvider>,
  );
  return { onClose, invalidate, ...utils };
}

const nameInput = () => screen.getByPlaceholderText('Ex.: Marina Costa');
const save = () => userEvent.click(screen.getByRole('button', { name: 'Salvar paciente' }));

describe('PatientFormDialog', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    toast.error.mockReset();
    toast.success.mockReset();
    viaCep.fetchViaCepDigits.mockReset();
  });

  it('exige o nome e não chama a API', async () => {
    setup();
    expect(screen.getByText('Novo paciente')).toBeInTheDocument();
    await save();
    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('valida CPF, telefone e e-mail', async () => {
    setup();
    await userEvent.type(nameInput(), 'Ana');
    await userEvent.type(screen.getByPlaceholderText('000.000.000-00'), '11111111111');
    await userEvent.type(screen.getByPlaceholderText('(11) 90000-0000'), '1199');
    await userEvent.type(screen.getByPlaceholderText('email@exemplo.com'), 'ruim');
    await save();
    expect(await screen.findByText('CPF inválido')).toBeInTheDocument();
    expect(screen.getByText('Telefone incompleto: informe DDD + número')).toBeInTheDocument();
    expect(screen.getByText('E-mail inválido')).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('cria paciente enviando apenas campos preenchidos', async () => {
    api.create.mockResolvedValue({ id: 'new1' });
    const { onClose, invalidate } = setup();
    await userEvent.type(nameInput(), '  Ana Souza');
    await userEvent.type(screen.getByPlaceholderText('000.000.000-00'), '52998224725');
    await userEvent.type(screen.getByPlaceholderText('(11) 90000-0000'), '11999998888');
    await userEvent.type(screen.getByPlaceholderText('email@exemplo.com'), 'ana@x.com');
    await save();
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0]).toEqual({
      name: '  Ana Souza',
      email: 'ana@x.com',
      phone: '11999998888',
      document: '52998224725',
    });
    expect(api.uploadPhoto).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Paciente criado.'));
    expect(onClose).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['patients'] });
  });

  it('mostra erro da API e mantém o diálogo aberto', async () => {
    api.create.mockRejectedValue({ response: { data: { message: 'E-mail já cadastrado' } } });
    const { onClose } = setup();
    await userEvent.type(nameInput(), 'Ana');
    await save();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('E-mail já cadastrado'));
    expect(screen.getByText('E-mail já cadastrado')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('preenche endereço pelo CEP', async () => {
    viaCep.fetchViaCepDigits.mockResolvedValue({
      logradouro: 'Rua A', bairro: 'Centro', localidade: 'Sorocaba', uf: 'SP',
    });
    setup();
    await userEvent.type(screen.getByPlaceholderText('CEP'), '18010000');
    expect(await screen.findByText(/Endereço preenchido pelo CEP/, undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(viaCep.fetchViaCepDigits).toHaveBeenCalledWith('18010000', expect.anything());
    expect(screen.getByPlaceholderText('Logradouro (preenchido pelo CEP)')).toHaveValue('Rua A');
    expect(screen.getByPlaceholderText('Cidade')).toHaveValue('Sorocaba');
  });

  it('informa CEP não encontrado', async () => {
    viaCep.fetchViaCepDigits.mockResolvedValue(null);
    setup();
    await userEvent.type(screen.getByPlaceholderText('CEP'), '99999999');
    expect(await screen.findByText('CEP não encontrado.', undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it('informa falha na consulta do CEP', async () => {
    viaCep.fetchViaCepDigits.mockRejectedValue(new Error('net'));
    setup();
    await userEvent.type(screen.getByPlaceholderText('CEP'), '18010000');
    expect(await screen.findByText('Não foi possível consultar o CEP.', undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it('edita paciente existente, enviando campos limpos e removendo a foto', async () => {
    api.update.mockResolvedValue({ id: 'p1' });
    api.removePhoto.mockResolvedValue(undefined);
    const patient = {
      id: 'p1', name: 'Maria', email: 'm@x.com', phone: '11988887777', notes: 'Alergia',
      photoUrl: 'https://img/x.jpg', cep: '18010000', addressStreet: 'Rua A', addressCity: 'Sorocaba',
    } as Patient;
    const { onClose } = setup(patient);
    expect(screen.getByText('Editar paciente')).toBeInTheDocument();
    expect(nameInput()).toHaveValue('Maria');
    expect(screen.getByPlaceholderText('(11) 90000-0000')).toHaveValue('(11) 98888-7777');
    expect(viaCep.fetchViaCepDigits).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /remover/i }));
    await userEvent.clear(screen.getByPlaceholderText('email@exemplo.com'));
    await save();
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    const [id, payload] = api.update.mock.calls[0];
    expect(id).toBe('p1');
    expect(payload).toMatchObject({
      name: 'Maria', phone: '11988887777', cep: '18010000', addressStreet: 'Rua A',
      addressCity: 'Sorocaba', addressNeighborhood: '', notes: 'Alergia', sex: null, referralSource: null,
    });
    expect(payload).not.toHaveProperty('email');
    await waitFor(() => expect(api.removePhoto).toHaveBeenCalledWith('p1'));
    expect(toast.success).toHaveBeenCalledWith('Paciente atualizado.');
    expect(onClose).toHaveBeenCalled();
  });

  it('envia a foto escolhida após salvar e rejeita arquivo inválido', async () => {
    api.create.mockResolvedValue({ id: 'new2' });
    api.uploadPhoto.mockResolvedValue(undefined);
    const { container } = setup();
    const input = container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['x'], 'doc.pdf', { type: 'application/pdf' }), { applyAccept: false });
    expect(await screen.findByText(/JPG|PNG|WebP|formato|imagem/i)).toBeInTheDocument();

    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    await userEvent.upload(input, file);
    await userEvent.type(nameInput(), 'Bia');
    await save();
    await waitFor(() => expect(api.uploadPhoto).toHaveBeenCalledWith('new2', file));
  });

  it('aba Observações salva as notas', async () => {
    api.create.mockResolvedValue({ id: 'n3' });
    setup();
    await userEvent.type(nameInput(), 'Bia');
    await userEvent.click(screen.getByRole('tab', { name: /Observações/ }));
    await userEvent.type(screen.getByPlaceholderText(/Histórico, alergias/), '  Gosta de chá ');
    await userEvent.click(screen.getByRole('tab', { name: /Informações básicas/ }));
    await save();
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0]).toEqual({ name: 'Bia', notes: 'Gosta de chá' });
  });
});
