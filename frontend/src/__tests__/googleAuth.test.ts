import { exchangeGoogleCredential, googleButtonOptions } from '@/lib/googleAuth';

describe('googleButtonOptions (#220 — cara do site)', () => {
  it('usa tema escuro e formato arredondado (pill) combinando com o site', () => {
    expect(googleButtonOptions.theme).toBe('filled_black');
    expect(googleButtonOptions.shape).toBe('pill');
    expect(googleButtonOptions.size).toBe('large');
  });
});

describe('exchangeGoogleCredential (issue #16)', () => {
  afterEach(() => {
    delete (global as { fetch?: unknown }).fetch;
  });

  it('envia o credential para o endpoint do backend e retorna os tokens', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ access: 'a', refresh: 'r' }) } as Response);
    (global as { fetch: unknown }).fetch = fetchMock;

    const tokens = await exchangeGoogleCredential('google-id-token', 'http://api');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api/api/v1/auth/google/',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.credential).toBe('google-id-token');
    expect(tokens).toEqual({ access: 'a', refresh: 'r' });
  });

  it('lanca erro quando a resposta nao e ok', async () => {
    (global as { fetch: unknown }).fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, json: async () => ({}) } as Response);

    await expect(exchangeGoogleCredential('x', 'http://api')).rejects.toThrow();
  });
});
