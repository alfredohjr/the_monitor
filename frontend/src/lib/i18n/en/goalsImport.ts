// Catálogo da importação de metas (distribui um alvo total numa curva).
export const goalsImport = {
  backToGoals: "← Back to Goals",
  title: "Import goals",
  subtitle: "Splits a total target into daily goals following a curve.",
  haveSpreadsheet: "Already have the history in a spreadsheet?",
  importCsvLink: "Import entries from CSV →",

  // Frase inteira com placeholders, não pedaços concatenados: cada idioma
  // decide onde os números entram.
  imported: "Imported: {criadas} goal(s) created, {ignoradas} already existing.",

  startFromTemplate: "Start from a template:",
  metricLabel: "Metric",
  selectMetric: "Select the metric",
  totalTarget: "Total target",
  totalTargetPlaceholder: "e.g. 1000",
  startDate: "Start",
  endDate: "End",
  curveLabel: "Distribution curve",

  // Estratégias de distribuição. O parêntese explica o efeito — sem ele,
  // "Business days" não diz que o fim de semana zera.
  curveLinear: "Linear (same every day)",
  curveRampUp: "Ramp up",
  curveRampDown: "Ramp down",
  curveWeekdays: "Business days (weekends zeroed)",
  curveSeasonalMonth: "Seasonal (weights the end of the month)",

  calculating: "Calculating…",
  preview: "Preview",
  previewTitle: "Preview — {dias} day(s)",
  sum: "Sum:",
  colDate: "Date",
  colTarget: "Target",
  saving: "Saving…",
  confirmImport: "Confirm import",
  importFailed: "Could not import",
  genericError: "Error",
};
