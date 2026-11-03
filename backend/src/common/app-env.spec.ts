import { getAppEnv, isProductionEnv } from './app-env';

describe('getAppEnv', () => {
  it('maps APP_ENV production/prod to prod', () => {
    expect(getAppEnv({ APP_ENV: 'production' })).toBe('prod');
    expect(getAppEnv({ APP_ENV: 'prod' })).toBe('prod');
  });

  it('maps APP_ENV development/dev/staging to dev', () => {
    expect(getAppEnv({ APP_ENV: 'development' })).toBe('dev');
    expect(getAppEnv({ APP_ENV: 'dev' })).toBe('dev');
    expect(getAppEnv({ APP_ENV: 'staging' })).toBe('dev');
  });

  it('prefers APP_ENV over NODE_ENV (staging on Render)', () => {
    expect(getAppEnv({ APP_ENV: 'development', NODE_ENV: 'production' })).toBe('dev');
  });

  it('falls back to NODE_ENV when APP_ENV is unset', () => {
    expect(getAppEnv({ NODE_ENV: 'production' })).toBe('prod');
    expect(getAppEnv({ NODE_ENV: 'development' })).toBe('dev');
    expect(getAppEnv({})).toBe('dev');
  });
});

describe('isProductionEnv', () => {
  it('is true only for prod', () => {
    expect(isProductionEnv({ APP_ENV: 'production' })).toBe(true);
    expect(isProductionEnv({ APP_ENV: 'development', NODE_ENV: 'production' })).toBe(false);
  });
});
