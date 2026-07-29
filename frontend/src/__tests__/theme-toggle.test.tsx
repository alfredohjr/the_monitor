import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '@/components/layout/ThemeToggle';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

test('inicia no escuro (default) e aplica no <html>', () => {
  render(<ThemeToggle />);
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
});

test('alterna para claro ao clicar, persistindo', () => {
  render(<ThemeToggle />);
  fireEvent.click(screen.getByRole('button', { name: /switch to light theme/i }));
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  expect(localStorage.getItem('theme')).toBe('light');
  // agora o rótulo vira "ativar tema escuro"
  expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument();
});

test('respeita a escolha salva (light) na montagem', () => {
  localStorage.setItem('theme', 'light');
  render(<ThemeToggle />);
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
});
