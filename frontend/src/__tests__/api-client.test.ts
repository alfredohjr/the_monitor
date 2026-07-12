import { apiFetch, getActiveOrg, setActiveOrg, clearActiveOrg } from '@/lib/api';

describe('apiFetch', () => {
  afterEach(() => {
    localStorage.clear();
    delete (global as { fetch?: unknown }).fetch;
  });

  function mockFetch() {
    const fn = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    (global as { fetch: unknown }).fetch = fn;
    return fn;
  }

  it('injeta Authorization e X-Org-Id a partir do localStorage', async () => {
    localStorage.setItem('access_token', 'tok');
    setActiveOrg(7);
    const fn = mockFetch();
    await apiFetch('/api/v1/metrics/');
    const [url, opts] = fn.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/v1/metrics/');
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect((opts.headers as Record<string, string>)['X-Org-Id']).toBe('7');
  });

  it('não manda X-Org-Id quando não há org ativa', async () => {
    localStorage.setItem('access_token', 'tok');
    const fn = mockFetch();
    await apiFetch('/api/v1/metrics/');
    const opts = fn.mock.calls[0][1];
    expect((opts.headers as Record<string, string>)['X-Org-Id']).toBeUndefined();
  });

  it('preserva headers passados (ex.: Content-Type) e a URL absoluta', async () => {
    setActiveOrg(3);
    const fn = mockFetch();
    await apiFetch('http://localhost:8000/api/v1/logs/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const [url, opts] = fn.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/v1/logs/');
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect((opts.headers as Record<string, string>)['X-Org-Id']).toBe('3');
  });

  it('getActiveOrg/clearActiveOrg funcionam', () => {
    expect(getActiveOrg()).toBeNull();
    setActiveOrg(42);
    expect(getActiveOrg()).toBe(42);
    clearActiveOrg();
    expect(getActiveOrg()).toBeNull();
  });
});
