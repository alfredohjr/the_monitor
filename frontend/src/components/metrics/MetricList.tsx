"use client";
import React, { useEffect, useState } from "react";
import { apiFetch, API_BASE } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatValor } from "@/lib/formatValor";

export default function MetricList() {
  const [items, setItems] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      apiFetch(API_BASE + "/api/v1/metrics/", { headers }).then(r => r.json()),
      apiFetch(API_BASE + "/api/v1/subscriptions/", { headers }).then(r => r.json()),
    ]).then(([mData, sData]) => {
      const all: any[] = Array.isArray(mData) ? mData : mData.results || [];
      const subscribedIds = new Set<number>((Array.isArray(sData) ? sData : []).map((s: any) => s.metric_id));
      // Mostra as métricas próprias (is_default=false) e as métricas do sistema
      // que o usuário assinou — mesmo conjunto usado no dashboard.
      setItems(all.filter(m => !m.is_default || subscribedIds.has(m.id)));
    });
  }, [router]);

  const handleDelete = async (id: number) => {
    const token = localStorage.getItem("access_token");
    if (!confirm("Tem certeza que deseja apagar? Isso removerá a visualização da métrica e metas associadas.")) return;
    try {
      await apiFetch(`${API_BASE}/api/v1/metrics/${id}/`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setItems(items.filter(i => i.id !== id));
    } catch {}
  };

  return (
    <div className="flex flex-col min-h-screen p-6 bg-[#0a0a0a] text-white">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[20%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>
      <div className="relative z-10 w-full max-w-5xl mx-auto space-y-8 mt-16">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Métricas</h1>
            <p className="text-zinc-400">Suas unidades base do sistema.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/metrics/new" className="px-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 whitespace-nowrap truncate text-center">+ Nova Métrica</Link>
          </div>
        </div>

        <div className="glass p-8 rounded-3xl border border-white/5">
          <h2 className="text-lg font-bold text-zinc-300 mb-6">Minhas Métricas</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400 text-sm">
                  <th className="pb-3 px-2">ID</th>
                  <th className="pb-3 px-2 w-32">Código</th>
                  <th className="pb-3 px-2 text-blue-300">Nome de Exibição</th>
                  <th className="pb-3 px-2">Descrição</th>
                  <th className="pb-3 px-2">Tipo</th>
                  <th className="pb-3 px-2">Rotina</th>
                  <th className="pb-3 px-2">Valor Padrão</th>
                  <th className="pb-3 px-2 text-center">Origem</th>
                  <th className="pb-3 px-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id} className="border-b border-zinc-800 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-2 text-zinc-500">#{i.id}</td>
                    <td className="py-4 px-2 font-mono text-zinc-400">{i.codigo}</td>
                    <td className="py-4 px-2 font-medium text-blue-300">{i.nome || '-'}</td>
                    <td className="py-4 px-2 text-zinc-300">{i.descricao}</td>
                    <td className="py-4 px-2 text-zinc-300">{i.tipo}</td>
                    <td className="py-4 px-2 text-zinc-300">{i.periodo}</td>
                    <td className="py-4 px-2 text-zinc-400" data-testid={`valor-padrao-${i.id}`}>
                      {i.valor_padrao != null ? formatValor(i.valor_padrao, i.tipo) : '—'}
                    </td>
                    <td className="py-4 px-2 text-center">
                      {i.is_default && <span data-testid="badge-padrao" className="px-2 py-1 text-xs font-bold rounded-full bg-blue-500/20 text-blue-300">Sistema</span>}
                    </td>
                    <td className="py-4 px-2 text-right">
                      {!i.is_default && (
                        <>
                          <Link href={`/metrics/${i.id}`} className="text-blue-400 font-semibold mr-4 hover:text-blue-300">Editar</Link>
                          <button onClick={() => handleDelete(i.id)} className="text-red-400 font-semibold hover:text-red-300">Apagar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={9} className="py-6 text-center text-zinc-500 italic">Nenhuma métrica nesta seção.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
