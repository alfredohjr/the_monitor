import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '@/components/layout/ThemeToggle';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  (window as unknown as { matchMedia: unknown }).matchMedia = jest.fn().mockImplementation((q: string) => ({
    matches: false, media: q, addEventListener: jest.fn(), removeEventListener: jest.fn(),
  }));
});

test('inicia no escuro (default) e aplica no <html>', () => {
  render(<ThemeToggle />);
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(screen.getByRole('button', { name: /ativar tema claro/i })).toBeInTheDocument();
});

test('alterna para claro ao clicar, persistindo', () => {
  render(<ThemeToggle />);
  fireEvent.click(screen.getByRole('button', { name: /ativar tema claro/i }));
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  expect(localStorage.getItem('theme')).toBe('light');
  // agora o rótulo vira "ativar tema escuro"
  expect(screen.getByRole('button', { name: /ativar tema escuro/i })).toBeInTheDocument();
});

test('respeita a escolha salva (light) na montagem', () => {
  localStorage.setItem('theme', 'light');
  render(<ThemeToggle />);
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
});
