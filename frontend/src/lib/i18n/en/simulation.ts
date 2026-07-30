// Catálogo do simulador de metas (arrastar barras para projetar o futuro).
export const simulation = {
  badge: "AUTOMATIC GENERATOR",
  title: "Universal Simulator",
  subtitle: "Create goals for the future ahead of time, or readjust the past.",

  // Os rótulos numerados guiam a ordem de uso da tela — o número faz parte da
  // instrução, não é enfeite.
  step1Metric: "1. Metric to work on:",
  select: "Select…",
  step2Range: "2. Chart Range (Start and End)",

  saving: "Recording…",
  commit: "Apply Generation / Edit",
  lockHistorical: "Lock editing of current and/or past goals.",

  kpiBaseline: "Baseline (Default)",
  kpiProjection: "Drawn Projection",
  kpiSurplus: "Surplus Relative to Origin (%)",

  replicateTitle: "Replicates the last edited value to every bar to the right",
  replicate: "Replicate last value →",

  legendNew: "Brand-new Virtual Goal",
  legendOfficial: "Already Official Goal",
  loading: "Loading data…",

  // Selo curto na barra arrastada: precisa caber em ~3 caracteres.
  newBadge: "New",

  committed: "Simulation injected into the Physical Database.",
  commitFailed: "Error committing the simulation.",
};
