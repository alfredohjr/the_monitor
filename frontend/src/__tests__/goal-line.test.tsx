import { render, screen, waitFor } from '@testing-library/react';
import DashboardGrid from '@/components/dashboard/DashboardGrid';

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

jest.mock('recharts', () => ({
  LineChart: ({ children, data }: { children: React.ReactNode; data: object[] }) => (
    <div data-testid="line-chart" data-chart={JSON.stringify(data)}>{children}</div>
  ),
  Line: ({ dataKey }: { dataKey: string }) => <div data-testid={`line-${dataKey}`} />,
  Legend: () => <div data-testid="legend" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

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

const metricaNumerica = { id: 42, codigo: 'VENDAS', nome: 'Vendas', tipo: 'number', periodo: 'daily', is_default: false };

describe('Dashboard — linha de meta no gráfico', () => {
  it('adiciona a série "meta" com o valor do alvo quando métrica numérica tem meta', async () => {
    mockFetch(
      [metricaNumerica],
      [{ id: 1, metric: 42, alvo: '100', periodo_referencia: '', created_at: '2026-07-01T00:00:00' }],
      [
        { id: 1, goal: 1, data: '2026-07-01', valor_logado: '40' },
        { id: 2, goal: 1, data: '2026-07-02', valor_logado: '60' },
      ]
    );
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('line-meta')).toBeInTheDocument());

    const chartData = JSON.parse(screen.getByTestId('line-chart').getAttribute('data-chart')!);
    expect(chartData).toHaveLength(2);
    chartData.forEach((point: { meta: number }) => expect(point.meta).toBe(100));
  });

  it('exibe legenda quando a linha de meta está presente', async () => {
    mockFetch(
      [metricaNumerica],
      [{ id: 1, metric: 42, alvo: '100', periodo_referencia: '', created_at: '2026-07-01T00:00:00' }],
      [{ id: 1, goal: 1, data: '2026-07-01', valor_logado: '40' }]
    );
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('legend')).toBeInTheDocument());
  });

  it('usa o alvo da meta mais recente quando há mais de uma para a métrica', async () => {
    mockFetch(
      [metricaNumerica],
      [
        { id: 1, metric: 42, alvo: '100', periodo_referencia: '', created_at: '2026-06-01T00:00:00' },
        { id: 2, metric: 42, alvo: '150', periodo_referencia: '', created_at: '2026-07-01T00:00:00' },
      ],
      [{ id: 1, goal: 1, data: '2026-07-01', valor_logado: '40' }]
    );
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('line-meta')).toBeInTheDocument());

    const chartData = JSON.parse(screen.getByTestId('line-chart').getAttribute('data-chart')!);
    expect(chartData[0].meta).toBe(150);
  });

  it('não adiciona linha de meta na visão "Todas as Métricas"', async () => {
    mockFetch(
      [
        { id: 1, codigo: 'A', nome: 'Alpha', tipo: 'number', periodo: 'daily', is_default: false },
        { id: 2, codigo: 'B', nome: 'Beta', tipo: 'number', periodo: 'daily', is_default: false },
      ],
      [{ id: 1, metric: 1, alvo: '100', periodo_referencia: '', created_at: '2026-07-01T00:00:00' }],
      [{ id: 1, goal: 1, data: '2026-07-01', valor_logado: '40' }]
    );
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('line-chart')).toBeInTheDocument());
    expect(screen.queryByTestId('line-meta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
  });

  it('não adiciona linha de meta quando o alvo não é numérico', async () => {
    mockFetch(
      [metricaNumerica],
      [{ id: 1, metric: 42, alvo: 'concluir projeto', periodo_referencia: '', created_at: '2026-07-01T00:00:00' }],
      [{ id: 1, goal: 1, data: '2026-07-01', valor_logado: '40' }]
    );
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('line-chart')).toBeInTheDocument());
    expect(screen.queryByTestId('line-meta')).not.toBeInTheDocument();
  });
});
