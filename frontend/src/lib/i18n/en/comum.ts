// Strings genuinamente compartilhadas entre telas. Texto que só uma área usa
// mora no catálogo daquela área (en/metrics.ts, en/goals.ts, ...), não aqui —
// "comum" que vira depósito geral recria o arquivo único que a estrutura por
// área existe para evitar.
export const comum = {
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  close: "Close",
  back: "Back",
  loading: "Loading…",
  confirm: "Confirm",
  yes: "Yes",
  no: "No",
  search: "Search",
  genericError: "Unexpected error",
  requiredField: "Required field",
  // Placeholders do campo de valor, compartilhados por GoalForm e LogForm
  // (via `placeholderValor`). O "(R$)" acompanha o #309.
  placeholderCurrency: "e.g. 500.00 (R$)",
  placeholderPercent: "e.g. 75 (%)",
  placeholderGeneric: "e.g. 5.5, TRUE, 500",
  // Erros genéricos da camada de API (`mensagemDeErro`). O `detail` das rotas
  // vem traduzido do backend (#300-#302); estes cobrem o 422 do pydantic e o
  // fallback quando não há detail utilizável.
  unexpectedError: "Unexpected error",
  invalidEmail: "Invalid e-mail.",
  checkFormData: "Check the form data.",
};
