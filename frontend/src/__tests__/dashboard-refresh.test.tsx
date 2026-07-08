import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import DashboardGrid from '@/components/dashboard/DashboardGrid';

// Router estável (como em produção) — um objeto novo a cada render faria o
// efeito de fetch (dep [router]) re-executar sozinho e mascarar o bug.
jest.mock('next/navigation', () => {
  const router = { push: jest.fn() };
  return { useRouter: () => router };
});

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

const metricaMensal = { id: 50, codigo: 'FAT', nome: 'Faturamento', tipo: 'number', periodo: 'monthly', is_default: false };
const goals = [{ id: 1, metric: 50, alvo: '300', periodo_referencia: '2026-07', created_at: '2026-07-01T00:00:00' }];
let currentLogs: object[] = [];

function setupFetch() {
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/subscriptions/')) return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    if (url.includes('/metrics/'))       return Promise.resolve({ ok: true, status: 200, json: async () => [metricaMensal] });
    if (url.includes('/goals/'))         return Promise.resolve({ ok: true, status: 200, json: async () => goals });
    if (url.includes('/logs/'))          return Promise.resolve({ ok: true, status: 200, json: async () => currentLogs });
    return Promise.resolve({ ok: true, status: 200, json: async () => [] });
  });
}

function realizadoDoGrafico() {
  const d = JSON.parse(screen.getByTestId('composed-chart').getAttribute('data-chart')!);
  return d[0]?.realizado;
}

beforeEach(() => {
  localStorage.setItem('access_token', 'fake-token');
  currentLogs = [];
  setupFetch();
});

afterEach(() => {
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

describe('Dashboard — reatualiza dados após novos lançamentos', () => {
  it('refaz o fetch e atualiza o gráfico ao voltar o foco para a janela', async () => {
    currentLogs = [{ id: 1, goal: 1, data: '2026-07-05', valor_logado: '100' }];
    const { container } = render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('composed-chart')).toBeInTheDocument());

    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-07-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-07-31' } });
    await waitFor(() => expect(realizadoDoGrafico()).toBe(100));

    // Um novo lançamento é registrado (chega no backend).
    currentLogs = [...currentLogs, { id: 2, goal: 1, data: '2026-07-10', valor_logado: '150' }];

    // Usuário volta o foco para a aba do dashboard → deve refazer o fetch.
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(realizadoDoGrafico()).toBe(250));
  });
});
