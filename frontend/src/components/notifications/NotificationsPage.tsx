"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Notification,
  fetchNotifications,
  markNotificationRead,
} from "@/lib/notifications";

export default function NotificationsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) return router.replace("/login");
    setToken(t);
    fetchNotifications(t)
      .then((d) => setItems(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const handleRead = async (id: number) => {
    if (!token) return;
    try {
      await markNotificationRead(id, token);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    } catch {
      // ignora falha pontual
    }
  };

  if (!token) return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <div className="flex flex-col min-h-screen items-center p-6 pt-28 bg-[#0a0a0a] text-white">
      <div className="relative z-10 w-full max-w-2xl glass p-6 sm:p-8 rounded-3xl border border-white/5">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Notificações</h1>
        <p className="text-zinc-400 text-sm mb-6">Seu histórico completo de notificações.</p>

        {loading ? (
          <p className="text-zinc-500 py-8 text-center">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-zinc-500 py-8 text-center">Nenhuma notificação.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => handleRead(n.id)}
                  disabled={n.lida}
                  aria-label={n.lida ? n.mensagem : `Marcar como lida: ${n.mensagem}`}
                  className={`w-full text-left px-4 py-3 rounded-2xl border transition ${
                    n.lida
                      ? "border-white/5 text-zinc-500"
                      : "border-blue-500/30 bg-blue-500/5 text-zinc-100 hover:bg-blue-500/10 font-medium"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {!n.lida && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                    <span className="flex-1">{n.mensagem}</span>
                    <span className="text-xs text-zinc-500 shrink-0">
                      {new Date(n.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
