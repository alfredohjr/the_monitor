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
    const btns = screen.getAllByRole('button', { name: /subscribe/i });
    expect(btns.length).toBe(3);
  });

  it('exibe botão "Cancelar" para métricas já assinadas', async () => {
    mockFetch([{ id: 10, metric_id: 1 }]);
    render(<CatalogPage />);
    await screen.findByText('Métrica A');
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /subscribe/i }).length).toBe(2);
  });

  it('assinar métrica atualiza botão para "Cancelar"', async () => {
    mockFetch([]);
    render(<CatalogPage />);
    await screen.findByText('Métrica A');
    fireEvent.click(screen.getAllByRole('button', { name: /subscribe/i })[0]);
    await waitFor(() => expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument());
  });

  it('cancelar assinatura atualiza botão para "Assinar"', async () => {
    mockFetch([{ id: 10, metric_id: 1 }]);
    render(<CatalogPage />);
    await screen.findByText('Métrica A');
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /subscribe/i }).length).toBe(3));
  });
});

describe('Catálogo — idioma (#298)', () => {
  it('renderiza o chrome em pt-BR, mas o nome da métrica segue vindo do banco', async () => {
    localStorage.setItem('locale', 'pt-BR');
    // O helper do suite já entrega as métricas fixas (Métrica A/B/C) e recebe
    // apenas as assinaturas — não tem parâmetro de métricas.
    mockFetch();
    render(<CatalogPage />);
    expect(await screen.findByText('Catálogo de Métricas')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /assinar/i }).length).toBe(3);
    // nome vindo do banco: não é traduzido aqui (#317)
    expect(screen.getByText('Métrica A')).toBeInTheDocument();
  });
});

test('a tela exibe o nome que o backend entregou, sem traduzir nada por conta própria', async () => {
  // O #317 traduz o catálogo semeado no BACKEND, por Accept-Language. A tela só
  // consome. Se algum dia alguém puser um mapa de tradução aqui, os dois lados
  // divergem e ninguém sabe qual vale.
  localStorage.setItem('locale', 'pt-BR');
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/subscriptions/')) return Promise.resolve({ ok: true, json: async () => [] });
    return Promise.resolve({ ok: true, json: async () => [
      { id: 1, codigo: 'PAD_A', nome: 'Daily Revenue', tipo: 'currency', periodo: 'daily', is_default: true },
    ] });
  });
  render(<CatalogPage />);
  // Mesmo com o locale em pt-BR, a tela mostra o que veio na resposta.
  expect(await screen.findByText('Daily Revenue')).toBeInTheDocument();
});

test('o selo do card mostra rótulo traduzido, igual à tabela de métricas (#367)', async () => {
  mockFetch();
  render(<CatalogPage />);
  await screen.findByText('Métrica A');
  // metricaB é currency/monthly — mesmo par de rótulos que o MetricList usa.
  expect(screen.getByText('Currency · Monthly')).toBeInTheDocument();
});
