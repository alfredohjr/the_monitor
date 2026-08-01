// Catálogo do app instalável (#319). Serve o manifest e as telas seguintes da
// série de PWA (convite de instalação, tela offline).
export const pwa = {
  // Nome completo: aparece na tela de instalação e na lista de apps.
  name: "themonitor — goal tracking",
  // Curto: vai embaixo do ícone na tela inicial. O Android trunca acima de ~12
  // caracteres, então este NÃO pode crescer.
  shortName: "themonitor",
  description: "Track your metrics and goals, and follow daily progress.",

  // Tela de sem conexão (#322). Sem jargão: quem lê isto já está frustrado, e
  // "verifique sua conexão" não diz o que fazer que a pessoa já não tenha feito.
  offlineTitle: "You're offline",
  offlineMessage:
    "themonitor needs a connection to load your data. Reconnect and try again — nothing you entered was lost.",
  offlineRetry: "Try again",

  // Convite de instalação (#323). Diz o benefício, não o mecanismo — "adicionar
  // à tela inicial" descreve o clique; "abrir direto" descreve o ganho.
  installMessage: "Install themonitor to open it straight from your home screen, even offline.",
  installAction: "Install",
  installDismiss: "Not now",
};
