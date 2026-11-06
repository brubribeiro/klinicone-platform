import { Prisma } from '@prisma/client';

import { PrismaExceptionFilter } from './prisma-exception.filter';

function run(code: string) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) };
  const error = new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' });
  new PrismaExceptionFilter().catch(error, host as never);
  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

describe('PrismaExceptionFilter', () => {
  it.each([
    ['P2002', 409, 'Registro duplicado.'],
    ['P2003', 400, 'Referência inválida: um dos registros relacionados não existe.'],
    ['P2025', 404, 'Registro não encontrado.'],
    ['P2028', 503, 'Banco de dados indisponível no momento. Tente novamente em alguns segundos.'],
    ['P2034', 409, 'Conflito ao salvar. Tente novamente.'],
  ])('traduz %s para HTTP %i', (code, status, message) => {
    expect(run(code)).toEqual({ status, body: { statusCode: status, message } });
  });

  describe('código desconhecido', () => {
    const original = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = original;
    });

    it('detalha o erro fora de produção', () => {
      process.env.NODE_ENV = 'development';
      const { status, body } = run('P9999');
      expect(status).toBe(500);
      expect(body.message).toContain('P9999');
    });

    it('esconde detalhes em produção', () => {
      process.env.NODE_ENV = 'production';
      expect(run('P9999').body.message).toBe('Erro interno do servidor');
    });
  });
});
