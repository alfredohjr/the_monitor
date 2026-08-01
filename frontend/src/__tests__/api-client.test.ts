import { apiFetch, clearApiCache, getActiveOrg, setActiveOrg, clearActiveOrg } from '@/lib/api';

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

describe('apiFetch — Accept-Language (#303)', () => {
  afterEach(() => {
    localStorage.clear();
    delete (global as { fetch?: unknown }).fetch;
  });

  function mockFetch() {
    const fn = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    (global as { fetch: unknown }).fetch = fn;
    return fn;
  }

  it('manda en por padrão', async () => {
    const fn = mockFetch();
    await apiFetch('/api/v1/metrics/');
    expect((fn.mock.calls[0][1].headers as Record<string, string>)['Accept-Language']).toBe('en');
  });

  it('manda pt-BR quando o locale está salvo', async () => {
    localStorage.setItem('locale', 'pt-BR');
    const fn = mockFetch();
    await apiFetch('/api/v1/metrics/');
    expect((fn.mock.calls[0][1].headers as Record<string, string>)['Accept-Language']).toBe('pt-BR');
  });

  it('acompanha a troca de idioma sem recarregar o módulo', async () => {
    const fn = mockFetch();
    await apiFetch('/api/v1/metrics/');
    localStorage.setItem('locale', 'pt-BR');
    await apiFetch('/api/v1/metrics/');
    const cabecalhos = fn.mock.calls.map((c) => (c[1].headers as Record<string, string>)['Accept-Language']);
    expect(cabecalhos).toEqual(['en', 'pt-BR']);
  });

  it('não sobrescreve um Accept-Language explícito do chamador', async () => {
    const fn = mockFetch();
    await apiFetch('/api/v1/metrics/', { headers: { 'Accept-Language': 'de-DE' } });
    expect((fn.mock.calls[0][1].headers as Record<string, string>)['Accept-Language']).toBe('de-DE');
  });
});

// ---------------------------------------------------------------------------
// Limpeza do cache da API (#325)
// ---------------------------------------------------------------------------

describe('clearApiCache', () => {
  let apagados: string[];

  beforeEach(() => {
    apagados = [];
    (global as { caches?: unknown }).caches = {
      keys: async () => ['themonitor-api', 'themonitor-shell-1.0.0', 'outro-app'],
      delete: async (nome: string) => {
        apagados.push(nome);
        return true;
      },
    };
  });

  afterEach(() => {
    localStorage.clear();
    delete (global as { caches?: unknown }).caches;
  });

  it('apaga só o cache da API, não o do shell', async () => {
    // Apagar o shell aqui tiraria a capacidade de abrir offline por causa de
    // uma troca de organização — dois assuntos sem relação.
    await clearApiCache();
    expect(apagados).toEqual(['themonitor-api']);
  });

  it('não quebra onde a Cache API não existe', async () => {
    // Navegador antigo, ou o próprio jsdom: `caches` é indefinido e chamar
    // `.keys()` nele derrubaria o logout.
    delete (global as { caches?: unknown }).caches;
    await expect(clearApiCache()).resolves.toBeUndefined();
  });

  it('trocar de organização limpa o cache', async () => {
    // Rede de segurança: a chave já separa por org, mas dado de outra
    // organização não pode sobreviver à troca nem por engano.
    // Aguardado: sem isto a limpeza deste preparo resolve depois do reset e
    // conta como se fosse a da ação sob teste.
    await setActiveOrg(1);
    apagados = [];

    await setActiveOrg(2);

    expect(apagados).toEqual(['themonitor-api']);
  });

  it('reafirmar a MESMA organização não limpa nada', async () => {
    // O Navbar chama setActiveOrg ao montar. Se isso limpasse o cache, ele
    // seria apagado em toda navegação e a feature inteira não existiria.
    // Aguardado: sem isto a limpeza deste preparo resolve depois do reset e
    // conta como se fosse a da ação sob teste.
    await setActiveOrg(1);
    apagados = [];

    await setActiveOrg(1);

    expect(apagados).toEqual([]);
  });

  it('logout limpa o cache', async () => {
    // Aguardado: sem isto a limpeza deste preparo resolve depois do reset e
    // conta como se fosse a da ação sob teste.
    await setActiveOrg(1);
    apagados = [];

    await clearActiveOrg();

    expect(apagados).toEqual(['themonitor-api']);
  });
});
