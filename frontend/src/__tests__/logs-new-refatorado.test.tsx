import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LogForm from '@/components/logs/LogForm';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

beforeEach(() => {
  localStorage.setItem('access_token', 'fake-token');
  mockPush.mockClear();
});

afterEach(() => {
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

const HOJE = new Date().toISOString().split('T')[0];

// Duas métricas, cada uma com metas de períodos diferentes
function mockDados(post?: jest.Mock) {
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url.includes('/goals/')) return Promise.resolve({ ok: true, status: 200, json: async () => [
      { id: 10, metric: 20, alvo: '100', periodo_referencia: '2026-05' },
      { id: 11, metric: 20, alvo: '100', periodo_referencia: '2026-07' },
      { id: 12, metric: 20, alvo: '100', periodo_referencia: '2026-06' },
      { id: 13, metric: 21, alvo: '9', periodo_referencia: '2026-07' },
    ]});
    if (url.includes('/metrics/')) return Promise.resolve({ ok: true, status: 200, json: async () => [
      { id: 20, codigo: 'VND', nome: 'Vendas', tipo: 'currency' },
      { id: 21, codigo: 'RUN', nome: 'Corridas', tipo: 'number' },
    ]});
    if (url.includes('/logs/') && opts?.method === 'POST') return (post ?? jest.fn())(url, opts);
    return Promise.resolve({ ok: true, status: 200, json: async () => [] });
  });
}

describe('LogForm — refatoração /logs/new', () => {
  it('não renderiza o campo "Quando?"', async () => {
    mockDados();
    render(<LogForm />);
    await screen.findByRole('option', { name: /Vendas/ });
    expect(screen.queryByText(/Quando/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[name="data"]')).toBeNull();
  });

  it('mostra um select de Métrica com as métricas que têm meta', async () => {
    mockDados();
    render(<LogForm />);
    expect(await screen.findByRole('option', { name: /Vendas/ })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /Corridas/ })).toBeInTheDocument();
  });

  it('ao selecionar a métrica, o select de meta mostra só as metas dela ordenadas por período (desc)', async () => {
    mockDados();
    render(<LogForm />);
    await screen.findByRole('option', { name: /Vendas/ });
    const metricSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(metricSelect, { target: { value: '20' } });

    await waitFor(() => expect(screen.getByRole('option', { name: '2026-07' })).toBeInTheDocument());
    const goalSelect = screen.getAllByRole('combobox')[1];
    const periodos = Array.from(goalSelect.querySelectorAll('option'))
      .map(o => o.textContent)
      .filter(t => t && /2026/.test(t));
    expect(periodos).toEqual(['2026-07', '2026-06', '2026-05']);
    // meta da outra métrica não aparece
    expect(screen.queryByRole('option', { name: '9' })).not.toBeInTheDocument();
  });

  it('envia data = hoje ao fazer o check-in', async () => {
    const post = jest.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 1 }) });
    mockDados(post);
    render(<LogForm />);
    await screen.findByRole('option', { name: /Vendas/ });

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '20' } });
    await waitFor(() => expect(screen.getByRole('option', { name: '2026-07' })).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '11' } });
    fireEvent.change(screen.getByPlaceholderText(/ex:|R\$/i), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: /check-in|carimbar/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const body = JSON.parse((post.mock.calls[0][1] as RequestInit).body as string);
    expect(body.data).toBe(HOJE);
    expect(body.goal).toBe('11');
    expect(body.valor_logado).toBe('500');
  });
});
