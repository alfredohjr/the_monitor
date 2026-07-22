"use client";
import React, { useState, useEffect } from "react";
import { apiFetch, API_BASE } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Metric {
  id: number;
  codigo: string;
  nome: string;
  tipo: string;
  periodo: string;
  is_default: boolean;
}

interface Subscription {
  id: number;
  metric_id: number;
}

export default function CatalogPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) { router.replace("/login"); return; }
    setToken(t);
    const headers = { Authorization: `Bearer ${t}` };
    Promise.all([
      apiFetch(API_BASE + "/api/v1/metrics/", { headers }).then(r => r.json()),
      apiFetch(API_BASE + "/api/v1/subscriptions/", { headers }).then(r => r.json()),
    ]).then(([mData, sData]) => {
      const all: Metric[] = Array.isArray(mData) ? mData : mData.results || [];
      setMetrics(all.filter(m => m.is_default));
      setSubscriptions(Array.isArray(sData) ? sData : []);
    }).finally(() => setLoading(false));
  }, [router]);

  const subscribedIds = new Set(subscriptions.map(s => s.metric_id));

  const handleAssinar = async (metricId: number) => {
    const res = await apiFetch(API_BASE + "/api/v1/subscriptions/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ metric_id: metricId }),
    });
    if (res.ok) {
      const sub: Subscription = await res.json();
      setSubscriptions(prev => [...prev, sub]);
    }
  };

  const handleCancelar = async (metricId: number) => {
    const sub = subscriptions.find(s => s.metric_id === metricId);
    if (!sub) return;
    const res = await apiFetch(`${API_BASE}/api/v1/subscriptions/${sub.id}/`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setSubscriptions(prev => prev.filter(s => s.id !== sub.id));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-zinc-400">
        <span className="animate-pulse">Carregando catálogo...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen items-center p-6 pt-24 sm:p-24 bg-[#0a0a0a] text-white">
      <div className="relative z-10 w-full max-w-4xl mt-8">
        <div className="mb-10">
          <Link href="/metrics" className="text-sm text-zinc-400 hover:text-white mb-2 inline-block">← Voltar para Métricas</Link>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Catálogo de Métricas</h1>
          <p className="text-zinc-400">Assine as métricas do sistema que deseja acompanhar nos seus dashboards.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {metrics.map(m => {
            const assinada = subscribedIds.has(m.id);
            return (
              <div key={m.id} className="glass border border-white/5 rounded-2xl p-6 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-lg">{m.nome}</h3>
                    <p className="text-xs text-zinc-500 font-mono mt-1">{m.codigo}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-zinc-400 whitespace-nowrap">{m.tipo} · {m.periodo}</span>
                </div>
                {assinada ? (
                  <button
                    onClick={() => handleCancelar(m.id)}
                    className="mt-auto w-full py-2 rounded-xl text-sm font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition"
                  >
                    Cancelar assinatura
                  </button>
                ) : (
                  <button
                    onClick={() => handleAssinar(m.id)}
                    className="mt-auto w-full py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 transition"
                  >
                    Assinar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
