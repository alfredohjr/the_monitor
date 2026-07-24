import { render, screen, fireEvent } from '@testing-library/react';
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

describe('Navbar — menu mobile (#214)', () => {
  it('tem um botão hambúrguer para abrir o menu no mobile', () => {
    render(<Navbar />);
    expect(screen.getByRole('button', { name: /abrir menu/i })).toBeInTheDocument();
  });

  it('alterna aria-expanded ao clicar no hambúrguer', () => {
    render(<Navbar />);
    const botao = screen.getByRole('button', { name: /abrir menu/i });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(botao);
    // depois de abrir, o rótulo passa a "fechar menu" e aria-expanded vira true
    const aberto = screen.getByRole('button', { name: /fechar menu/i });
    expect(aberto).toHaveAttribute('aria-expanded', 'true');
  });

  it('o menu recolhível referencia o estado de aberto/fechado', () => {
    render(<Navbar />);
    const menu = screen.getByTestId('nav-menu');
    // fechado no mobile (classe hidden), sempre visível no desktop (sm:flex)
    expect(menu.className).toMatch(/hidden/);
    expect(menu.className).toMatch(/sm:flex/);
  });

  it('usa fundo sólido (estilo do painel de notificação) no mobile e glass no desktop (#219)', () => {
    render(<Navbar />);
    const container = screen.getByTestId('nav-container');
    // mobile: fundo sólido como o dropdown de notificação (no tema escuro)
    expect(container.className).toMatch(/dark:bg-zinc-900/);
    // desktop: mantém o efeito glass (translúcido + blur) no escuro
    expect(container.className).toMatch(/sm:dark:bg-white/);
    expect(container.className).toMatch(/sm:backdrop-blur/);
  });
});

describe('Navbar — tema (#225)', () => {
  it('monta o botão de alternância de tema (deslogado)', () => {
    render(<Navbar />);
    expect(screen.getByRole('button', { name: /tema (claro|escuro)/i })).toBeInTheDocument();
  });

  it('container é theme-aware (base clara + dark:)', () => {
    render(<Navbar />);
    const container = screen.getByTestId('nav-container');
    expect(container.className).toMatch(/bg-white/);       // base clara
    expect(container.className).toMatch(/dark:bg-zinc-900/); // escuro preservado
  });
});
