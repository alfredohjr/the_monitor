import { t } from "@/lib/i18n";
export function formatValor(value: string, tipo: string): string {
  if (!value) return value;
  switch (tipo) {
    case 'currency': {
      const num = parseFloat(value);
      if (isNaN(num)) return value;
      return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    case 'percent':
      return `${value}%`;
    default:
      return value;
  }
}

export function placeholderValor(tipo: string): string {
  // Usa o `t` puro (sem React): este helper é chamado de dentro do render de
  // GoalForm e LogForm, e o `t` sem locale explícito lê a preferência salva —
  // a mesma que o provider persiste ao trocar de idioma.
  switch (tipo) {
    case 'currency': return t('comum.placeholderCurrency');
    case 'percent':  return t('comum.placeholderPercent');
    default:         return t('comum.placeholderGeneric');
  }
}
