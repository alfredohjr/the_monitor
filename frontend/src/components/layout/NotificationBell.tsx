"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Notification,
  unreadCount,
  fetchNotifications,
  markNotificationRead,
} from "@/lib/notifications";

export default function NotificationBell() {
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (t: string) => {
    try {
      setItems(await fetchNotifications(t));
    } catch {
      // silencioso: a UI mostra estado vazio
    }
  }, []);

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    setToken(t);
    if (t) load(t);
  }, [load]);

  // Polling: reatualiza as notificações a cada 60s para o sino refletir
  // automaticamente novas notificações (ex.: meta atingida) — o badge de
  // não-lidas aparece sozinho, sem precisar abrir ou recarregar a página.
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => load(token), 60000);
    return () => clearInterval(id);
  }, [token, load]);

  const handleToggle = () => {
    // Ao abrir, recarrega para pegar notificações criadas depois da montagem
    // (ex.: meta atingida em outra tela) sem precisar recarregar a página.
    if (!open && token) load(token);
    setOpen((o) => !o);
  };

  const handleRead = async (id: number) => {
    if (!token) return;
    try {
      await markNotificationRead(id, token);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    } catch {
      // ignora falha pontual
    }
  };

  if (!token) return null;

  const naoLidas = unreadCount(items);

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="relative text-zinc-300 hover:text-white transition"
        aria-label="Notificações"
        title="Notificações"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {naoLidas > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div data-testid="notif-panel" className="absolute right-0 mt-3 w-72 max-h-96 overflow-y-auto bg-zinc-900 border border-white/15 rounded-2xl shadow-xl z-50 p-2">
          <p className="text-xs uppercase tracking-wider text-zinc-500 px-3 py-2">Notificações</p>
          {items.length === 0 ? (
            <p className="text-sm text-zinc-500 px-3 py-4 text-center">Nenhuma notificação.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleRead(n.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition hover:bg-white/5 ${n.lida ? "text-zinc-500" : "text-zinc-200 font-medium"}`}
              >
                <span className="flex items-center gap-2">
                  {!n.lida && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                  {n.mensagem}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
