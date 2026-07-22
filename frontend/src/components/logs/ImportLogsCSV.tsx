"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, API_BASE } from "@/lib/api";

interface Metric { id: number; codigo: string; nome?: string; periodo: string }
interface ErroLinha { linha: number; motivo: string }
interface Resumo { criadas: number; ignoradas: number; sem_meta: number; erros: ErroLinha[] }

export default function ImportLogsCSV() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [metricId, setMetricId] = useState("");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Resumo | null>(null);
  const [result, setResult] = useState<Resumo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) return void router.replace("/login");
    setToken(t);
    apiFetch(API_BASE + "/api/v1/metrics/").then(r => r.json())
      .then(d => setMetrics(Array.isArray(d) ? d : [])).catch(() => {});
  }, [router]);

  async function chamar(dry_run: boolean): Promise<Resumo> {
    setError("");
    setLoading(true);
    try {
      const resp = await apiFetch(API_BASE + "/api/v1/logs/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric_id: Number(metricId), csv, dry_run }),
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
      setPreview(await chamar(true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setPreview(null);
    }
  };

  const handleConfirm = async () => {
    try {
      setResult(await chamar(false));
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  };

  if (!token) return <div className="min-h-screen bg-[#0a0a0a]" />;

  const resumo = result || preview;

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] items-center p-6 bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-2xl glass p-8 sm:p-12 rounded-3xl mt-16 text-white border border-white/5">
        <Link href="/logs" className="text-sm text-zinc-400 hover:text-white mb-2 inline-block">← Voltar pra Lançamentos</Link>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Importar lançamentos (CSV)</h1>
        <p className="text-zinc-400 text-sm mb-8">Cole os dados no formato <code className="text-zinc-300">data,valor</code> (uma linha por dia). Cada valor casa com a meta do mesmo dia.</p>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">{error}</div>}
        {result && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm">
            Importado: {result.criadas} criada(s), {result.ignoradas} já existente(s), {result.sem_meta} sem meta no dia.
          </div>
        )}

        <form onSubmit={handlePreview} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Métrica</label>
            <select name="metric_id" value={metricId} onChange={e => { setMetricId(e.target.value); setPreview(null); setResult(null); }} required
              className="w-full px-5 py-3 bg-[#111] border border-white/10 rounded-xl">
              <option value="">Selecione a métrica</option>
              {metrics.map(m => <option key={m.id} value={m.id}>{m.nome || m.codigo} ({m.periodo})</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">CSV</label>
            <textarea name="csv" value={csv} onChange={e => { setCsv(e.target.value); setPreview(null); setResult(null); }} required rows={8}
              placeholder={"data,valor\n2026-08-03,5\n2026-08-04,7"}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl font-mono text-sm" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-white/10 font-bold py-3 rounded-xl hover:bg-white/20 transition">
            {loading ? "Calculando..." : "Pré-visualizar"}
          </button>
        </form>

        {resumo && (
          <div className="mt-8">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-3">
              <span className="text-zinc-400">Válidas: <strong className="text-white">{resumo.criadas}</strong></span>
              <span className="text-zinc-400">Já existentes: <strong className="text-white">{resumo.ignoradas}</strong></span>
              <span className="text-zinc-400">Sem meta no dia: <strong className="text-white">{resumo.sem_meta}</strong></span>
              <span className="text-zinc-400">Erros: <strong className="text-white">{resumo.erros.length}</strong></span>
            </div>
            {resumo.erros.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-red-500/20 mb-4">
                <table className="w-full text-sm">
                  <thead className="text-red-300/70 text-left sticky top-0 bg-[#111]">
                    <tr><th className="py-2 px-3">Linha</th><th className="px-3">Motivo</th></tr>
                  </thead>
                  <tbody>
                    {resumo.erros.map(er => (
                      <tr key={er.linha} className="border-t border-white/5 text-red-300">
                        <td className="py-2 px-3">{er.linha}</td><td className="px-3">{er.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {preview && !result && (
              <button onClick={handleConfirm} disabled={loading}
                className="w-full bg-blue-600 font-bold py-3 rounded-xl hover:bg-blue-500 transition">
                {loading ? "Gravando..." : "Confirmar importação"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
