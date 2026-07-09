import { render, screen, waitFor } from '@testing-library/react';
import DashboardGrid from '@/components/dashboard/DashboardGrid';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>;
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
  XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function mockFetch({ metrics = [] as object[], progress = null as object | null, logs = [] as object[], goals = [] as object[], subs = [] as object[] }) {
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
    const ok = (json: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => json });
    if (url.includes('/progress')) return progress ? ok(progress) : Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    if (url.includes('/subscriptions/')) return ok(subs);
    if (url.includes('/metrics/')) return ok(metrics);
    if (url.includes('/goals/')) return ok(goals);
    if (url.includes('/logs/')) return ok(logs);
    return ok([]);
  });
}

const metricaMensal = { id: 50, codigo: 'FAT', nome: 'Faturamento', tipo: 'number', periodo: 'monthly', is_default: false };
const chartData = () => JSON.parse(screen.getByTestId('composed-chart').getAttribute('data-chart')!);

beforeEach(() => { localStorage.setItem('access_token', 'fake-token'); mockPush.mockClear(); });
afterEach(() => { localStorage.clear(); delete (global as { fetch?: unknown }).fetch; });

describe('Dashboard — consome /progress (barra = meta, linha = realizado)', () => {
  it('desenha barra de meta e linha de realizado a partir do progress', async () => {
    mockFetch({ metrics: [metricaMensal], progress: {
      tipo: 'number', periodo: 'monthly',
      pontos: [{ periodo: '2026-07', realizado: 250, meta: 300 }],
      meta_total: 300, realizado_total: 250, pct: 83,
    }});
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('bar-meta')).toBeInTheDocument());
    expect(screen.getByTestId('line-realizado')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
    expect(chartData()[0]).toMatchObject({ dataPoint: '2026-07', realizado: 250, meta: 300 });
  });

  it('bucket só com meta vem com realizado null (vão na linha)', async () => {
    mockFetch({ metrics: [metricaMensal], progress: {
      tipo: 'number', periodo: 'monthly',
      pontos: [{ periodo: '2026-07', realizado: 90, meta: null }, { periodo: '2026-08', realizado: null, meta: 200 }],
      meta_total: 200, realizado_total: 90, pct: 45,
    }});
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('bar-meta')).toBeInTheDocument());
    const ago = chartData().find((p: { dataPoint: string }) => p.dataPoint === '2026-08');
    expect(ago.realizado).toBeNull();
    expect(ago.meta).toBe(200);
  });

  it('não desenha barra de meta na visão "Todas as Métricas"', async () => {
    mockFetch({ metrics: [
      { id: 1, codigo: 'A', nome: 'Alpha', tipo: 'number', periodo: 'daily', is_default: false },
      { id: 2, codigo: 'B', nome: 'Beta', tipo: 'number', periodo: 'daily', is_default: false },
    ]});
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect(screen.queryByTestId('bar-meta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
  });
});
