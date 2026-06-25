import { render, screen } from '@testing-library/react';
import Home from '../app/page';

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('Home page', () => {
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

  it('displays the app version', () => {
    render(<Home />);
    expect(screen.getByText(/v0\.1\.0/i)).toBeInTheDocument();
  });
});
