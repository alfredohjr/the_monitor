import { render, screen, waitFor } from '@testing-library/react';
import SimulationDashboard from '@/components/simulation/SimulationDashboard';

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

function mockFetch(metrics: object[], subscriptions: object[] = []) {
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/subscriptions/')) return Promise.resolve({ ok: true, status: 200, json: async () => subscriptions });
    if (url.includes('/metrics/'))       return Promise.resolve({ ok: true, status: 200, json: async () => metrics });
    return Promise.resolve({ ok: true, status: 200, json: async () => [] });
  });
}

beforeEach(() => {
  localStorage.setItem('access_token', 'fake-token');
  mockPush.mockClear();
});

afterEach(() => {
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

describe('Simulação — auto-seleção de métrica', () => {
  it('select permanece vazio quando não há métricas', async () => {
    mockFetch([]);
    render(<SimulationDashboard />);
    await waitFor(() => expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument());
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('');
  });

  it('pré-seleciona automaticamente quando há apenas 1 métrica própria', async () => {
    mockFetch([{ id: 7, codigo: 'VENDAS', nome: 'Vendas', tipo: 'number', periodo: 'daily', is_default: false }]);
    render(<SimulationDashboard />);
    await waitFor(() => expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('7'));
  });

  it('mantém vazio quando há mais de 1 métrica', async () => {
    mockFetch([
      { id: 1, codigo: 'A', nome: 'Alpha', tipo: 'number', periodo: 'daily' },
      { id: 2, codigo: 'B', nome: 'Beta', tipo: 'number', periodo: 'daily' },
    ]);
    render(<SimulationDashboard />);
    await waitFor(() => expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument());
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('');
  });
});
