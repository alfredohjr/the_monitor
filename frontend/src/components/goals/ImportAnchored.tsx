"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, API_BASE } from "@/lib/api";

interface Ponto { data: string; alvo: number }
interface Metric { id: number; codigo: string; nome?: string; periodo: string }
interface Indice { code: string; nome: string }

export default function ImportAnchored() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [form, setForm] = useState({ metric_id: "", index_code: "", alvo_base: "", inicio: "", fim: "", strategy: "real", estrategia_base: "linear" });
  const [pontos, setPontos] = useState<Ponto[] | null>(null);
  const [corrigido, setCorrigido] = useState<number | null>(null);
  const [soma, setSoma] = useState<number | null>(null);
  const [result, setResult] = useState<{ criadas: number; ignoradas: number } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [indices, setIndices] = useState<Indice[]>([]);

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) return void router.replace("/login");
    setToken(t);
    apiFetch(API_BASE + "/api/v1/metrics/").then(r => r.json())
      .then(d => setMetrics(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch(API_BASE + "/api/v1/external-indices/").then(r => r.json())
      .then(d => setIndices(Array.isArray(d) ? d : [])).catch(() => {});
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
      const resp = await apiFetch(API_BASE + "/api/v1/goals/import-anchored", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric_id: Number(form.metric_id),
          index_code: form.index_code,
          alvo_base: Number(form.alvo_base),
          inicio: form.inicio,
          fim: form.fim,
          strategy: form.strategy,
          estrategia_base: form.estrategia_base,
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
      setCorrigido(d.alvo_corrigido);
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
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Metas ancoradas em índice</h1>
        <p className="text-zinc-400 text-sm mb-8">Corrige o alvo por um índice real (ex.: IPCA) para não perder pra inflação. As metas são gravadas resolvidas (snapshot); dá pra re-ancorar depois.</p>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">{error}</div>}
        {result && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm">
            Importado: {result.criadas} meta(s) criada(s), {result.ignoradas} já existente(s).
          </div>
        )}

        <form onSubmit={handlePreview} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Métrica</label>
              <select name="metric_id" value={form.metric_id} onChange={handleChange} required
                className="w-full px-5 py-3 bg-[#111] border border-white/10 rounded-xl">
                <option value="">Selecione a métrica</option>
                {metrics.map(m => <option key={m.id} value={m.id}>{m.nome || m.codigo} ({m.periodo})</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Índice</label>
              <select name="index_code" value={form.index_code} onChange={handleChange} required
                className="w-full px-5 py-3 bg-[#111] border border-white/10 rounded-xl">
                <option value="">Selecione o índice</option>
                {indices.map(i => <option key={i.code} value={i.code}>{i.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Alvo base</label>
              <input name="alvo_base" type="number" step="any" value={form.alvo_base} onChange={handleChange} required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl" placeholder="Ex.: 30000" />
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

          <button type="submit" disabled={loading}
            className="w-full bg-white/10 font-bold py-3 rounded-xl hover:bg-white/20 transition">
            {loading ? "Calculando..." : "Pré-visualizar"}
          </button>
        </form>

        {pontos && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold">Prévia — {pontos.length} dia(s)</h2>
              <span className="text-zinc-400 text-sm">Alvo corrigido: <strong className="text-white">{corrigido}</strong> · Soma: <strong className="text-white">{soma}</strong></span>
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
