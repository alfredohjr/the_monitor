import { renderHook } from '@testing-library/react';
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
