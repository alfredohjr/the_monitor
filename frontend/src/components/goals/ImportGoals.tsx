"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useSubscribedMetrics } from "@/lib/useSubscribedMetrics";

interface Ponto { data: string; alvo: number }

const ESTRATEGIAS = [
  { value: "linear", label: "Linear (igual todo dia)" },
  { value: "rampa_crescente", label: "Rampa crescente" },
  { value: "rampa_decrescente", label: "Rampa decrescente" },
  { value: "peso_semana", label: "Dias úteis (zera fim de semana)" },
];

export default function ImportGoals() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [form, setForm] = useState({ metric_id: "", alvo_total: "", inicio: "", fim: "", estrategia: "linear" });
  const [pontos, setPontos] = useState<Ponto[] | null>(null);
  const [soma, setSoma] = useState<number | null>(null);
  const [result, setResult] = useState<{ criadas: number; ignoradas: number } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { metrics } = useSubscribedMetrics(token);

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) return void router.push("/login");
    setToken(t);
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    setPontos(null);
    setResult(null);
  };

  async function chamar(dry_run: boolean) {
    setError("");
    setLoading(true);
    try {
      const resp = await apiFetch("http://localhost:8000/api/v1/goals/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric_id: Number(form.metric_id),
          alvo_total: Number(form.alvo_total),
          inicio: form.inicio,
          fim: form.fim,
          estrategia: form.estrategia,
          dry_run,
        }),
      });
      const d = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(d.detail || "Não foi possível importar");
      return d;
    } finally {
      setLoading(false);
    }
  }

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    try {
      const d = await chamar(true);
      setPontos(d.pontos);
      setSoma(d.soma);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setPontos(null);
    }
  };

  const handleConfirm = async () => {
    try {
      const d = await chamar(false);
      setResult({ criadas: d.criadas, ignoradas: d.ignoradas });
      setPontos(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  };

  if (!token) return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] items-center p-6 bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-2xl glass p-8 sm:p-12 rounded-3xl mt-16 text-white border border-white/5">
        <Link href="/goals" className="text-sm text-zinc-400 hover:text-white mb-2 inline-block">← Voltar pra Metas</Link>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Importar metas</h1>
        <p className="text-zinc-400 text-sm mb-8">Distribui um alvo total em metas diárias segundo uma curva.</p>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">{error}</div>}
        {result && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm">
            Importado: {result.criadas} meta(s) criada(s), {result.ignoradas} já existente(s).
          </div>
        )}

        <form onSubmit={handlePreview} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Métrica</label>
            <select name="metric_id" value={form.metric_id} onChange={handleChange} required
              className="w-full px-5 py-3 bg-[#111] border border-white/10 rounded-xl">
              <option value="">Selecione a métrica</option>
              {metrics.map(m => <option key={m.id} value={m.id}>{m.nome || m.codigo} ({m.periodo})</option>)}
            </select>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Alvo total</label>
              <input name="alvo_total" type="number" step="any" value={form.alvo_total} onChange={handleChange} required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl" placeholder="Ex.: 1000" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Início</label>
              <input name="inicio" type="date" value={form.inicio} onChange={handleChange} required
                style={{ colorScheme: "dark" }} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Fim</label>
              <input name="fim" type="date" value={form.fim} onChange={handleChange} required
                style={{ colorScheme: "dark" }} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Curva de distribuição</label>
            <select name="estrategia" value={form.estrategia} onChange={handleChange}
              className="w-full px-5 py-3 bg-[#111] border border-white/10 rounded-xl">
              {ESTRATEGIAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-white/10 font-bold py-3 rounded-xl hover:bg-white/20 transition">
            {loading ? "Calculando..." : "Pré-visualizar"}
          </button>
        </form>

        {pontos && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold">Prévia — {pontos.length} dia(s)</h2>
              <span className="text-zinc-400 text-sm">Soma: <strong className="text-white">{soma}</strong></span>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="text-zinc-400 text-left sticky top-0 bg-[#111]">
                  <tr><th className="py-2 px-3">Data</th><th className="px-3">Alvo</th></tr>
                </thead>
                <tbody>
                  {pontos.map(p => (
                    <tr key={p.data} className="border-t border-white/5">
                      <td className="py-2 px-3">{p.data}</td>
                      <td className="px-3">{p.alvo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={handleConfirm} disabled={loading}
              className="w-full mt-4 bg-blue-600 font-bold py-3 rounded-xl hover:bg-blue-500 transition">
              {loading ? "Gravando..." : "Confirmar importação"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
