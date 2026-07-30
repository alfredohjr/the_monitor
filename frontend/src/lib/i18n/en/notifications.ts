// Catálogo das notificações: a página cheia e o sino do Navbar.
//
// O TEXTO de cada notificação (`n.mensagem`) vem do backend e continua em
// português — é o #306. Aqui só o chrome da tela é traduzido.
export const notifications = {
  title: "Notifications",
  subtitle: "Your complete notification history.",
  loading: "Loading…",
  empty: "No notification.",
  markAsRead: "Mark as read: {mensagem}",

  // Sino no Navbar
  bellLabel: "Notifications",
  seeAll: "See all →",

  // Erros de lib/notifications.ts — sobem como Error e podem chegar à tela.
  loadFailed: "Failed to load notifications",
  markFailed: "Failed to mark as read",
};
