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

describe('MetricList — métricas do sistema ocultas', () => {
  it('não renderiza métrica do sistema (is_default=true)', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => [{ id: 1, codigo: 'PAD', nome: 'MetricaSistema', descricao: 'desc', tipo: 'number', periodo: 'daily', is_default: true }],
    });
    render(<MetricList />);
    await screen.findByText(/minhas métricas/i);
    expect(screen.queryByText('MetricaSistema')).not.toBeInTheDocument();
    expect(screen.queryByTestId('badge-padrao')).not.toBeInTheDocument();
  });

  it('não exibe a seção "Métricas do Sistema" mesmo havendo is_default=true', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => [{ id: 1, codigo: 'PAD', nome: 'Padrão', descricao: 'desc', tipo: 'number', periodo: 'daily', is_default: true }],
    });
    render(<MetricList />);
    await screen.findByText(/minhas métricas/i);
    expect(screen.queryByText(/métricas do sistema/i)).not.toBeInTheDocument();
  });

  it('renderiza métrica própria (is_default=false) com botões Editar e Apagar', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => [{ id: 2, codigo: 'MNH', nome: 'Minha', descricao: 'desc', tipo: 'number', periodo: 'daily', is_default: false }],
    });
    render(<MetricList />);
    await screen.findByText('Minha');
    expect(screen.getByText('Editar')).toBeInTheDocument();
    expect(screen.getByText('Apagar')).toBeInTheDocument();
  });

  it('exibe a seção "Minhas Métricas"', async () => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => [{ id: 2, codigo: 'MNH', nome: 'Minha', descricao: 'desc', tipo: 'number', periodo: 'daily', is_default: false }],
    });
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
