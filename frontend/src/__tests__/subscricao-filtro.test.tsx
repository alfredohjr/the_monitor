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
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  Line: () => null,
  Legend: () => null,
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

// O filtro (próprias + defaults assinadas) agora é feito no backend via
// ?apenas_inscritas=true (coberto por pytest). Aqui verificamos apenas que a
// tela consome a lista já filtrada que o endpoint entrega — /metrics/ devolve
// exatamente o que deve aparecer.

// --- DashboardGrid ---

describe('DashboardGrid — consome a lista de métricas do backend', () => {
  function mockMetrics(returned: unknown[]) {
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/metrics/')) return Promise.resolve({ ok: true, status: 200, json: async () => returned });
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
  }

  it('exibe métrica própria retornada pelo backend', async () => {
    mockMetrics([metricaPropria]);
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'Minha Métrica' })).toBeInTheDocument();
  });

  it('exibe métrica do sistema quando o backend a inclui (assinada)', async () => {
    mockMetrics([metricaPropria, metricaSistema]);
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'Métrica Sistema' })).toBeInTheDocument();
  });

  it('não exibe métrica que o backend não retornou (não assinada)', async () => {
    mockMetrics([metricaPropria, metricaSistema]);
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect(screen.queryByRole('option', { name: 'Não Assinada' })).not.toBeInTheDocument();
  });
});

// --- GoalForm ---

describe('GoalForm — consome a lista de métricas do backend no select', () => {
  function mockMetrics(returned: unknown[]) {
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/metrics/')) return Promise.resolve({ ok: true, status: 200, json: async () => returned });
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
  }

  it('exibe métrica própria retornada pelo backend', async () => {
    mockMetrics([metricaPropria]);
    render(<GoalForm />);
    expect(await screen.findByText('Minha Métrica (daily)')).toBeInTheDocument();
  });

  it('exibe métrica do sistema quando o backend a inclui', async () => {
    mockMetrics([metricaPropria, metricaSistema]);
    render(<GoalForm />);
    expect(await screen.findByText(/Métrica Sistema/)).toBeInTheDocument();
  });

  it('não exibe métrica que o backend não retornou', async () => {
    mockMetrics([metricaPropria, metricaSistema]);
    render(<GoalForm />);
    await screen.findByText(/Minha Métrica/);
    expect(screen.queryByText(/Não Assinada/)).not.toBeInTheDocument();
  });
});
