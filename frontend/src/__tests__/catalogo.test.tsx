import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CatalogPage from '@/components/catalog/CatalogPage';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const metricaA = { id: 1, codigo: 'PAD_A', nome: 'Métrica A', tipo: 'number',   periodo: 'daily',   is_default: true };
const metricaB = { id: 2, codigo: 'PAD_B', nome: 'Métrica B', tipo: 'currency', periodo: 'monthly', is_default: true };
const metricaC = { id: 3, codigo: 'PAD_C', nome: 'Métrica C', tipo: 'percent',  periodo: 'daily',   is_default: true };

function mockFetch(subscriptions: { id: number; metric_id: number }[] = []) {
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url.includes('/metrics/'))       return Promise.resolve({ ok: true, json: async () => [metricaA, metricaB, metricaC] });
    if (url.includes('/subscriptions/') && opts?.method === 'POST')
      return Promise.resolve({ ok: true, json: async () => ({ id: 99, metric_id: 1 }) });
    if (url.includes('/subscriptions/') && opts?.method === 'DELETE')
      return Promise.resolve({ ok: true, json: async () => ({}) });
    if (url.includes('/subscriptions/')) return Promise.resolve({ ok: true, json: async () => subscriptions });
    return Promise.resolve({ ok: true, json: async () => [] });
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

describe('CatalogPage — catálogo de métricas do sistema', () => {
  it('redireciona para /login sem token', () => {
    localStorage.clear();
    mockFetch();
    render(<CatalogPage />);
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('lista todas as métricas do sistema', async () => {
    mockFetch();
    render(<CatalogPage />);
    expect(await screen.findByText('Métrica A')).toBeInTheDocument();
    expect(screen.getByText('Métrica B')).toBeInTheDocument();
    expect(screen.getByText('Métrica C')).toBeInTheDocument();
  });

  it('exibe botão "Assinar" para métricas não assinadas', async () => {
    mockFetch([]);
    render(<CatalogPage />);
    await screen.findByText('Métrica A');
    const btns = screen.getAllByRole('button', { name: /assinar/i });
    expect(btns.length).toBe(3);
  });

  it('exibe botão "Cancelar" para métricas já assinadas', async () => {
    mockFetch([{ id: 10, metric_id: 1 }]);
    render(<CatalogPage />);
    await screen.findByText('Métrica A');
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /assinar/i }).length).toBe(2);
  });

  it('assinar métrica atualiza botão para "Cancelar"', async () => {
    mockFetch([]);
    render(<CatalogPage />);
    await screen.findByText('Métrica A');
    fireEvent.click(screen.getAllByRole('button', { name: /assinar/i })[0]);
    await waitFor(() => expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument());
  });

  it('cancelar assinatura atualiza botão para "Assinar"', async () => {
    mockFetch([{ id: 10, metric_id: 1 }]);
    render(<CatalogPage />);
    await screen.findByText('Métrica A');
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /assinar/i }).length).toBe(3));
  });
});
