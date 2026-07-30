import { API_BASE } from "./api";
import { t } from "./i18n";
export interface Notification {
  id: number;
  mensagem: string;
  lida: boolean;
  created_at: string;
}

const DEFAULT_API_BASE = API_BASE + "";

/** Conta quantas notificações ainda não foram lidas. */
export function unreadCount(list: Notification[]): number {
  return list.filter((n) => !n.lida).length;
}

/** Busca as notificações do usuário autenticado. */
export async function fetchNotifications(
  token: string,
  apiBase: string = DEFAULT_API_BASE,
): Promise<Notification[]> {
  const res = await fetch(`${apiBase}/api/v1/notifications/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(t("notifications.loadFailed"));
  return res.json();
}

/** Marca uma notificação como lida. */
export async function markNotificationRead(
  id: number,
  token: string,
  apiBase: string = DEFAULT_API_BASE,
): Promise<Notification> {
  const res = await fetch(`${apiBase}/api/v1/notifications/${id}/read/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(t("notifications.markFailed"));
  return res.json();
}
