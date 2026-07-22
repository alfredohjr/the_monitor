import { render, screen } from '@testing-library/react';
import Home from '../app/page';

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

afterEach(() => {
  localStorage.clear();
  mockPush.mockClear();
});

describe('Home page — sem token', () => {
  it('renders the main heading', () => {
    render(<Home />);
    expect(screen.getByText(/O Controle Total do Seu/i)).toBeInTheDocument();
  });

  it('renders navigation links to the main sections', () => {
    render(<Home />);
    expect(screen.getByText(/1\. Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Check-in/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Criar Desafio/i)).toBeInTheDocument();
    expect(screen.getByText(/4\. Métrica Raiz/i)).toBeInTheDocument();
  });

  // A versão saiu do rodapé da Home e virou global (VersionBadge no layout,
  // #221) — coberta por version-badge.test.tsx.

  it('nao redireciona quando nao ha token', () => {
    render(<Home />);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('nao exibe texto "sistema em construção"', () => {
    render(<Home />);
    expect(screen.queryByText(/sistema em construção/i)).not.toBeInTheDocument();
  });

  it('nao exibe texto "alta performance"', () => {
    render(<Home />);
    expect(screen.queryByText(/alta performance/i)).not.toBeInTheDocument();
  });
});

describe('Home page — com token', () => {
  it('redireciona para /dashboard quando access_token existe', () => {
    localStorage.setItem('access_token', 'fake-token');
    render(<Home />);
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });
});
