import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

const metricaMensal = { id: 50, codigo: 'FAT', nome: 'Faturamento', tipo: 'number', periodo: 'monthly', is_default: false };

beforeEach(() => {
  localStorage.setItem('access_token', 'fake-token');
  mockPush.mockClear();
});

afterEach(() => {
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

describe('Dashboard — filtro de range de data', () => {
  it('sugere o mês atual por padrão (dia 1 ao último dia)', async () => {
    mockFetch([]);
    const { container } = render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();

    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs).toHaveLength(2);
    expect((dateInputs[0] as HTMLInputElement).value).toBe(`${y}-${m}-01`);
    expect((dateInputs[1] as HTMLInputElement).value).toBe(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
  });

  it('exclui buckets fora do range selecionado', async () => {
    mockFetch(
      [metricaMensal],
      [
        { id: 1, metric: 50, alvo: '300', periodo_referencia: '2026-07', created_at: '2026-07-01T00:00:00' },
        { id: 2, metric: 50, alvo: '200', periodo_referencia: '2026-08', created_at: '2026-08-01T00:00:00' },
      ],
      [
        { id: 1, goal: 1, data: '2026-07-05', valor_logado: '100' },
        { id: 2, goal: 1, data: '2026-07-20', valor_logado: '150' },
        { id: 3, goal: 2, data: '2026-08-10', valor_logado: '50' },
      ]
    );
    const { container } = render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('composed-chart')).toBeInTheDocument());

    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-07-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-07-31' } });

    await waitFor(() => {
      const data = chartData();
      expect(data).toHaveLength(1);
      expect(data[0].dataPoint).toBe('2026-07');
    });
  });
});

describe('Dashboard — KPIs de meta/realizado/percentual', () => {
  async function renderComRangeJulho() {
    mockFetch(
      [metricaMensal],
      [
        { id: 1, metric: 50, alvo: '300', periodo_referencia: '2026-07', created_at: '2026-07-01T00:00:00' },
        { id: 2, metric: 50, alvo: '200', periodo_referencia: '2026-08', created_at: '2026-08-01T00:00:00' },
      ],
      [
        { id: 1, goal: 1, data: '2026-07-05', valor_logado: '100' },
        { id: 2, goal: 1, data: '2026-07-20', valor_logado: '150' },
        { id: 3, goal: 2, data: '2026-08-10', valor_logado: '50' },
      ]
    );
    const { container } = render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('composed-chart')).toBeInTheDocument());
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-07-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-07-31' } });
    await waitFor(() => expect(screen.getByTestId('kpi-meta-total')).toBeInTheDocument());
  }

  it('mostra meta total, realizado total e percentual no range', async () => {
    await renderComRangeJulho();
    // Julho: meta 300, realizado 100+150=250, % = 83
    expect(screen.getByTestId('kpi-meta-total').textContent).toContain('300');
    expect(screen.getByTestId('kpi-realizado-total').textContent).toContain('250');
    expect(screen.getByTestId('kpi-percentual').textContent).toContain('83');
  });

  it('não exibe KPIs de meta quando não há meta (visão Todas as Métricas)', async () => {
    mockFetch(
      [
        { id: 1, codigo: 'A', nome: 'Alpha', tipo: 'number', periodo: 'daily', is_default: false },
        { id: 2, codigo: 'B', nome: 'Beta', tipo: 'number', periodo: 'daily', is_default: false },
      ],
      [],
      []
    );
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect(screen.queryByTestId('kpi-meta-total')).not.toBeInTheDocument();
  });
});
