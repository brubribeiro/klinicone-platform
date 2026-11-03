import { assertLocalEnvironment } from '../../prisma/seed-demo-guard';

describe('assertLocalEnvironment (seed demo)', () => {
  const localDb = {
    DATABASE_URL: 'postgresql://klinicone:klinicone@localhost:5432/klinicone_platform',
    DIRECT_URL: 'postgresql://klinicone:klinicone@localhost:5432/klinicone_platform',
  };

  it('recusa produção via NODE_ENV', () => {
    expect(() =>
      assertLocalEnvironment({ ...localDb, NODE_ENV: 'production' }),
    ).toThrow(/produção/i);
  });

  it('recusa produção via APP_ENV mesmo com NODE_ENV development', () => {
    expect(() =>
      assertLocalEnvironment({ ...localDb, NODE_ENV: 'development', APP_ENV: 'production' }),
    ).toThrow(/produção/i);
  });

  it('aceita localhost com NODE_ENV development', () => {
    expect(() =>
      assertLocalEnvironment({ ...localDb, NODE_ENV: 'development' }),
    ).not.toThrow();
  });

  it('recusa host remoto sem APP_ENV explícito', () => {
    expect(() =>
      assertLocalEnvironment({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://u:p@db.example.com:5432/x',
      }),
    ).toThrow(/localhost/i);
  });

  it('aceita host remoto com APP_ENV=development (staging)', () => {
    expect(() =>
      assertLocalEnvironment({
        NODE_ENV: 'production',
        APP_ENV: 'development',
        DATABASE_URL: 'postgresql://u:p@db.example.com:5432/x',
      }),
    ).not.toThrow();
  });
});
