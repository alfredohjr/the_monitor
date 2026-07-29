import { renderHook, act } from '@testing-library/react';
import { I18nProvider, useLocaleTolerante } from '@/lib/i18n/I18nProvider';
import { useT } from '@/lib/i18n/useT';

beforeEach(() => {
  localStorage.clear();
});

test('useT: sem escolha salva traduz em en', () => {
  const { result } = renderHook(() => useT());
  expect(result.current.locale).toBe('en');
  expect(result.current.t('comum.save')).toBe('Save');
});

test('useT: respeita o locale salvo', () => {
  localStorage.setItem('locale', 'pt-BR');
  const { result } = renderHook(() => useT());
  expect(result.current.locale).toBe('pt-BR');
  expect(result.current.t('comum.save')).toBe('Salvar');
});

test('useT: chave inexistente devolve a própria chave', () => {
  const { result } = renderHook(() => useT());
  expect(result.current.t('comum.naoExiste')).toBe('comum.naoExiste');
});

test('useT: `t` é estável entre renders com o mesmo locale', () => {
  // Um `t` novo a cada render entra em dep array de useEffect/useCallback e faz
  // o efeito reexecutar sempre — na tela de login isso injetava um <script> do
  // Google por render (#282).
  const { result, rerender } = renderHook(() => useT());
  const primeiro = result.current.t;
  rerender();
  expect(result.current.t).toBe(primeiro);
});

test('useT: `t` muda quando o locale realmente muda', () => {
  const { result } = renderHook(
    () => ({ ...useT(), ctx: useLocaleTolerante() }),
    { wrapper: I18nProvider },
  );
  const emIngles = result.current.t;
  expect(emIngles('comum.save')).toBe('Save');

  act(() => {
    result.current.ctx.setLocale('pt-BR');
  });

  expect(result.current.t).not.toBe(emIngles);
  expect(result.current.t('comum.save')).toBe('Salvar');
});
