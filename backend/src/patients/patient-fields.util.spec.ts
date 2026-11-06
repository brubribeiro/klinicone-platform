import { composePatientAddress } from './patient-address.util';
import { normalizePatientWritableFields } from './patient-fields.util';

describe('composePatientAddress', () => {
  it('monta rua, número, complemento, bairro e cidade/UF', () => {
    expect(
      composePatientAddress({
        addressStreet: ' Rua A ',
        addressNumber: '10',
        addressComplement: 'ap 2',
        addressNeighborhood: 'Centro',
        addressCity: 'Sorocaba',
        addressState: 'SP',
      }),
    ).toBe('Rua A, 10 — ap 2 · Centro, Sorocaba/SP');
  });

  it('aceita partes soltas e cai no endereço legado', () => {
    expect(composePatientAddress({ addressNumber: '5', addressComplement: 'fundos' })).toBe('5 — fundos');
    expect(composePatientAddress({ addressCity: 'Itu' })).toBe('Itu');
    expect(composePatientAddress({ addressState: 'SP' })).toBe('SP');
    expect(composePatientAddress({ addressStreet: 'Rua B' })).toBe('Rua B');
    expect(composePatientAddress({ address: ' Rua antiga, 1 ' })).toBe('Rua antiga, 1');
    expect(composePatientAddress({ address: '  ' })).toBeUndefined();
    expect(composePatientAddress({})).toBeUndefined();
  });
});

describe('normalizePatientWritableFields', () => {
  it('normaliza CEP, data de nascimento e sexo', () => {
    const out = normalizePatientWritableFields({ name: 'A', cep: '18.000-000', birthDate: '1990-05-17', sex: 'F' } as never);
    expect(out).toMatchObject({ cep: '18000000', sex: 'F' });
    expect((out.birthDate as Date).toISOString()).toBe('1990-05-17T12:00:00.000Z');

    expect(normalizePatientWritableFields({ cep: '123' } as never).cep).toBeNull();
    expect(normalizePatientWritableFields({ cep: '', birthDate: null, sex: undefined } as never)).toMatchObject({ cep: null, birthDate: null });
    expect(normalizePatientWritableFields({ birthDate: '1990-05-17T03:00:00.000Z' } as never).birthDate).toEqual(new Date('1990-05-17T12:00:00.000Z'));
    expect(normalizePatientWritableFields({ birthDate: 'lixo' } as never).birthDate).toBeNull();
    const date = new Date('2000-01-01T00:00:00Z');
    expect(normalizePatientWritableFields({ birthDate: date } as never).birthDate).toBe(date);
    expect(normalizePatientWritableFields({ birthDate: 'Jan 5 2000 12:00 UTC' } as never).birthDate).toBeInstanceOf(Date);
  });

  it('limpa o texto livre da origem quando não é "Outro"', () => {
    expect(normalizePatientWritableFields({ referralSource: 'INSTAGRAM', referralSourceOther: ' x ' } as never)).toMatchObject({
      referralSource: 'INSTAGRAM',
      referralSourceOther: null,
    });
    expect(normalizePatientWritableFields({ referralSource: 'OTHER', referralSourceOther: ' indicação ' } as never).referralSourceOther).toBe('indicação');
    expect(normalizePatientWritableFields({ referralSource: null } as never)).toMatchObject({ referralSource: null, referralSourceOther: null });
  });

  it('recompõe o endereço quando algum campo muda e ignora quando não', () => {
    const out = normalizePatientWritableFields({ addressStreet: ' Rua C ', addressNumber: '', addressCity: 'Itu', addressState: 'SP' } as never);
    expect(out).toMatchObject({ addressStreet: 'Rua C', addressNumber: null, address: 'Rua C · Itu/SP' });
    expect(normalizePatientWritableFields({ address: 'Legado' } as never).address).toBe('Legado');
    expect(normalizePatientWritableFields({ address: '' } as never).address).toBeNull();
    expect(normalizePatientWritableFields({ name: 'só nome' } as never)).not.toHaveProperty('address');
  });
});
