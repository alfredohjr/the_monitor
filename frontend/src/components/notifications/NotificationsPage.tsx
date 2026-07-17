"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Notification,
  fetchNotifications,
  markNotificationRead,
} from "@/lib/notifications";

/** Formata a data da notificação em pt-BR (ex.: 08/07/2026 00:00). */
function formatarData(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (t: string) => {
    try {
      setItems(await fetchNotifications(t));
    } catch {
      // silencioso: a UI mostra estado vazio
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) {
      router.push("/login");
      return;
    }
    setToken(t);
    load(t);
  }, [router, load]);

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

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Notificações</h1>
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white transition">
          ← Voltar
        </Link>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-center py-12">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-zinc-500 text-center py-12">Nenhuma notificação.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`flex items-start justify-between gap-4 rounded-2xl border border-white/10 px-4 py-3 transition ${
                n.lida ? "bg-zinc-900/40" : "bg-zinc-900"
              }`}
            >
              <div className="min-w-0">
                <p className={`text-sm ${n.lida ? "text-zinc-500" : "text-zinc-100 font-medium"}`}>
                  <span className="flex items-center gap-2">
                    {!n.lida && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                    {n.mensagem}
                  </span>
                </p>
                {n.created_at && (
                  <p className="text-xs text-zinc-600 mt-1">{formatarData(n.created_at)}</p>
                )}
              </div>
              {!n.lida && (
                <button
                  onClick={() => handleRead(n.id)}
                  className="shrink-0 text-xs text-blue-400 hover:text-blue-300 transition whitespace-nowrap"
                >
                  Marcar como lida
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
