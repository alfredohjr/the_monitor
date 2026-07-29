// Catálogo das metas ancoradas em índice. As chaves compartilhadas com a
// importação normal (voltar, prévia, confirmar, datas, colunas) ficam em
// `goalsImport`: as duas telas são irmãs, com o mesmo fluxo prévia → confirmar,
// e divergir o texto delas seria inconsistência, não flexibilidade.
export const goalsAnchor = {
  title: "Goals anchored to an index",
  subtitle:
    "Corrects the target by a real index (e.g. IPCA) so it does not lose to inflation. Goals are stored resolved (a snapshot); you can re-anchor later.",
  indexLabel: "Index",
  selectIndex: "Select the index",
  baseTarget: "Base target",
  baseTargetPlaceholder: "e.g. 30000",
  correctedTarget: "Corrected target:",
};
