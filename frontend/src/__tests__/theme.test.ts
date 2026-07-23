import { getSystemTheme, getStoredTheme, getInitialTheme, applyTheme, setTheme, toggleTheme } from '@/lib/theme';

function mockMatchMedia(prefersLight: boolean) {
  (window as unknown as { matchMedia: unknown }).matchMedia = jest.fn().mockImplementation((q: string) => ({
    matches: q.includes('light') ? prefersLight : !prefersLight,
    media: q,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

test('getSystemTheme: SO claro → light', () => {
  mockMatchMedia(true);
  expect(getSystemTheme()).toBe('light');
});

test('getSystemTheme: SO escuro/indefinido → dark (default)', () => {
  mockMatchMedia(false);
  expect(getSystemTheme()).toBe('dark');
});

test('getSystemTheme: sem matchMedia → dark', () => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  expect(getSystemTheme()).toBe('dark');
});

test('getStoredTheme: retorna o salvo ou null', () => {
  expect(getStoredTheme()).toBeNull();
  localStorage.setItem('theme', 'light');
  expect(getStoredTheme()).toBe('light');
  localStorage.setItem('theme', 'lixo');
  expect(getStoredTheme()).toBeNull();
});

test('getInitialTheme: escolha salva vence o SO', () => {
  mockMatchMedia(true); // SO claro
  localStorage.setItem('theme', 'dark');
  expect(getInitialTheme()).toBe('dark');
});

test('getInitialTheme: sem escolha usa o SO (claro)', () => {
  mockMatchMedia(true);
  expect(getInitialTheme()).toBe('light');
});

test('getInitialTheme: sem escolha e SO escuro → dark', () => {
  mockMatchMedia(false);
  expect(getInitialTheme()).toBe('dark');
});

test('setTheme aplica no <html> e persiste', () => {
  setTheme('light');
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  expect(localStorage.getItem('theme')).toBe('light');
});

test('toggleTheme alterna a partir do aplicado', () => {
  applyTheme('dark');
  expect(toggleTheme()).toBe('light');
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  expect(toggleTheme()).toBe('dark');
});
