import { describe, it, expect } from 'vitest';

import { api } from './client';

describe('API client', () => {
  it('envia cookies de sessão (withCredentials) em vez de Bearer no localStorage', () => {
    expect(api.defaults.withCredentials).toBe(true);
  });
});
