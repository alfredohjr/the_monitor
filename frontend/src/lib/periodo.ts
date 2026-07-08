// Agrupamento de datas por período de métrica.
//
// Cada Metric tem um `periodo` (daily/weekly/monthly/yearly) e cada Goal grava
// `periodo_referencia` no formato correspondente ao input usado no GoalForm:
//   daily   -> "YYYY-MM-DD"  (input date)
//   weekly  -> "YYYY-Www"    (input week, semana ISO)
//   monthly -> "YYYY-MM"     (input month)
//   yearly  -> "YYYY"        (input number)
// `bucketKey` converte a data de um lançamento (LogEntry.data, sempre
// "YYYY-MM-DD") para a mesma chave, permitindo casar meta e realizado.

// Semana ISO 8601 — mesma fórmula usada em SimulationDashboard, para que o
// bucket bata exatamente com o valor gravado pelo <input type="week">.
export function getWeekPattern(d: Date): string {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  return `${date.getFullYear()}-W${week.toString().padStart(2, "0")}`;
}

export function bucketKey(dateStr: string, periodo: string): string {
  if (!dateStr) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  switch (periodo) {
    case "weekly":
      return getWeekPattern(new Date(y, (m || 1) - 1, d || 1));
    case "monthly":
      return `${y}-${String(m || 1).padStart(2, "0")}`;
    case "yearly":
      return String(y);
    case "daily":
    default:
      return dateStr;
  }
}
