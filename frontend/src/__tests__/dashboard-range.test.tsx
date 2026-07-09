import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

const metricaMensal = { id: 50, codigo: 'FAT', nome: 'Faturamento', tipo: 'number', periodo: 'monthly', is_default: false };
const progressJul = {
  tipo: 'number', periodo: 'monthly',
  pontos: [{ periodo: '2026-07', realizado: 250, meta: 300 }],
  meta_total: 300, realizado_total: 250, pct: 83,
};

beforeEach(() => { localStorage.setItem('access_token', 'fake-token'); mockPush.mockClear(); });
afterEach(() => { localStorage.clear(); delete (global as { fetch?: unknown }).fetch; });

describe('Dashboard — KPIs vindos do /progress', () => {
  it('mostra meta total, realizado e percentual do progress', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      const ok = (j: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => j });
      if (url.includes('/progress')) return ok(progressJul);
      if (url.includes('/subscriptions/')) return ok([]);
      if (url.includes('/metrics/')) return ok([metricaMensal]);
      return ok([]);
    });
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('kpi-meta-total')).toBeInTheDocument());
    expect(screen.getByTestId('kpi-meta-total').textContent).toContain('300');
    expect(screen.getByTestId('kpi-realizado-total').textContent).toContain('250');
    expect(screen.getByTestId('kpi-percentual').textContent).toContain('83');
  });

  it('não exibe KPIs de meta na visão Todas as Métricas', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      const ok = (j: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => j });
      if (url.includes('/subscriptions/')) return ok([]);
      if (url.includes('/metrics/')) return ok([
        { id: 1, codigo: 'A', nome: 'Alpha', tipo: 'number', periodo: 'daily', is_default: false },
        { id: 2, codigo: 'B', nome: 'Beta', tipo: 'number', periodo: 'daily', is_default: false },
      ]);
      return ok([]);
    });
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect(screen.queryByTestId('kpi-meta-total')).not.toBeInTheDocument();
  });

  it('refaz o /progress com o novo intervalo ao mudar as datas', async () => {
    const calls: string[] = [];
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      calls.push(url);
      const ok = (j: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => j });
      if (url.includes('/progress')) return ok(progressJul);
      if (url.includes('/subscriptions/')) return ok([]);
      if (url.includes('/metrics/')) return ok([metricaMensal]);
      return ok([]);
    });
    const { container } = render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('composed-chart')).toBeInTheDocument());
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-05-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-05-31' } });
    await waitFor(() =>
      expect(calls.some(u => u.includes('/progress') && u.includes('start=2026-05-01') && u.includes('end=2026-05-31'))).toBe(true)
    );
  });
});
