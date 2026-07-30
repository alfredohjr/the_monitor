// Catálogo do painel de evolução.
export const dashboard = {
  loading: "Syncing statistics with the database…",
  title: "Progress Dashboard",
  subtitle: "Follow your real data, entry volume and progress cadence.",

  // KPIs (só aparecem quando a métrica selecionada tem meta)
  kpiGoal: "Period Goal",
  kpiAchieved: "Achieved",
  kpiPercent: "% Achieved",

  allMetrics: "All Metrics",
  checkinToday: "+ Check-in Today",

  // Título do gráfico — muda com o que está selecionado
  chartFrequency: "Check-in Frequency (Overall History)",
  chartAchievedVsGoal: "Achieved vs. Goal by Period",
  chartValueEvolution: "Value Evolution",

  // Nomes das séries do gráfico. Aparecem na legenda e no tooltip do Recharts,
  // então são interface, não identificadores de dado.
  seriesGoal: "Goal",
  seriesEntries: "Entries",
  seriesAchieved: "Achieved",

  empty: "No entry made, or none matching this filter.",
};
