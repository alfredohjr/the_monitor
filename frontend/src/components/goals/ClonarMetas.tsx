"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface Metric { id: number; codigo: string; nome?: string; periodo: string }
interface CloneResult { criadas: number; ignoradas: number; soma: number }

export default function ClonarMetas() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [form, setForm] = useState({ metric_id: "", origem_inicio: "", origem_fim: "", destino_inicio: "", escala: "1" });
  const [preview, setPreview] = useState<CloneResult | null>(null);
  const [result, setResult] = useState<CloneResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) return void router.push("/login");
    setToken(t);
    apiFetch("http://localhost:8000/api/v1/metrics/").then(r => r.json())
      .then(d => setMetrics(Array.isArray(d) ? d : [])).catch(() => {});
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    setPreview(null);
    setResult(null);
  };

  async function chamar(dry_run: boolean): Promise<CloneResult> {
    setError("");
    setLoading(true);
    try {
      const resp = await apiFetch("http://localhost:8000/api/v1/goals/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric_id: Number(form.metric_id),
          origem_inicio: form.origem_inicio,
          origem_fim: form.origem_fim,
          destino_inicio: form.destino_inicio,
          escala: Number(form.escala) || 1,
          dry_run,
        }),
      });
      const d = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(d.detail || "Não foi possível clonar");
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

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] items-center p-6 bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-2xl glass p-8 sm:p-12 rounded-3xl mt-16 text-white border border-white/5">
        <Link href="/goals" className="text-sm text-zinc-400 hover:text-white mb-2 inline-block">← Voltar pra Metas</Link>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Clonar metas</h1>
        <p className="text-zinc-400 text-sm mb-8">Replica as metas diárias de um período anterior para um novo, deslocando as datas e (opcionalmente) escalando o alvo.</p>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">{error}</div>}
        {result && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm">
            Clonado: {result.criadas} meta(s) criada(s), {result.ignoradas} já existente(s). Soma: {result.soma}.
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

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Origem — início</label>
              <input name="origem_inicio" type="date" value={form.origem_inicio} onChange={handleChange} required
                style={{ colorScheme: "dark" }} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Origem — fim</label>
              <input name="origem_fim" type="date" value={form.origem_fim} onChange={handleChange} required
                style={{ colorScheme: "dark" }} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Destino — início</label>
              <input name="destino_inicio" type="date" value={form.destino_inicio} onChange={handleChange} required
                style={{ colorScheme: "dark" }} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Escala do alvo (1 = igual)</label>
              <input name="escala" type="number" step="any" value={form.escala} onChange={handleChange}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl" placeholder="Ex.: 1.1 = +10%" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-white/10 font-bold py-3 rounded-xl hover:bg-white/20 transition">
            {loading ? "Calculando..." : "Pré-visualizar"}
          </button>
        </form>

        {preview && (
          <div className="mt-8">
            <div className="p-4 rounded-xl border border-white/10 bg-white/5 text-sm">
              <p><strong className="text-white">{preview.criadas}</strong> meta(s) serão criada(s).</p>
              <p className="text-zinc-400">{preview.ignoradas} já existe(m) no destino (serão ignoradas). Soma dos novos alvos: <strong className="text-white">{preview.soma}</strong>.</p>
            </div>
            <button onClick={handleConfirm} disabled={loading}
              className="w-full mt-4 bg-blue-600 font-bold py-3 rounded-xl hover:bg-blue-500 transition">
              {loading ? "Gravando..." : "Confirmar clonagem"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
