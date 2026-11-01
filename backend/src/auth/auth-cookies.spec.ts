import { jwtExpiresToMs, extractAccessToken } from './auth-cookies';

describe('auth-cookies', () => {
  describe('jwtExpiresToMs', () => {
    it('parseia horas, minutos e dias', () => {
      expect(jwtExpiresToMs('4h')).toBe(4 * 60 * 60 * 1000);
      expect(jwtExpiresToMs('30m')).toBe(30 * 60 * 1000);
      expect(jwtExpiresToMs('2d')).toBe(2 * 86_400_000);
      expect(jwtExpiresToMs('90')).toBe(90_000);
    });

    it('usa 4h como fallback inválido', () => {
      expect(jwtExpiresToMs('abc')).toBe(4 * 60 * 60 * 1000);
    });
  });

  describe('extractAccessToken', () => {
    it('prefere cookie HttpOnly ao Bearer', () => {
      const req = {
        cookies: { access_token: 'from-cookie' },
        headers: { authorization: 'Bearer from-header' },
      } as any;
      expect(extractAccessToken(req)).toBe('from-cookie');
    });

    it('aceita Bearer quando não há cookie', () => {
      const req = { cookies: {}, headers: { authorization: 'Bearer only-header' } } as any;
      expect(extractAccessToken(req)).toBe('only-header');
    });
  });
});
