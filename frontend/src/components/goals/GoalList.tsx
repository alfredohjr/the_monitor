"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatValor } from "@/lib/formatValor";

export default function GoalList() {
  const [items, setItems] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return router.push("/login");

    fetch("http://localhost:8000/api/v1/goals/", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : d.results || []));
    fetch("http://localhost:8000/api/v1/metrics/", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setMetrics(Array.isArray(d) ? d : d.results || []));
  }, [router]);

  const handleDelete = async (id: number) => {
    const token = localStorage.getItem("access_token");
    if (!confirm("Deletar este Desafio?")) return;
    try {
      await fetch(`http://localhost:8000/api/v1/goals/${id}/`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setItems(items.filter(i => i.id !== id));
    } catch {}
  };

  return (
    <div className="flex flex-col min-h-screen p-6 bg-[#0a0a0a] text-white">
      <div className="relative z-10 w-full max-w-5xl mx-auto glass p-8 sm:p-12 rounded-3xl border border-white/5 mt-16">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Suas Metas (Goals) Ativas</h1>
            <p className="text-zinc-400">Pedaços de esforço fracionados no tempo.</p>
          </div>
          <Link href="/goals/new" className="px-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 truncate text-center">+ Lançar Desafio</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="border-b border-zinc-700 text-zinc-400 text-sm">
                <th className="pb-3 px-2">Código</th>
                <th className="pb-3 px-2">Período Alvo</th>
                <th className="pb-3 px-2">Alvo Almejado</th>
                <th className="pb-3 px-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map(i => {
                const m = metrics.find(x => x.id === i.metric);
                const desc = m ? (m.nome || m.codigo) : `ID#${i.metric}`;
                return (
                  <tr key={i.id} className="border-b border-zinc-800 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-2 font-medium text-blue-300">{desc}</td>
                    <td className="py-4 px-2 text-zinc-300 font-bold">{i.periodo_referencia || 'N/A'}</td>
                    <td className="py-4 px-2 text-zinc-300 font-bold">{formatValor(i.alvo, m?.tipo ?? 'number')}</td>
                    <td className="py-4 px-2 text-right">
                      <Link href={`/goals/${i.id}`} className="text-blue-400 font-semibold mr-4 hover:text-blue-300">Editar</Link>
                      <button onClick={() => handleDelete(i.id)} className="text-red-400 font-semibold hover:text-red-300">Apagar</button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-zinc-500 italic">Nenhum desafio ou fatia de meta ativa.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
