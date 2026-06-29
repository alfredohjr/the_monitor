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
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function mockFetch(metrics: object[], goals = [], logs = []) {
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/metrics/')) return Promise.resolve({ ok: true, status: 200, json: async () => metrics });
    if (url.includes('/goals/')) return Promise.resolve({ ok: true, status: 200, json: async () => goals });
    if (url.includes('/logs/')) return Promise.resolve({ ok: true, status: 200, json: async () => logs });
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

describe('Dashboard — auto-seleção de métrica', () => {
  it('mostra "Todas as Métricas" quando não há métricas', async () => {
    mockFetch([]);
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('all');
  });

  it('pré-seleciona automaticamente quando há apenas 1 métrica', async () => {
    mockFetch([{ id: 42, codigo: 'VENDAS', nome: 'Vendas', tipo: 'number', periodo: 'daily' }]);
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('42');
  });

  it('mantém "Todas as Métricas" quando há mais de 1 métrica sem is_default', async () => {
    mockFetch([
      { id: 1, codigo: 'A', nome: 'Alpha', tipo: 'number', periodo: 'daily', is_default: false },
      { id: 2, codigo: 'B', nome: 'Beta', tipo: 'number', periodo: 'daily', is_default: false },
    ]);
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('all');
  });

  it('pré-seleciona a métrica com is_default=true mesmo havendo várias', async () => {
    mockFetch([
      { id: 1, codigo: 'A', nome: 'Alpha', tipo: 'number', periodo: 'daily', is_default: false },
      { id: 2, codigo: 'B', nome: 'Beta',  tipo: 'number', periodo: 'daily', is_default: true },
      { id: 3, codigo: 'C', nome: 'Gamma', tipo: 'number', periodo: 'daily', is_default: false },
    ]);
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('2');
  });

  it('quando há is_default=true e apenas 1 métrica, pré-seleciona a única', async () => {
    mockFetch([{ id: 7, codigo: 'X', nome: 'Xis', tipo: 'currency', periodo: 'daily', is_default: true }]);
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.queryByText(/sincronizando/i)).not.toBeInTheDocument());
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('7');
  });
});
