import {
  CATALOGOS,
  LOCALES,
  localeDeAcceptLanguage,
  getStoredLocale,
  getInitialLocale,
  applyLocale,
  setLocale,
  t,
  traduzir,
  type Locale,
} from '@/lib/i18n';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('lang');
});

test('getInitialLocale: sem escolha salva → en (padrão do app)', () => {
  expect(getInitialLocale()).toBe('en');
});

test('getStoredLocale: retorna o salvo ou null', () => {
  expect(getStoredLocale()).toBeNull();
  localStorage.setItem('locale', 'pt-BR');
  expect(getStoredLocale()).toBe('pt-BR');
  localStorage.setItem('locale', 'klingon');
  expect(getStoredLocale()).toBeNull();
});

test('getInitialLocale: escolha salva vence o padrão', () => {
  localStorage.setItem('locale', 'pt-BR');
  expect(getInitialLocale()).toBe('pt-BR');
});

test('applyLocale reflete no <html lang>', () => {
  applyLocale('pt-BR');
  expect(document.documentElement.getAttribute('lang')).toBe('pt-BR');
});

test('setLocale persiste e aplica no <html>', () => {
  setLocale('pt-BR');
  expect(localStorage.getItem('locale')).toBe('pt-BR');
  expect(document.documentElement.getAttribute('lang')).toBe('pt-BR');
});

test('t traduz no locale ativo, com en como padrão', () => {
  expect(t('comum.save')).toBe('Save');
  setLocale('pt-BR');
  expect(t('comum.save')).toBe('Salvar');
});

test('t aceita locale explícito, ignorando o ativo', () => {
  setLocale('pt-BR');
  expect(t('comum.cancel', 'en')).toBe('Cancel');
});

// A resolução é testada com catálogos de fixture: os catálogos reais são (e devem
// continuar) completos, então não dá pra exercitar o fallback com eles.
const FIXTURE = {
  en: { comum: { save: 'Save', onlyEn: 'Only in English' } },
  'pt-BR': { comum: { save: 'Salvar' } },
} as unknown as Record<Locale, Record<string, Record<string, string>>>;

test('traduzir: chave faltando no locale cai no catálogo en', () => {
  expect(traduzir(FIXTURE, 'comum.onlyEn', 'pt-BR')).toBe('Only in English');
});

test('traduzir: chave inexistente devolve a própria chave (nunca undefined na tela)', () => {
  expect(traduzir(FIXTURE, 'comum.naoExiste', 'pt-BR')).toBe('comum.naoExiste');
  expect(traduzir(FIXTURE, 'areaInexistente.x', 'en')).toBe('areaInexistente.x');
});

test('traduzir: chave malformada devolve a própria chave', () => {
  expect(traduzir(FIXTURE, 'semPonto', 'en')).toBe('semPonto');
});

test('catálogos en e pt-BR têm exatamente as mesmas chaves', () => {
  // Guarda contra tradução esquecida: cada área acrescenta chaves nos dois lados.
  const chaves = (cat: Record<string, Record<string, string>>) =>
    Object.entries(cat)
      .flatMap(([area, strings]) => Object.keys(strings).map((k) => `${area}.${k}`))
      .sort();
  expect(chaves(CATALOGOS['pt-BR'])).toEqual(chaves(CATALOGOS.en));
});

// --- Interpolação (#289) ---------------------------------------------------
// Existe para não montar frase por concatenação: "Imported: " + n + " created"
// amarra a ordem das palavras de um idioma só.

const FIX_VARS = {
  en: {
    a: {
      msg: 'Imported: {criadas} created, {ignoradas} skipped.',
      rep: '{n} de {n}',
      falta: 'Olá {faltando}',
      literal: 'literal {chave}',
    },
  },
  'pt-BR': { a: {} },
} as unknown as Record<Locale, Record<string, Record<string, string>>>;

test('traduzir interpola {nome} com os valores passados', () => {
  expect(traduzir(FIX_VARS, 'a.msg', 'en', { criadas: 3, ignoradas: 1 }))
    .toBe('Imported: 3 created, 1 skipped.');
});

test('traduzir interpola o mesmo placeholder mais de uma vez', () => {
  expect(traduzir(FIX_VARS, 'a.rep', 'en', { n: 7 })).toBe('7 de 7');
});

test('placeholder sem valor fica visível (bug reportável, não silencioso)', () => {
  expect(traduzir(FIX_VARS, 'a.falta', 'en', { outro: 1 })).toBe('Olá {faltando}');
});

test('sem vars, chaves no texto não são tocadas', () => {
  expect(traduzir(FIX_VARS, 'a.literal', 'en')).toBe('literal {chave}');
});

test('os locales do front são exatamente os que o backend entende', () => {
  // Contrato entre as duas pontas: o `Accept-Language` que o apiFetch manda é
  // este valor cru. O parser do backend (messages.locale_de_accept_language)
  // aceita "en", "pt" e "pt-*". Trocar isto para, digamos, "pt_BR" com
  // underscore faria o backend cair no padrão sem nenhum erro visível.
  expect(LOCALES).toEqual(['en', 'pt-BR']);
});

// --- Accept-Language no servidor (#314) -------------------------------------

describe('localeDeAcceptLanguage', () => {
  it.each([
    [null, 'en'],
    ['', 'en'],
    ['en-US,en;q=0.9', 'en'],
    ['pt-BR', 'pt-BR'],
    ['pt', 'pt-BR'],
    ['pt-PT', 'pt-BR'],
    ['en;q=0.5,pt-BR;q=0.9', 'pt-BR'],
    ['pt-BR;q=0.3,en;q=0.8', 'en'],
    ['pt-BR,en', 'pt-BR'],
    ['de-DE,fr;q=0.9,pt-BR;q=0.1', 'pt-BR'],
    ['de-DE,fr', 'en'],
    ['???', 'en'],
    ['pt-BR;q=abc', 'pt-BR'],
  ])('%s → %s', (header, esperado) => {
    expect(localeDeAcceptLanguage(header)).toBe(esperado);
  });
});
