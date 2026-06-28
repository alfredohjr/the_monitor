import { render, screen } from '@testing-library/react';
import Navbar from '@/components/layout/Navbar';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/',
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

beforeEach(() => {
  (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] } as Response);
});

afterEach(() => {
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
});

describe('Navbar — sem login', () => {
  it('mostra o link Entrar', () => {
    render(<Navbar />);
    expect(screen.getByText('Entrar')).toBeInTheDocument();
  });

  it('mostra o link Início', () => {
    render(<Navbar />);
    expect(screen.getByText('Início')).toBeInTheDocument();
  });

  it('oculta o link Dashboard', () => {
    render(<Navbar />);
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('oculta o link Simulação', () => {
    render(<Navbar />);
    expect(screen.queryByText('Simulação')).not.toBeInTheDocument();
  });

  it('oculta o link Lançamentos', () => {
    render(<Navbar />);
    expect(screen.queryByText('Lançamentos')).not.toBeInTheDocument();
  });

  it('oculta o link Metas', () => {
    render(<Navbar />);
    expect(screen.queryByText('Metas')).not.toBeInTheDocument();
  });

  it('oculta o link Métricas', () => {
    render(<Navbar />);
    expect(screen.queryByText('Métricas')).not.toBeInTheDocument();
  });

  it('nao mostra o botao Sair', () => {
    render(<Navbar />);
    expect(screen.queryByText('Sair')).not.toBeInTheDocument();
  });
});

describe('Navbar — com login', () => {
  beforeEach(() => {
    localStorage.setItem('access_token', 'tok');
  });

  it('mostra o link Dashboard', () => {
    render(<Navbar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('mostra o link Simulação', () => {
    render(<Navbar />);
    expect(screen.getByText('Simulação')).toBeInTheDocument();
  });

  it('mostra o link Lançamentos', () => {
    render(<Navbar />);
    expect(screen.getByText('Lançamentos')).toBeInTheDocument();
  });

  it('mostra o link Metas', () => {
    render(<Navbar />);
    expect(screen.getByText('Metas')).toBeInTheDocument();
  });

  it('mostra o link Métricas', () => {
    render(<Navbar />);
    expect(screen.getByText('Métricas')).toBeInTheDocument();
  });

  it('mostra o botao Sair e nao mostra Entrar', () => {
    render(<Navbar />);
    expect(screen.getByText('Sair')).toBeInTheDocument();
    expect(screen.queryByText('Entrar')).not.toBeInTheDocument();
  });
});
