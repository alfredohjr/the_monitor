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

function mockFetch(metrics: object[], goals: object[] = [], logs: object[] = [], subscriptions: object[] = []) {
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/subscriptions/')) return Promise.resolve({ ok: true, status: 200, json: async () => subscriptions });
    if (url.includes('/metrics/'))       return Promise.resolve({ ok: true, status: 200, json: async () => metrics });
    if (url.includes('/goals/'))         return Promise.resolve({ ok: true, status: 200, json: async () => goals });
    if (url.includes('/logs/'))          return Promise.resolve({ ok: true, status: 200, json: async () => logs });
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

describe('Simulação — datas padrão (mês atual)', () => {
  it('sugere início no dia 1 e fim no último dia do mês corrente', async () => {
    mockFetch([]);
    const { container } = render(<SimulationDashboard />);
    await waitFor(() => expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument());

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    const esperadoInicio = `${y}-${m}-01`;
    const esperadoFim = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs).toHaveLength(2);
    expect((dateInputs[0] as HTMLInputElement).value).toBe(esperadoInicio);
    expect((dateInputs[1] as HTMLInputElement).value).toBe(esperadoFim);
  });
});

describe('Simulação — botão "Replicar último valor" perto do gráfico', () => {
  it('não aparece enquanto não há gráfico (nenhuma métrica selecionada)', async () => {
    mockFetch([
      { id: 1, codigo: 'A', nome: 'Alpha', tipo: 'number', periodo: 'daily' },
      { id: 2, codigo: 'B', nome: 'Beta', tipo: 'number', periodo: 'daily' },
    ]);
    render(<SimulationDashboard />);
    await waitFor(() => expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /replicar último valor/i })).not.toBeInTheDocument();
  });

  it('aparece quando o gráfico está visível (métrica selecionada)', async () => {
    mockFetch([{ id: 7, codigo: 'VENDAS', nome: 'Vendas', tipo: 'number', periodo: 'daily', is_default: false }]);
    render(<SimulationDashboard />);
    await waitFor(() => expect(screen.getByRole('button', { name: /replicar último valor/i })).toBeInTheDocument());
  });
});
