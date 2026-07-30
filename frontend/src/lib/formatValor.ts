import { getInitialLocale, t } from "@/lib/i18n";

// Moeda da organização ativa (#307/#308). Guardada no localStorage pelo mesmo
// motivo que a org ativa já é: `formatValor` é função pura, chamada de dentro do
// render de cinco telas, e passar a moeda por prop em todas espalharia a regra
// em vez de centralizá-la.
const MOEDA_KEY = "active_org_moeda";

// Conjunto fechado, espelhando MOEDAS_SUPORTADAS do backend. Código inválido faz
// o Intl.NumberFormat lançar RangeError — e o erro apareceria na tela de quem
// usa, não na de quem configurou.
const MOEDAS = ["BRL", "USD", "EUR"] as const;
export type Moeda = (typeof MOEDAS)[number];

export const MOEDA_PADRAO: Moeda = "BRL";

export function getMoedaAtiva(): Moeda {
  if (typeof window === "undefined") return MOEDA_PADRAO;
  const v = localStorage.getItem(MOEDA_KEY);
  return (MOEDAS as readonly string[]).includes(v ?? "") ? (v as Moeda) : MOEDA_PADRAO;
}

export function setMoedaAtiva(moeda: string): void {
  if (typeof window !== "undefined") localStorage.setItem(MOEDA_KEY, moeda);
}

export function clearMoedaAtiva(): void {
  if (typeof window !== "undefined") localStorage.removeItem(MOEDA_KEY);
}

/**
 * Formata um valor para exibição.
 *
 * O valor **não é convertido** — só a formatação muda. Não existe taxa de câmbio
 * no sistema, e trocar o símbolo convertendo por um número inventado seria
 * mentir sobre o dado. A moeda da organização é a moeda em que os valores dela
 * foram lançados.
 */
export function formatValor(value: string, tipo: string, moeda?: string): string {
  if (!value) return value;
  switch (tipo) {
    case 'currency': {
      const num = parseFloat(value);
      if (isNaN(num)) return value;
      const codigo = moeda && (MOEDAS as readonly string[]).includes(moeda)
        ? moeda
        : getMoedaAtiva();
      // `narrowSymbol` para sair "$" e não "US$". O símbolo é separado do número
      // para manter o espaço que a interface já usava ("R$ 1.234,50").
      const partes = new Intl.NumberFormat(getInitialLocale(), {
        style: "currency",
        currency: codigo,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).formatToParts(num);

      const simbolo = partes.find((p) => p.type === "currency")?.value ?? "";
      const numero = partes
        .filter((p) => p.type !== "currency" && p.type !== "literal")
        .map((p) => p.value)
        .join("");
      return `${simbolo} ${numero}`;
    }
    case 'percent':
      return `${value}%`;
    default:
      return value;
  }
}

/**
 * Formata uma data ISO para EXIBIÇÃO no locale ativo.
 *
 * Só exibição: o formato que vai no payload da API continua `YYYY-MM-DD`, que é
 * o que o backend valida. Trocar o formato enviado quebraria a gravação sem
 * nenhum sintoma visível no front.
 */
export function formatData(iso: string): string {
  if (!iso) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;   // "Invalid Date" na tela é pior que o valor cru
  return d.toLocaleDateString(getInitialLocale());
}

/** Formata um número para exibição no locale ativo (2 casas). */
export function formatNumero(val: number): string {
  const n = isNaN(val) || val === null || val === undefined ? 0 : Number(val);
  return n.toLocaleString(getInitialLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Símbolo da moeda ativa, para telas que montam o valor à mão. */
export function simboloMoeda(moeda?: string): string {
  const codigo = moeda && (MOEDAS as readonly string[]).includes(moeda) ? moeda : getMoedaAtiva();
  return (
    new Intl.NumberFormat(getInitialLocale(), {
      style: "currency",
      currency: codigo,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? ""
  );
}


export function placeholderValor(tipo: string): string {
  // Usa o `t` puro (sem React): este helper é chamado de dentro do render de
  // GoalForm e LogForm, e o `t` sem locale explícito lê a preferência salva —
  // a mesma que o provider persiste ao trocar de idioma.
  switch (tipo) {
    case 'currency': return t('comum.placeholderCurrency', undefined, { simbolo: simboloMoeda() });
    case 'percent':  return t('comum.placeholderPercent');
    default:         return t('comum.placeholderGeneric');
  }
}
