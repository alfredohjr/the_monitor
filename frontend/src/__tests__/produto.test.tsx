import { render, screen } from '@testing-library/react';
import ProdutoPage from '../app/produto/page';

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('Produto (sales page)', () => {
  it('renders the hero headline', () => {
    render(<ProdutoPage />);
    expect(screen.getByText(/Transforme Disciplina em/i)).toBeInTheDocument();
  });

  it('renders the main call-to-action linking to signup/login', () => {
    render(<ProdutoPage />);
    const ctas = screen.getAllByRole('link', { name: /Começar agora/i });
    expect(ctas.length).toBeGreaterThan(0);
    ctas.forEach((cta) => expect(cta).toHaveAttribute('href', '/login'));
  });

  it('renders the feature highlights', () => {
    render(<ProdutoPage />);
    expect(screen.getByText(/Métricas Raiz/i)).toBeInTheDocument();
    expect(screen.getByText(/Metas com Alvo/i)).toBeInTheDocument();
    expect(screen.getByText(/Check-in Diário/i)).toBeInTheDocument();
  });
});
