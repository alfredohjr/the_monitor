"use client";
import React, { useEffect, useState } from "react";
import { apiFetch, API_BASE } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatValor } from "@/lib/formatValor";
import { useT } from "@/lib/i18n/useT";

export default function GoalList() {
  const [items, setItems] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const router = useRouter();
  const { t } = useT();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return router.replace("/login");

    apiFetch(API_BASE + "/api/v1/goals/", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : d.results || []));
    apiFetch(API_BASE + "/api/v1/metrics/", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setMetrics(Array.isArray(d) ? d : d.results || []));
  }, [router]);

  const handleDelete = async (id: number) => {
    const token = localStorage.getItem("access_token");
    if (!confirm(t("goals.deleteConfirm"))) return;
    try {
      await apiFetch(`${API_BASE}/api/v1/goals/${id}/`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setItems(items.filter(i => i.id !== id));
    } catch {}
  };

  return (
    <div className="flex flex-col min-h-screen p-6 pt-24 bg-zinc-50 text-zinc-900 dark:bg-[#0a0a0a] dark:text-white">
      <div className="relative z-10 w-full max-w-5xl mx-auto bg-white border border-zinc-200 dark:bg-white/[0.03] dark:backdrop-blur-xl dark:border-white/5 p-8 sm:p-12 rounded-3xl mt-16">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{t("goals.title")}</h1>
            <p className="text-zinc-600 dark:text-zinc-400">{t("goals.subtitle")}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/metas/ancorar" className="px-6 py-3 bg-zinc-200 dark:bg-white/10 rounded-xl font-bold hover:bg-zinc-300 dark:bg-white/20 truncate text-center">{t("goals.anchorToIndex")}</Link>
            <Link href="/metas/clonar" className="px-6 py-3 bg-zinc-200 dark:bg-white/10 rounded-xl font-bold hover:bg-zinc-300 dark:bg-white/20 truncate text-center">{t("goals.cloneGoals")}</Link>
            <Link href="/goals/new" className="px-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 truncate text-center">{t("goals.newGoal")}</Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="border-b border-zinc-700 text-zinc-600 dark:text-zinc-400 text-sm">
                <th className="pb-3 px-2">{t("goals.colCode")}</th>
                <th className="pb-3 px-2">{t("goals.colTargetPeriod")}</th>
                <th className="pb-3 px-2">{t("goals.colTarget")}</th>
                <th className="pb-3 px-2 text-right">{t("goals.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(i => {
                const m = metrics.find(x => x.id === i.metric);
                const desc = m ? (m.nome || m.codigo) : `ID#${i.metric}`;
                return (
                  <tr key={i.id} className="border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
                    <td className="py-4 px-2 font-medium text-blue-300">{desc}</td>
                    <td className="py-4 px-2 text-zinc-700 dark:text-zinc-300 font-bold">{i.periodo_referencia || 'N/A'}</td>
                    <td className="py-4 px-2 text-zinc-700 dark:text-zinc-300 font-bold">{formatValor(i.alvo, m?.tipo ?? 'number')}</td>
                    <td className="py-4 px-2 text-right">
                      <Link href={`/goals/${i.id}`} className="text-blue-400 font-semibold mr-4 hover:text-blue-300">{t("comum.edit")}</Link>
                      <button onClick={() => handleDelete(i.id)} className="text-red-400 font-semibold hover:text-red-300">{t("comum.delete")}</button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-zinc-500 italic">{t("goals.empty")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
