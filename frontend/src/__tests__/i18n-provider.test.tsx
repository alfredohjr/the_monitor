import { render, screen, act } from '@testing-library/react';
import { I18nProvider, useLocale } from '@/lib/i18n/I18nProvider';
import { useT } from '@/lib/i18n/useT';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('lang');
});

function Consumidor() {
  const { locale } = useLocale();
  const { t } = useT();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="texto">{t('comum.save')}</span>
    </div>
  );
}

function Trocador() {
  const { setLocale } = useLocale();
  return <button onClick={() => setLocale('pt-BR')}>trocar</button>;
}

test('provider entrega o locale padrão (en) aos filhos', () => {
  render(
    <I18nProvider>
      <Consumidor />
    </I18nProvider>,
  );
  expect(screen.getByTestId('locale')).toHaveTextContent('en');
  expect(screen.getByTestId('texto')).toHaveTextContent('Save');
});

test('provider respeita o locale salvo', () => {
  localStorage.setItem('locale', 'pt-BR');
  render(
    <I18nProvider>
      <Consumidor />
    </I18nProvider>,
  );
  expect(screen.getByTestId('locale')).toHaveTextContent('pt-BR');
  expect(screen.getByTestId('texto')).toHaveTextContent('Salvar');
});

test('trocar o locale re-renderiza os consumidores JÁ montados', () => {
  // É o que o #277 não conseguia: sem context, só componentes montados depois
  // da troca viam o idioma novo.
  render(
    <I18nProvider>
      <Consumidor />
      <Trocador />
    </I18nProvider>,
  );
  expect(screen.getByTestId('texto')).toHaveTextContent('Save');

  act(() => {
    screen.getByText('trocar').click();
  });

  expect(screen.getByTestId('locale')).toHaveTextContent('pt-BR');
  expect(screen.getByTestId('texto')).toHaveTextContent('Salvar');
});

test('trocar o locale persiste e reflete no <html lang>', () => {
  render(
    <I18nProvider>
      <Trocador />
    </I18nProvider>,
  );

  act(() => {
    screen.getByText('trocar').click();
  });

  expect(localStorage.getItem('locale')).toBe('pt-BR');
  expect(document.documentElement.getAttribute('lang')).toBe('pt-BR');
});

test('provider aplica o <html lang> na montagem', () => {
  localStorage.setItem('locale', 'pt-BR');
  render(
    <I18nProvider>
      <Consumidor />
    </I18nProvider>,
  );
  expect(document.documentElement.getAttribute('lang')).toBe('pt-BR');
});

test('useT fora do provider continua funcionando (compatibilidade)', () => {
  // Nem toda tela está sob o provider durante a migração das 19 issues de tela;
  // quebrar isso quebraria as telas ainda não migradas.
  localStorage.setItem('locale', 'pt-BR');
  function Solto() {
    const { t } = useT();
    return <span data-testid="solto">{t('comum.cancel')}</span>;
  }
  render(<Solto />);
  expect(screen.getByTestId('solto')).toHaveTextContent('Cancelar');
});
