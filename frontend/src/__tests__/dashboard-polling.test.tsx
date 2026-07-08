import { render, screen, act } from '@testing-library/react';
import DashboardGrid from '@/components/dashboard/DashboardGrid';

// Router estável (como em produção): um objeto novo a cada render faria o
// efeito de fetch re-executar sozinho e mascararia o comportamento.
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
  Bar: () => null,
  Line: () => null,
  Legend: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Duas métricas sem is_default → selectedMetric permanece "all" (gráfico de
// frequência por dia); não precisa selecionar métrica nem casar metas.
const metrics = [
  { id: 1, codigo: 'A', nome: 'Alpha', tipo: 'number', periodo: 'daily', is_default: false },
  { id: 2, codigo: 'B', nome: 'Beta', tipo: 'number', periodo: 'daily', is_default: false },
];
let currentLogs: object[] = [];

function setupFetch() {
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/subscriptions/')) return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    if (url.includes('/metrics/'))       return Promise.resolve({ ok: true, status: 200, json: async () => metrics });
    if (url.includes('/goals/'))         return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    if (url.includes('/logs/'))          return Promise.resolve({ ok: true, status: 200, json: async () => currentLogs });
    return Promise.resolve({ ok: true, status: 200, json: async () => [] });
  });
}

const flush = async () => {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};

function quantidadeDoGrafico() {
  const el = screen.queryByTestId('composed-chart');
  if (!el) return undefined;
  const d = JSON.parse(el.getAttribute('data-chart')!);
  return d[0]?.quantidade;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-15T12:00:00'));
  localStorage.setItem('access_token', 'fake-token');
  currentLogs = [];
  setupFetch();
});

afterEach(() => {
  jest.useRealTimers();
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

describe('Dashboard — polling reatualiza sem navegação nem foco', () => {
  it('atualiza o gráfico periodicamente quando novos lançamentos chegam', async () => {
    currentLogs = [{ id: 1, goal: 1, data: '2026-07-15', valor_logado: '5' }];
    render(<DashboardGrid />);
    await flush();
    expect(quantidadeDoGrafico()).toBe(1);

    // Novo lançamento chega no backend; usuário não navega nem troca de aba.
    currentLogs = [...currentLogs, { id: 2, goal: 1, data: '2026-07-15', valor_logado: '3' }];

    await act(async () => { jest.advanceTimersByTime(20000); });
    await flush();

    expect(quantidadeDoGrafico()).toBe(2);
  });
});
