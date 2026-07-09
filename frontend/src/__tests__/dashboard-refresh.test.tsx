import { render, screen, waitFor, act } from '@testing-library/react';
import DashboardGrid from '@/components/dashboard/DashboardGrid';

// Router estável (como em produção): um objeto novo a cada render faria o
// efeito de fetch re-executar sozinho e mascararia o comportamento.
jest.mock('next/navigation', () => {
  const router = { push: jest.fn() };
  return { useRouter: () => router };
});
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>;
  MockLink.displayName = 'MockLink';
  return MockLink;
});
jest.mock('recharts', () => ({
  ComposedChart: ({ children, data }: { children: React.ReactNode; data: object[] }) => (
    <div data-testid="composed-chart" data-chart={JSON.stringify(data)}>{children}</div>
  ),
  Bar: () => null, Line: () => null, Legend: () => null,
  XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const metricaMensal = { id: 50, codigo: 'FAT', nome: 'Faturamento', tipo: 'number', periodo: 'monthly', is_default: false };

beforeEach(() => { localStorage.setItem('access_token', 'fake-token'); });
afterEach(() => { localStorage.clear(); delete (global as { fetch?: unknown }).fetch; });

describe('Dashboard — reatualiza o /progress após novos lançamentos', () => {
  it('refaz o /progress e atualiza o realizado ao voltar o foco para a janela', async () => {
    let realizado = 100;
    (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
      const ok = (j: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => j });
      if (url.includes('/progress')) return ok({
        tipo: 'number', periodo: 'monthly',
        pontos: [{ periodo: '2026-07', realizado, meta: 300 }],
        meta_total: 300, realizado_total: realizado, pct: Math.round((realizado / 300) * 100),
      });
      if (url.includes('/subscriptions/')) return ok([]);
      if (url.includes('/metrics/')) return ok([metricaMensal]);
      return ok([]);
    });
    render(<DashboardGrid />);
    await waitFor(() => expect(screen.getByTestId('kpi-realizado-total').textContent).toContain('100'));

    // Novo lançamento chega no backend (progress passa a somar 250).
    realizado = 250;
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(screen.getByTestId('kpi-realizado-total').textContent).toContain('250'));
  });
});
