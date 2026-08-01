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

  // Instrução do iPhone (#324). Frase inteira, sem montar texto em volta do
  // ícone: o gesto tem que ficar claro mesmo para quem não enxerga o glifo.
  //
  // "Add to Home Screen" é o rótulo LITERAL do menu do iOS — quem lê precisa
  // achar exatamente esse item. O iOS traduz o próprio menu, então cada
  // catálogo cita o rótulo no seu idioma.
  iosInstallMessage:
    "To install themonitor on your iPhone, tap the Share button in Safari and choose “Add to Home Screen”.",

  // Ativação de push (#328). O botão diz o que acontece ao clicar, não o
  // estado atual — "Notifications on" ao lado de um botão é ambíguo: ligar ou
  // já está ligado?
  pushEnable: "Turn on push notifications",
  pushDisable: "Turn off push notifications",
  pushEnabled: "Push notifications are on for this device.",
  // "Bloqueado" não se desfaz por código: a pessoa precisa mexer nas
  // configurações do navegador, então o texto tem que dizer isso.
  pushDenied: "Notifications are blocked for this site. Allow them in your browser settings to turn this on.",
  pushUnsupported: "This browser does not support push notifications.",
  pushError: "Could not turn on notifications. Please try again.",
};
