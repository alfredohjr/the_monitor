import { render, screen, waitFor } from '@testing-library/react';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import GoalForm from '@/components/goals/GoalForm';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: '1' }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const metricaPropria  = { id: 1, codigo: 'PROP', nome: 'Minha Métrica',   tipo: 'number',   periodo: 'daily', is_default: false };
const metricaSistema  = { id: 2, codigo: 'SYS',  nome: 'Métrica Sistema', tipo: 'currency', periodo: 'monthly', is_default: true };
const metricaSistema2 = { id: 3, codigo: 'SYS2', nome: 'Não Assinada',   tipo: 'number',   periodo: 'daily', is_default: true };

beforeEach(() => {
  localStorage.setItem('access_token', 'fake-token');
  mockPush.mockClear();
});

afterEach(() => {
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

// --- DashboardGrid ---

describe('DashboardGrid — filtra métricas por subscrição', () => {
  function mockFetch(subscriptions: { id: number; metric_id: number }[]) {
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/metrics/'))       return Promise.resolve({ ok: true, status: 200, json: async () => [metricaPropria, metricaSistema, metricaSistema2] });
      if (url.includes('/subscriptions/')) return Promise.resolve({ ok: true, status: 200, json: async () => subscriptions });
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
  }

  it('exibe métrica própria (is_default=false) sem necessidade de subscrição', async () => {
    mockFetch([]);
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'Minha Métrica' })).toBeInTheDocument();
  });

  it('exibe métrica do sistema apenas se assinada', async () => {
    mockFetch([{ id: 10, metric_id: 2 }]);
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'Métrica Sistema' })).toBeInTheDocument();
  });

  it('oculta métrica do sistema não assinada', async () => {
    mockFetch([{ id: 10, metric_id: 2 }]);
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect(screen.queryByRole('option', { name: 'Não Assinada' })).not.toBeInTheDocument();
  });
});

// --- GoalForm ---

describe('GoalForm — filtra métricas por subscrição no select', () => {
  function mockFetch(subscriptions: { id: number; metric_id: number }[]) {
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/metrics/'))       return Promise.resolve({ ok: true, status: 200, json: async () => [metricaPropria, metricaSistema, metricaSistema2] });
      if (url.includes('/subscriptions/')) return Promise.resolve({ ok: true, status: 200, json: async () => subscriptions });
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
  }

  it('exibe métrica própria sem subscrição', async () => {
    mockFetch([]);
    render(<GoalForm />);
    expect(await screen.findByText('Minha Métrica (daily)')).toBeInTheDocument();
  });

  it('exibe métrica do sistema assinada', async () => {
    mockFetch([{ id: 10, metric_id: 2 }]);
    render(<GoalForm />);
    expect(await screen.findByText(/Métrica Sistema/)).toBeInTheDocument();
  });

  it('oculta métrica do sistema não assinada', async () => {
    mockFetch([{ id: 10, metric_id: 2 }]);
    render(<GoalForm />);
    await screen.findByText(/Minha Métrica/);
    expect(screen.queryByText(/Não Assinada/)).not.toBeInTheDocument();
  });
});
