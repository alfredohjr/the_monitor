"use client";
import React, { useEffect, useState } from "react";
import { apiFetch, API_BASE } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatValor } from "@/lib/formatValor";

interface LogPermissions {
  is_admin: boolean;
  user_id: number | null;
  metrics: Record<string, { can_edit: boolean; can_delete: boolean }>;
}

export default function LogList() {
  const [items, setItems] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [perms, setPerms] = useState<LogPermissions>({ is_admin: false, user_id: null, metrics: {} });
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return router.replace("/login");

    apiFetch(API_BASE + "/api/v1/logs/", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : d.results || []));
    apiFetch(API_BASE + "/api/v1/goals/", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setGoals(Array.isArray(d) ? d : d.results || []));
    apiFetch(API_BASE + "/api/v1/metrics/", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setMetrics(Array.isArray(d) ? d : d.results || []));
    apiFetch(API_BASE + "/api/v1/me/log-permissions/", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d && typeof d === "object" && "metrics" in d) setPerms(d); }).catch(() => {});
  }, [router]);

  // Permissões efetivas do lançamento: admin pode tudo; lançador só nos próprios
  // e conforme as flags da métrica (#164).
  function permsFor(log: any): { canEdit: boolean; canDelete: boolean } {
    if (perms.is_admin) return { canEdit: true, canDelete: true };
    const g = goals.find(x => x.id === log.goal);
    const flags = g ? perms.metrics[String(g.metric)] : undefined;
    const own = log.created_by != null && log.created_by === perms.user_id;
    return {
      canEdit: !!(own && flags?.can_edit),
      canDelete: !!(own && flags?.can_delete),
    };
  }

  const handleDelete = async (id: number) => {
    const token = localStorage.getItem("access_token");
    if (!confirm("Deletar apontamento do dia?")) return;
    try {
      await apiFetch(`${API_BASE}/api/v1/logs/${id}/`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setItems(items.filter(i => i.id !== id));
    } catch {}
  };

  return (
    <div className="flex flex-col min-h-screen p-6 bg-[#0a0a0a] text-white">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[10%] right-[30%] w-[30%] h-[30%] rounded-full bg-green-600/10 blur-[100px]" />
      </div>
      <div className="relative z-10 w-full max-w-5xl mx-auto glass p-8 sm:p-12 rounded-3xl border border-white/5 mt-16">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Histórico de Lançamentos</h1>
            <p className="text-zinc-400">Cada suor do dia-a-dia registrado.</p>
          </div>
          <Link href="/logs/new" className="px-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 truncate text-center">+ Diário (Check-in)</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="border-b border-zinc-700 text-zinc-400 text-sm">
                <th className="pb-3 px-2 w-[120px]">Quando</th>
                <th className="pb-3 px-2">Referente a Qual Métrica?</th>
                <th className="pb-3 px-2">O Que Lançou? (Valor)</th>
                <th className="pb-3 px-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {items.map(i => {
                const g = goals.find(x => x.id === i.goal);
                const m = g ? metrics.find(x => x.id === g.metric) : null;
                const metricRef = g && g.periodo_referencia ? ` [${g.periodo_referencia}]` : '';
                const metricName = m ? (m.nome || m.codigo) : `Meta #${i.goal}`;
                return (
                  <tr key={i.id} className="border-b border-zinc-800 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-2 text-zinc-400 tabular-nums">{i.data}</td>
                    <td className="py-4 px-2 font-medium text-blue-300">{metricName} {metricRef}</td>
                    <td className="py-4 px-2 text-blue-300 font-bold text-lg">{formatValor(i.valor_logado, m?.tipo ?? 'number')}</td>
                    <td className="py-4 px-2 text-right">
                      {(() => {
                        const p = permsFor(i);
                        return (
                          <>
                            {p.canEdit && <Link href={`/logs/${i.id}`} className="text-blue-400 font-semibold mr-4 hover:text-blue-300">Editar</Link>}
                            {p.canDelete && <button onClick={() => handleDelete(i.id)} className="text-red-400 font-semibold hover:text-red-300">Desfazer</button>}
                            {!p.canEdit && !p.canDelete && <span className="text-zinc-600 text-xs">—</span>}
                          </>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-zinc-500 italic">Nenhum check-in submetido ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
