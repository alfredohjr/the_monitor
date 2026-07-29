"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, API_BASE } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

interface Ponto { data: string; alvo: number }
interface Metric { id: number; codigo: string; nome?: string; periodo: string }
interface Indice { code: string; nome: string }

export default function ImportAnchored() {
  const router = useRouter();
  const { t } = useT();
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
      if (!resp.ok) throw new Error(d.detail || t("goalsImport.importFailed"));
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
      setError(err instanceof Error ? err.message : t("goalsImport.genericError"));
      setPontos(null);
    }
  };

  const handleConfirm = async () => {
    try {
      const d = await chamar(false);
      setResult({ criadas: d.criadas, ignoradas: d.ignoradas });
      setPontos(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("goalsImport.genericError"));
    }
  };

  if (!token) return <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a]" />;

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] items-center p-6 bg-zinc-50 dark:bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-2xl bg-white border border-zinc-200 dark:bg-white/[0.03] dark:backdrop-blur-xl dark:border-white/5 p-8 sm:p-12 rounded-3xl mt-16 text-zinc-900 dark:text-white">
        <Link href="/goals" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-white mb-2 inline-block">{t("goalsImport.backToGoals")}</Link>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">{t("goalsAnchor.title")}</h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-8">{t("goalsAnchor.subtitle")}</p>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">{error}</div>}
        {result && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm">
            {t("goalsImport.imported", { criadas: result.criadas, ignoradas: result.ignoradas })}
          </div>
        )}

        <form onSubmit={handlePreview} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("goalsImport.metricLabel")}</label>
              <select name="metric_id" value={form.metric_id} onChange={handleChange} required
                className="w-full px-5 py-3 bg-zinc-100 dark:bg-[#111] border border-zinc-200 dark:border-white/10 rounded-xl">
                <option value="">{t("goalsImport.selectMetric")}</option>
                {metrics.map(m => <option key={m.id} value={m.id}>{m.nome || m.codigo} ({m.periodo})</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("goalsAnchor.indexLabel")}</label>
              <select name="index_code" value={form.index_code} onChange={handleChange} required
                className="w-full px-5 py-3 bg-zinc-100 dark:bg-[#111] border border-zinc-200 dark:border-white/10 rounded-xl">
                <option value="">{t("goalsAnchor.selectIndex")}</option>
                {indices.map(i => <option key={i.code} value={i.code}>{i.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("goalsAnchor.baseTarget")}</label>
              <input name="alvo_base" type="number" step="any" value={form.alvo_base} onChange={handleChange} required
                className="w-full px-4 py-3 bg-white border border-zinc-300 dark:bg-white/5 dark:border-white/10 rounded-xl" placeholder={t("goalsAnchor.baseTargetPlaceholder")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("goalsImport.startDate")}</label>
              <input name="inicio" type="date" value={form.inicio} onChange={handleChange} required
                style={{ colorScheme: "dark" }} className="w-full px-4 py-3 bg-white border border-zinc-300 dark:bg-white/5 dark:border-white/10 rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("goalsImport.endDate")}</label>
              <input name="fim" type="date" value={form.fim} onChange={handleChange} required
                style={{ colorScheme: "dark" }} className="w-full px-4 py-3 bg-white border border-zinc-300 dark:bg-white/5 dark:border-white/10 rounded-xl" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-zinc-200 dark:bg-white/10 font-bold py-3 rounded-xl hover:bg-zinc-300 dark:bg-white/20 transition">
            {loading ? t("goalsImport.calculating") : t("goalsImport.preview")}
          </button>
        </form>

        {pontos && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold">{t("goalsImport.previewTitle", { dias: pontos.length })}</h2>
              <span className="text-zinc-600 dark:text-zinc-400 text-sm">{t("goalsAnchor.correctedTarget")} <strong className="text-zinc-900 dark:text-white">{corrigido}</strong> · {t("goalsImport.sum")} <strong className="text-zinc-900 dark:text-white">{soma}</strong></span>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200 dark:border-white/10">
              <table className="w-full text-sm">
                <thead className="text-zinc-600 dark:text-zinc-400 text-left sticky top-0 bg-zinc-100 dark:bg-[#111]">
                  <tr><th className="py-2 px-3">{t("goalsImport.colDate")}</th><th className="px-3">{t("goalsImport.colTarget")}</th></tr>
                </thead>
                <tbody>
                  {pontos.map(p => (
                    <tr key={p.data} className="border-t border-zinc-200 dark:border-white/5">
                      <td className="py-2 px-3">{p.data}</td>
                      <td className="px-3">{p.alvo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={handleConfirm} disabled={loading}
              className="w-full mt-4 bg-blue-600 font-bold py-3 rounded-xl hover:bg-blue-500 transition">
              {loading ? t("goalsImport.saving") : t("goalsImport.confirmImport")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
