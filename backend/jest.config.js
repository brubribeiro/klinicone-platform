/**
 * `npm test` roda os dois projetos com cobertura:
 * - unit: src/**\/*.spec.ts (mocks, sem banco)
 * - integration: test/**\/*.int-spec.ts (Nest + Postgres reais; exige DATABASE_URL com migrations)
 * Só unitários: `npm run test:unit`. Só integração: `npm run test:integration`.
 */
const shared = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { diagnostics: false }],
  },
  testEnvironment: 'node',
};

module.exports = {
  projects: [
    { ...shared, displayName: 'unit', rootDir: '.', roots: ['<rootDir>/src'], testRegex: 'src/.*\\.spec\\.ts$' },
    {
      ...shared,
      displayName: 'integration',
      rootDir: '.',
      roots: ['<rootDir>/test'],
      testRegex: 'test/.*\\.int-spec\\.ts$',
      setupFiles: ['<rootDir>/test/load-env.ts'],
    },
  ],
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.spec.ts',
    '!<rootDir>/src/**/*.module.ts',
    '!<rootDir>/src/**/dto/**',
    '!<rootDir>/src/main.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text-summary', 'json-summary', 'lcov'],
  // Piso = cobertura medida neste PR, arredondada para baixo. Subir junto quando a cobertura subir.
  coverageThreshold: {
    global: { statements: 87, branches: 74, functions: 81, lines: 89 },
  },
};
