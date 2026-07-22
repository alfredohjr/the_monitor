import { render, screen } from '@testing-library/react';
import MetricList from '@/components/metrics/MetricList';
import MetricForm from '@/components/metrics/MetricForm';

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

beforeEach(() => {
  localStorage.setItem('access_token', 'fake-token');
  mockPush.mockClear();
});

afterEach(() => {
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

function mockFetch(metrics: object[], subscriptions: object[] = []) {
  (global as { fetch: unknown }).fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/subscriptions/')) return Promise.resolve({ ok: true, status: 200, json: async () => subscriptions });
    if (url.includes('/metrics/'))       return Promise.resolve({ ok: true, status: 200, json: async () => metrics });
    return Promise.resolve({ ok: true, status: 200, json: async () => [] });
  });
}

describe('MetricList — próprias + assinadas', () => {
  it('não renderiza métrica do sistema NÃO assinada', async () => {
    mockFetch([{ id: 1, codigo: 'PAD', nome: 'SistemaNaoAssinada', descricao: 'desc', tipo: 'number', periodo: 'daily', is_default: true }], []);
    render(<MetricList />);
    await screen.findByText(/minhas métricas/i);
    expect(screen.queryByText('SistemaNaoAssinada')).not.toBeInTheDocument();
  });

  it('renderiza métrica do sistema assinada (sem Editar/Apagar)', async () => {
    mockFetch(
      [{ id: 3, codigo: 'PAD', nome: 'SistemaAssinada', descricao: 'desc', tipo: 'number', periodo: 'daily', is_default: true }],
      [{ id: 1, metric_id: 3 }]
    );
    render(<MetricList />);
    expect(await screen.findByText('SistemaAssinada')).toBeInTheDocument();
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByText('Apagar')).not.toBeInTheDocument();
  });

  it('renderiza métrica própria (is_default=false) com botões Editar e Apagar', async () => {
    mockFetch([{ id: 2, codigo: 'MNH', nome: 'Minha', descricao: 'desc', tipo: 'number', periodo: 'daily', is_default: false }], []);
    render(<MetricList />);
    await screen.findByText('Minha');
    expect(screen.getByText('Editar')).toBeInTheDocument();
    expect(screen.getByText('Apagar')).toBeInTheDocument();
  });

  it('esconde o botão "Catálogo do Sistema"', async () => {
    mockFetch([{ id: 2, codigo: 'MNH', nome: 'Minha', descricao: 'desc', tipo: 'number', periodo: 'daily', is_default: false }], []);
    render(<MetricList />);
    await screen.findByText('Minha');
    expect(screen.queryByText(/catálogo do sistema/i)).not.toBeInTheDocument();
  });

  it('exibe a seção "Minhas Métricas"', async () => {
    mockFetch([{ id: 2, codigo: 'MNH', nome: 'Minha', descricao: 'desc', tipo: 'number', periodo: 'daily', is_default: false }], []);
    render(<MetricList />);
    expect(await screen.findByText(/minhas métricas/i)).toBeInTheDocument();
  });
});

describe('MetricForm — campo is_default', () => {
  it('exibe checkbox de métrica padrão', () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => [],
    });
    render(<MetricForm />);
    expect(screen.getByRole('checkbox', { name: /padrão/i })).toBeInTheDocument();
  });

  it('checkbox começa desmarcado para nova métrica', () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => [],
    });
    render(<MetricForm />);
    const checkbox = screen.getByRole('checkbox', { name: /padrão/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });
});

describe('MetricList — layout mobile (#215)', () => {
  it('reserva espaço no topo p/ o navbar flutuante não sobrepor o conteúdo', () => {
    mockFetch([]);
    const { container } = render(<MetricList />);
    const root = container.firstChild as HTMLElement;
    // navbar é absolute/top-0; a tela precisa de padding-top suficiente no mobile
    expect(root.className).toMatch(/pt-24/);
  });
});
