// Catálogo dos componentes globais montados no layout raiz: consentimento de
// cookies, selo de versão, botão do WhatsApp e alternador de tema.
export const layout = {
  cookieMessage:
    "We use cookies to keep you signed in and improve your experience. By continuing, you agree to the use of cookies.",
  cookieAccept: "Accept",
  appVersion: "App version",
  whatsappContact: "Contact us on WhatsApp",
  switchToLightTheme: "Switch to light theme",
  switchToDarkTheme: "Switch to dark theme",
  toggleTheme: "Toggle theme",

  // metadata da página (#314). Resolvido no SERVIDOR, a partir do
  // Accept-Language — não há localStorage lá.
  metaDescription: "Track your objectives and performance.",
};
