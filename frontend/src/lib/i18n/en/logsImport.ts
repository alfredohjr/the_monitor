// Catálogo da importação de lançamentos por CSV.
//
// ATENÇÃO: `data,valor` NÃO se traduz. O backend compara o cabeçalho literalmente
// (`import_csv.py`: `[p.lower() for p in partes[:2]] == ["data", "valor"]`), então
// dizer "date,value" ao usuário faria o arquivo ser rejeitado linha por linha.
// É token de protocolo, não texto de interface.
export const logsImport = {
  backToLogs: "← Back to Entries",
  title: "Import entries (CSV)",
  subtitle:
    "Paste the data in the data,valor format (one line per day). Each value matches the goal of the same day.",
  csvLabel: "CSV",
  imported:
    "Imported: {criadas} created, {ignoradas} already existing, {sem_meta} with no goal for the day.",

  // Rótulos de resumo. O número vem num <strong> ao lado, então aqui é par
  // rótulo:valor, não frase com número no meio — pode ficar separado.
  summaryValid: "Valid:",
  summaryExisting: "Already existing:",
  summaryNoGoal: "No goal for the day:",
  summaryErrors: "Errors:",

  colLine: "Line",
  colReason: "Reason",
  confirmImport: "Confirm import",
  importFailed: "Could not import",
};
