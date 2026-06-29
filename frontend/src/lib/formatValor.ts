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
  switch (tipo) {
    case 'currency': return 'Ex: 500.00 (R$)';
    case 'percent':  return 'Ex: 75 (%)';
    default:         return 'Ex: 5.5, TRUE, 500';
  }
}
