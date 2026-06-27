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

describe('Navbar auth state (fix login Google)', () => {
  beforeEach(() => {
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] } as Response);
  });

  afterEach(() => {
    localStorage.clear();
    delete (global as { fetch?: unknown }).fetch;
  });

  it('trata como logado quando ha access_token mesmo sem username salvo', () => {
    localStorage.setItem('access_token', 'tok'); // caso do login Google: sem username
    render(<Navbar />);
    expect(screen.getByText('Sair')).toBeInTheDocument();
    expect(screen.queryByText('Entrar')).not.toBeInTheDocument();
  });

  it('mostra o link Entrar quando nao ha token', () => {
    render(<Navbar />);
    expect(screen.getByText('Entrar')).toBeInTheDocument();
    expect(screen.queryByText('Sair')).not.toBeInTheDocument();
  });
});
