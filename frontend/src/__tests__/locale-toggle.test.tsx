import { render, screen, act } from '@testing-library/react';
import LocaleToggle from '@/components/layout/LocaleToggle';
import { I18nProvider } from '@/lib/i18n/I18nProvider';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('lang');
});

function montar() {
  return render(
    <I18nProvider>
      <LocaleToggle />
    </I18nProvider>,
  );
}

test('sem escolha salva: oferece a troca para português', () => {
  montar();
  const botao = screen.getByRole('button');
  expect(botao).toHaveTextContent('PT');
  expect(botao).toHaveAttribute('aria-label', 'Switch to Portuguese');
});

test('clicar troca para pt-BR, persiste e reflete no <html lang>', () => {
  montar();

  act(() => {
    screen.getByRole('button').click();
  });

  expect(localStorage.getItem('locale')).toBe('pt-BR');
  expect(document.documentElement.getAttribute('lang')).toBe('pt-BR');
});

test('depois da troca, o botão passa a oferecer o inglês (em português)', () => {
  montar();

  act(() => {
    screen.getByRole('button').click();
  });

  const botao = screen.getByRole('button');
  expect(botao).toHaveTextContent('EN');
  expect(botao).toHaveAttribute('aria-label', 'Mudar para inglês');
});

test('respeita o locale salvo na montagem', () => {
  localStorage.setItem('locale', 'pt-BR');
  montar();
  expect(screen.getByRole('button')).toHaveTextContent('EN');
});

test('funciona fora do provider (telas ainda não migradas)', () => {
  // O Navbar é renderizado solto em navbar.test.tsx e org-switch.test.tsx, e
  // durante a migração das 19 telas isso vai se repetir. Explodir nesse caso
  // quebraria quem ainda não foi convertido.
  render(<LocaleToggle />);
  const botao = screen.getByRole('button');
  expect(botao).toHaveTextContent('PT');

  act(() => {
    botao.click();
  });

  expect(localStorage.getItem('locale')).toBe('pt-BR');
  expect(document.documentElement.getAttribute('lang')).toBe('pt-BR');
  expect(screen.getByRole('button')).toHaveTextContent('EN');
});

test('alterna de volta para o inglês', () => {
  localStorage.setItem('locale', 'pt-BR');
  montar();

  act(() => {
    screen.getByRole('button').click();
  });

  expect(localStorage.getItem('locale')).toBe('en');
  expect(screen.getByRole('button')).toHaveTextContent('PT');
});
