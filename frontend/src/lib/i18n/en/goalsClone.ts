// Catálogo da clonagem de metas. Compartilha com `goalsImport` o que é do fluxo
// comum das três telas de importação (voltar, métrica, calcular, pré-visualizar).
export const goalsClone = {
  title: "Clone goals",
  subtitle:
    "Replicates the daily goals of a previous period into a new one, shifting the dates and (optionally) scaling the target.",
  sourceStart: "Source — start",
  sourceEnd: "Source — end",
  targetStart: "Destination — start",
  scaleLabel: "Target scale (1 = same)",
  scalePlaceholder: "e.g. 1.1 = +10%",
  cloned:
    "Cloned: {criadas} goal(s) created, {ignoradas} already existing. Sum: {soma}.",

  // Frases inteiras: no original o número vinha dentro de um <strong> no meio da
  // sentença, o que só funciona concatenando pedaços de JSX — e isso amarra a
  // ordem das palavras. A ênfase passou do número para o parágrafo.
  previewWillCreate: "{criadas} goal(s) will be created.",
  previewSkipped:
    "{ignoradas} already exist at the destination (they will be skipped). Sum of the new targets: {soma}.",

  confirmClone: "Confirm cloning",
  cloneFailed: "Could not clone",
};
