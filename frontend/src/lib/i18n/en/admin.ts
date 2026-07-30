// Catálogo da administração da organização.
export const admin = {
  // Tela de bloqueio para quem não é admin da org
  restrictedTitle: "Restricted access",
  restrictedText: "This area is exclusive to organization administrators.",
  goToLogs: "Go to Entries",

  title: "Administration",
  // Rótulo seguido do nome da org num <strong>. Fica separado porque é par
  // rótulo:valor com o valor no fim nos dois idiomas — não é frase partida.
  usersOf: "Users of",

  emailPlaceholder: "New member's e-mail",
  add: "Add",
  // Parágrafos longos ficam numa chave só. O original tinha <strong> no meio da
  // frase, e preservá-lo exigiria partir o texto em pedaços, o que amarra a
  // ordem das palavras (ver #288/#291).
  inviteHint:
    "If the e-mail already has an account, it is linked to this organization. If not, we create the account and the person signs in with Google using the same e-mail.",
  freePlanWarning:
    "Adding members requires a paid plan. Your organization is on the free plan (individual use). Talk to us to unlock more members.",

  colUser: "User",
  colEmail: "E-mail",
  colRole: "Role",

  // Papéis vindos da API são identificadores; mapeados aqui para exibição, com
  // fallback para o valor cru se aparecer um papel novo.
  roleAdmin: "admin",
  roleUser: "user",

  close: "Close",
  metrics: "Metrics",
  remove: "Remove",

  assignHint: "Select the metrics that {usuario} can view and log:",
  noMetrics: "No metric in this organization.",
  canEdit: "can edit",
  canDelete: "can delete",
  canEditAria: "Edit {codigo}",
  canDeleteAria: "Delete {codigo}",
  savingMetrics: "Saving…",
  saveMetrics: "Save metrics",

  saveMetricsFailed: "Could not save the metrics",
  metricsUpdated: "Assigned metrics updated.",
  addUserFailed: "Could not add the user",
  userAdded: "User added. They sign in with Google using this e-mail.",

  // Moeda da org (#308). Só o admin muda: define o significado dos valores
  // da organização inteira, não é preferência individual.
  currencyLabel: "Organization currency",
  currencySaved: "Currency saved.",
};
