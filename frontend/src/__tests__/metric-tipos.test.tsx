import { render, screen } from '@testing-library/react';
import MetricForm from '@/components/metrics/MetricForm';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import { waitFor } from '@testing-library/react';

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
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

beforeEach(() => {
  localStorage.setItem('access_token', 'fake-token');
  mockPush.mockClear();
});

afterEach(() => {
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

describe('MetricForm — tipos disponíveis', () => {
  beforeEach(() => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => [],
    });
  });

  it('exibe opção currency', () => {
    render(<MetricForm />);
    expect(screen.getByRole('option', { name: /monetário|currency/i })).toBeInTheDocument();
  });

  it('exibe opção percent', () => {
    render(<MetricForm />);
    expect(screen.getByRole('option', { name: /percentual|percent/i })).toBeInTheDocument();
  });
});

describe('DashboardGrid — tipos numéricos reconhecidos', () => {
  function mockWithMetricTipo(tipo: string) {
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/metrics/')) return Promise.resolve({ ok: true, status: 200, json: async () => [{ id: 1, codigo: 'M', nome: 'Métrica', tipo, periodo: 'daily' }] });
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
  }

  it('trata currency como numérico (título do gráfico muda para "Evolução Cumulativa")', async () => {
    mockWithMetricTipo('currency');
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect(screen.getByText(/Evolução Cumulativa/i)).toBeInTheDocument();
  });

  it('trata percent como numérico (título do gráfico muda para "Evolução Cumulativa")', async () => {
    mockWithMetricTipo('percent');
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect(screen.getByText(/Evolução Cumulativa/i)).toBeInTheDocument();
  });
});
