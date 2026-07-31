import { t } from "@/lib/i18n";

// Rótulos de exibição para `tipo` e `periodo` de uma métrica (#367).
//
// Estes campos chegam da API como identificadores ("number", "daily") e eram
// exibidos crus em duas telas: a tabela do MetricList e o selo do card no
// CatalogPage. O helper é compartilhado de propósito — traduzir só uma delas
// deixaria as duas mostrando o mesmo dado de formas diferentes, que foi
// justamente o motivo de o #298 adiar isto em vez de resolver pela metade.
//
// As chaves são as mesmas do <select> do formulário (#287). Elas foram escritas
// para `<option>`, onde há espaço; o selo do catálogo é mais apertado. Não
// consigo medir renderização em jsdom, então fica o registro: se "Decimal
// Number · Monthly" estourar o card, a correção é uma variante curta no
// catálogo, não apertar o layout nem voltar ao identificador cru.

const TIPOS: Record<string, string> = {
  number: "metrics.typeNumber",
  decimal: "metrics.typeDecimal",
  currency: "metrics.typeCurrency",
  percent: "metrics.typePercent",
  string: "metrics.typeString",
  boolean: "metrics.typeBoolean",
};

const PERIODOS: Record<string, string> = {
  daily: "metrics.freqDaily",
  weekly: "metrics.freqWeekly",
  monthly: "metrics.freqMonthly",
  yearly: "metrics.freqYearly",
};

/**
 * Valor desconhecido devolve o próprio identificador, nunca vazio.
 *
 * Mesmo padrão do papel do usuário no #296: se o backend ganhar um tipo novo, a
 * tela mostra "quantum" — feio, mas informativo e reportável. Célula vazia é
 * bug silencioso.
 */
function rotulo(mapa: Record<string, string>, valor: string): string {
  const chave = mapa[valor];
  return chave ? t(chave) : valor;
}

export const rotuloTipo = (tipo: string): string => rotulo(TIPOS, tipo);
export const rotuloPeriodo = (periodo: string): string => rotulo(PERIODOS, periodo);
