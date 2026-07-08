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
  ComposedChart: ({ children, data }: { children: React.ReactNode; data: object[] }) => (
    <div data-testid="composed-chart" data-chart={JSON.stringify(data)}>{children}</div>
  ),
  Bar: ({ dataKey }: { dataKey: string }) => <div data-testid={`bar-${dataKey}`} />,
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

function chartData() {
  return JSON.parse(screen.getByTestId('composed-chart').getAttribute('data-chart')!);
}

const metricaDiaria = { id: 42, codigo: 'VENDAS', nome: 'Vendas', tipo: 'number', periodo: 'daily', is_default: false };
const metricaMensal = { id: 50, codigo: 'FAT', nome: 'Faturamento', tipo: 'currency', periodo: 'monthly', is_default: false };

beforeEach(() => {
  localStorage.setItem('access_token', 'fake-token');
  mockPush.mockClear();
});

afterEach(() => {
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

describe('Dashboard — gráfico composto (barra = meta, linha = realizado)', () => {
  it('desenha barra de meta e linha de realizado para métrica numérica com meta', async () => {
    mockFetch(
      [metricaDiaria],
      [{ id: 1, metric: 42, alvo: '100', periodo_referencia: '2026-07-01', created_at: '2026-07-01T00:00:00' }],
      [
        { id: 1, goal: 1, data: '2026-07-01', valor_logado: '40' },
        { id: 2, goal: 1, data: '2026-07-01', valor_logado: '60' },
      ]
    );
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('bar-meta')).toBeInTheDocument());
    expect(screen.getByTestId('line-realizado')).toBeInTheDocument();

    const data = chartData();
    const bucket = data.find((p: { dataPoint: string }) => p.dataPoint === '2026-07-01');
    expect(bucket.meta).toBe(100);
    expect(bucket.realizado).toBe(100);
  });

  it('exibe legenda quando há meta', async () => {
    mockFetch(
      [metricaDiaria],
      [{ id: 1, metric: 42, alvo: '100', periodo_referencia: '2026-07-01', created_at: '2026-07-01T00:00:00' }],
      [{ id: 1, goal: 1, data: '2026-07-01', valor_logado: '40' }]
    );
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('legend')).toBeInTheDocument());
  });

  it('agrega o realizado por período (mensal) e casa com a meta do mês', async () => {
    mockFetch(
      [metricaMensal],
      [{ id: 1, metric: 50, alvo: '300', periodo_referencia: '2026-07', created_at: '2026-07-01T00:00:00' }],
      [
        { id: 1, goal: 1, data: '2026-07-05', valor_logado: '100' },
        { id: 2, goal: 1, data: '2026-07-20', valor_logado: '150' },
      ]
    );
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('bar-meta')).toBeInTheDocument());

    const data = chartData();
    expect(data).toHaveLength(1);
    expect(data[0].dataPoint).toBe('2026-07');
    expect(data[0].realizado).toBe(250);
    expect(data[0].meta).toBe(300);
  });

  it('mostra o bucket que tem meta mas ainda não tem lançamento', async () => {
    mockFetch(
      [metricaMensal],
      [{ id: 1, metric: 50, alvo: '200', periodo_referencia: '2026-08', created_at: '2026-07-01T00:00:00' }],
      [{ id: 1, goal: 1, data: '2026-07-10', valor_logado: '90' }]
    );
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('bar-meta')).toBeInTheDocument());

    const data = chartData();
    const jul = data.find((p: { dataPoint: string }) => p.dataPoint === '2026-07');
    const ago = data.find((p: { dataPoint: string }) => p.dataPoint === '2026-08');
    expect(jul.realizado).toBe(90);
    expect(jul.meta).toBeUndefined();
    expect(ago.meta).toBe(200);
    expect(ago.realizado).toBeNull();
  });

  it('não desenha barra de meta na visão "Todas as Métricas"', async () => {
    mockFetch(
      [
        { id: 1, codigo: 'A', nome: 'Alpha', tipo: 'number', periodo: 'daily', is_default: false },
        { id: 2, codigo: 'B', nome: 'Beta', tipo: 'number', periodo: 'daily', is_default: false },
      ],
      [{ id: 1, metric: 1, alvo: '100', periodo_referencia: '2026-07-01', created_at: '2026-07-01T00:00:00' }],
      [{ id: 1, goal: 1, data: '2026-07-01', valor_logado: '40' }]
    );
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('composed-chart')).toBeInTheDocument());
    expect(screen.queryByTestId('bar-meta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
    expect(screen.getByTestId('line-quantidade')).toBeInTheDocument();
  });

  it('não desenha barra de meta quando o alvo não é numérico', async () => {
    mockFetch(
      [metricaDiaria],
      [{ id: 1, metric: 42, alvo: 'concluir projeto', periodo_referencia: '2026-07-01', created_at: '2026-07-01T00:00:00' }],
      [{ id: 1, goal: 1, data: '2026-07-01', valor_logado: '40' }]
    );
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('line-realizado')).toBeInTheDocument());
    expect(screen.queryByTestId('bar-meta')).not.toBeInTheDocument();
  });
});
