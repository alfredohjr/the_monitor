import { render, screen } from '@testing-library/react';
import Home from '../app/page';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
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
    expect(screen.getByText(/Total Control of Your/i)).toBeInTheDocument();
  });

  it('renders navigation links to the main sections', () => {
    render(<Home />);
    expect(screen.getByText(/1\. Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Daily Check-in/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Create a Challenge/i)).toBeInTheDocument();
    expect(screen.getByText(/4\. Root Metric/i)).toBeInTheDocument();
  });

  // A versão saiu do rodapé da Home e virou global (VersionBadge no layout,
  // #221) — coberta por version-badge.test.tsx.

  it('nao redireciona quando nao ha token', () => {
    render(<Home />);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('nao exibe texto "sistema em construção"', () => {
    render(<Home />);
    // Cobre os dois idiomas: com a tela em inglês (#281) um matcher só em
    // português passaria a valer trivialmente e o texto poderia voltar sem alarme.
    expect(screen.queryByText(/sistema em construção|under construction/i)).not.toBeInTheDocument();
  });

  it('é theme-aware: base clara + dark preservado (#225)', () => {
    const { container } = render(<Home />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/bg-zinc-50/);        // claro
    expect(root.className).toMatch(/dark:bg-\[#0a0a0a\]/); // escuro atual preservado
  });

  it('nao exibe texto "alta performance"', () => {
    render(<Home />);
    expect(screen.queryByText(/alta performance|high performance/i)).not.toBeInTheDocument();
  });

  it('os cards de área têm fundo escuro no dark mode, não ficam brancos (#270)', () => {
    render(<Home />);
    // Cada card é o Link que envolve o título da seção. Sem uma classe de fundo
    // escura explícita, o `bg-white` da base vencia no dark e o card ficava branco
    // (o `dark:glass` é CSS puro, não gera variante Tailwind).
    const titulos = [/1\. Dashboard/i, /2\. Daily Check-in/i, /3\. Create a Challenge/i, /4\. Root Metric/i];
    for (const t of titulos) {
      const card = screen.getByText(t).closest('a') as HTMLElement;
      expect(card.className).toMatch(/bg-white/);            // base clara
      expect(card.className).toMatch(/dark:bg-white\/\[0\.03\]/); // fundo escuro no dark
    }
  });
});

describe('Home page — com token', () => {
  it('redireciona para /dashboard quando access_token existe', () => {
    localStorage.setItem('access_token', 'fake-token');
    render(<Home />);
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });
});

describe('Home page — idioma (#281)', () => {
  it('renderiza em pt-BR quando o locale está salvo', () => {
    localStorage.setItem('locale', 'pt-BR');
    render(<Home />);
    expect(screen.getByText(/O Controle Total do Seu/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Criar Desafio/i)).toBeInTheDocument();
  });
});
