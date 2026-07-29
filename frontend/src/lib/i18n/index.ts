// Base do i18n (#277). Mesma forma que `lib/theme.ts` já usa para uma preferência
// persistida: lê do localStorage → cai num default → aplica no <html>.
//
// Este módulo é PURO (sem React) de propósito: ele é importado por componentes de
// servidor e por libs, e marcar tudo como "use client" por causa de um hook
// arrastaria meia árvore para o cliente. O hook vive em `useT.ts`.

import { en } from "./en";
import { ptBR } from "./pt-BR";

export type Locale = "en" | "pt-BR";

/** Idioma padrão do app. Decisão de produto de 2026-07-28: inglês. */
export const LOCALE_PADRAO: Locale = "en";
export const LOCALES: Locale[] = ["en", "pt-BR"];

const STORAGE_KEY = "locale";

/** Catálogo: área → chave → texto. */
export type Catalogo = Record<string, Record<string, string>>;

/** Valores para interpolar em `{nome}` dentro do texto traduzido. */
export type Vars = Record<string, string | number>;

export const CATALOGOS: Record<Locale, Catalogo> = {
  en,
  "pt-BR": ptBR,
};

export function isLocale(valor: unknown): valor is Locale {
  return typeof valor === "string" && (LOCALES as string[]).includes(valor);
}

/** Preferência salva pelo usuário, ou null se nunca escolheu (ou se salvaram lixo). */
export function getStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return isLocale(v) ? v : null;
}

/** Locale inicial: escolha salva vence; senão, o padrão do app. */
export function getInitialLocale(): Locale {
  return getStoredLocale() ?? LOCALE_PADRAO;
}

/** Aplica o locale no <html lang> — leitores de tela e SEO leem esse atributo. */
export function applyLocale(locale: Locale): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("lang", locale);
  }
}

/** Define e persiste o locale. */
export function setLocale(locale: Locale): void {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, locale);
  applyLocale(locale);
}

/**
 * Resolve uma chave "area.chave" num conjunto de catálogos.
 *
 * Recebe os catálogos por parâmetro para ser testável com fixtures: os catálogos
 * reais são completos, então não dá para exercitar o fallback com eles.
 *
 * Ordem: locale pedido → catálogo `en` → a própria chave. Nunca devolve
 * `undefined`, porque `undefined` numa tela vira buraco silencioso.
 */
export function traduzir(
  catalogos: Record<Locale, Catalogo>,
  chave: string,
  locale: Locale,
  vars?: Vars,
): string {
  const corte = chave.indexOf(".");
  if (corte <= 0 || corte === chave.length - 1) return chave;

  const area = chave.slice(0, corte);
  const nome = chave.slice(corte + 1);

  const texto =
    catalogos[locale]?.[area]?.[nome] ??
    catalogos[LOCALE_PADRAO]?.[area]?.[nome] ??
    chave;

  return vars ? interpolar(texto, vars) : texto;
}

/**
 * Substitui `{nome}` pelos valores passados.
 *
 * Existe para NÃO montar frase por concatenação de pedaços: `"Imported: " + n +
 * " goal(s) created"` amarra a ordem das palavras de um idioma só. Com a frase
 * inteira no catálogo, cada idioma decide onde o número entra.
 *
 * Placeholder sem valor correspondente fica visível de propósito: sumir da tela
 * é bug silencioso, `{criadas}` aparecendo é bug que alguém reporta.
 */
export function interpolar(texto: string, vars: Vars): string {
  return texto.replace(/\{(\w+)\}/g, (todo, nome: string) =>
    nome in vars ? String(vars[nome]) : todo,
  );
}

/**
 * Traduz uma chave no locale ativo. `locale` explícito ignora o ativo — útil no
 * servidor, onde não há localStorage, e em teste.
 */
export function t(chave: string, locale?: Locale, vars?: Vars): string {
  return traduzir(CATALOGOS, chave, locale ?? getInitialLocale(), vars);
}
