import { render, screen } from '@testing-library/react';
import LoginPage from '../app/login/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('Login page layout', () => {
  it('reserves top space so the card does not overlap the fixed navbar', () => {
    const { container } = render(<LoginPage />);
    const root = container.firstChild as HTMLElement;
    // O Navbar é absoluto/flutuante no topo; a página precisa de padding-top
    // suficiente para o card centralizado nunca colidir com o menu.
    expect(root.className).toMatch(/pt-28/);
  });
});

afterEach(() => {
  localStorage.clear();
});

describe('Login — idioma (#282)', () => {
  it('renderiza em inglês por padrão', () => {
    render(<LoginPage />);
    expect(screen.getByText('Restricted Access')).toBeInTheDocument();
    expect(screen.getByText('Sign in to the system')).toBeInTheDocument();
  });

  it('renderiza em pt-BR quando o locale está salvo', () => {
    localStorage.setItem('locale', 'pt-BR');
    render(<LoginPage />);
    expect(screen.getByText('Acesso Restrito')).toBeInTheDocument();
    expect(screen.getByText('Entrar no Sistema')).toBeInTheDocument();
  });
});
