// Catálogo do Navbar. Nasceu no #279 com o seletor de idioma; o #280 trouxe o
// resto da barra. "themonitor" é marca e não se traduz.
export const navbar = {
  switchToPortuguese: "Switch to Portuguese",
  switchToEnglish: "Switch to English",
  home: "Home",
  dashboard: "Dashboard",
  simulation: "Simulation",
  logs: "Entries",
  goals: "Goals",
  metrics: "Metrics",
  import: "Import",
  admin: "Admin",
  myProfile: "My profile",
  // Saudação montada como duas chaves em vez de um "Hi, {name}": o `t()` não
  // interpola, e adicionar interpolação por causa de uma string seria escopo
  // que não é desta issue.
  greeting: "Hi",
  defaultUser: "user",
  organization: "Organization",
  logout: "Sign out",
  login: "Sign in",
  openMenu: "Open menu",
  closeMenu: "Close menu",
};
