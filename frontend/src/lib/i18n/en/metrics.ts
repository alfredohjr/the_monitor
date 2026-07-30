// Catálogo da área de métricas. O #287 acrescenta as chaves do formulário.
export const metrics = {
  title: "Metrics",
  subtitle: "Your base units in the system.",
  newMetric: "+ New Metric",
  myMetrics: "My Metrics",

  // Cabeçalhos da tabela
  colId: "ID",
  colCode: "Code",
  colDisplayName: "Display Name",
  colDescription: "Description",
  colType: "Type",
  colRoutine: "Routine",
  colDefaultValue: "Default Value",
  colOrigin: "Origin",
  colAction: "Action",

  // Selo da métrica semeada pelo sistema (is_default)
  systemBadge: "System",
  empty: "No metrics in this section.",

  // Confirmação de exclusão — o texto avisa do efeito colateral nas metas,
  // que é o que faz a ação não ser trivialmente reversível.
  deleteConfirm:
    "Are you sure you want to delete? This will remove the metric's view and its associated goals.",

  // --- FormulÃ¡rio (#287). Chaves prÃ³prias, com prefixo `form`, mesmo quando o
  // texto coincide com um cabeÃ§alho da tabela: rÃ³tulo de campo e cabeÃ§alho de
  // coluna podem divergir (um precisa caber, o outro precisa explicar).
  backToList: "← Back to List",
  formEditTitle: "Editing Metric",
  formNewTitle: "New Metric",
  formCode: "Code",
  formFriendlyName: "Friendly Name",
  formFriendlyNamePlaceholder: "e.g. Pages Read",
  formDescription: "Description",
  formDefaultValue: "Default Value",
  formType: "Type",
  typeNumber: "Whole Number",
  typeDecimal: "Decimal Number",
  // O "(R$)" fica correto enquanto a moeda for fixa. Quando o #309 tornar a
  // moeda um atributo da organizaÃ§Ã£o, este rÃ³tulo precisa acompanhar.
  typeCurrency: "Currency",
  typePercent: "Percentage (%)",
  typeString: "Text",
  typeBoolean: "Boolean",
  formFrequency: "Frequency",
  freqDaily: "Daily",
  freqWeekly: "Weekly",
  freqMonthly: "Monthly",
  freqYearly: "Yearly",
  isDefaultAria: "Default metric",
  isDefaultLabel: "Set as default metric",
  saving: "Saving…",
  updateMetric: "Update Metric",
  saveNewMetric: "Save New Metric",
  loadError: "Could not load the metric.",
  updateError: "Update failed.",
  createError: "Creation failed. The code may already exist.",
  updatedOk: "Metric updated!",
  createdOk: "Metric created successfully!",
  unknownError: "Unknown error",
};
