// Espelho pt-BR de en/comum.ts. As chaves dos dois lados são conferidas por
// teste — acrescentar de um lado só quebra a suíte.
export const comum = {
  save: "Salvar",
  cancel: "Cancelar",
  delete: "Apagar",
  edit: "Editar",
  close: "Fechar",
  back: "Voltar",
  loading: "Carregando…",
  confirm: "Confirmar",
  yes: "Sim",
  no: "Não",
  search: "Buscar",
  genericError: "Erro inesperado",
  requiredField: "Campo obrigatório",
  // Placeholders do campo de valor, compartilhados por GoalForm e LogForm
  // (via `placeholderValor`). O símbolo vem da moeda da org (#309).
  placeholderCurrency: "Ex: 500.00 ({simbolo})",
  placeholderPercent: "Ex: 75 (%)",
  placeholderGeneric: "Ex: 5.5, TRUE, 500",
  // Erros genéricos da camada de API (`mensagemDeErro`). O `detail` das rotas
  // vem traduzido do backend (#300-#302); estes cobrem o 422 do pydantic e o
  // fallback quando não há detail utilizável.
  unexpectedError: "Erro inesperado",
  invalidEmail: "E-mail inválido.",
  checkFormData: "Confira os dados do formulário.",
};
