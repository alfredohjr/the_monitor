/**
 * A base da API deve ser configurável no build (#174): NEXT_PUBLIC_API_BASE=""
 * em produção → chamadas same-origin (/api/v1/...); sem env (dev/testes) →
 * http://localhost:8000.
 */
describe('API_BASE', () => {
  const orig = process.env.NEXT_PUBLIC_API_BASE;
  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = orig;
    jest.resetModules();
  });

  it('same-origin quando NEXT_PUBLIC_API_BASE=""', () => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_API_BASE = '';
    const { API_BASE } = require('@/lib/api');
    expect(API_BASE).toBe('');
  });

  it('usa o valor do env quando definido', () => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_API_BASE = 'https://api.exemplo.com';
    const { API_BASE } = require('@/lib/api');
    expect(API_BASE).toBe('https://api.exemplo.com');
  });

  it('cai em localhost:8000 quando ausente (dev)', () => {
    jest.resetModules();
    delete process.env.NEXT_PUBLIC_API_BASE;
    const { API_BASE } = require('@/lib/api');
    expect(API_BASE).toBe('http://localhost:8000');
  });
});
