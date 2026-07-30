"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, API_BASE } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

interface Ponto { data: string; alvo: number }
interface Metric { id: number; codigo: string; nome?: string; periodo: string }
interface Template { id: number; nome: string; metric_codigo: string; alvo_sugerido: string; estrategia: string; categoria?: string }

// Constante de módulo, fora do componente: guarda a CHAVE do catálogo, não o
// texto. A tradução acontece no render, onde o `t` existe.
const ESTRATEGIAS = [
  { value: "linear", labelKey: "goalsImport.curveLinear" },
  { value: "rampa_crescente", labelKey: "goalsImport.curveRampUp" },
  { value: "rampa_decrescente", labelKey: "goalsImport.curveRampDown" },
  { value: "peso_semana", labelKey: "goalsImport.curveWeekdays" },
  { value: "sazonal_mes", labelKey: "goalsImport.curveSeasonalMonth" },
];

export default function ImportGoals() {
  const router = useRouter();
  const { t } = useT();
  const [token, setToken] = useState("");
  const [form, setForm] = useState({ metric_id: "", alvo_total: "", inicio: "", fim: "", estrategia: "linear" });
  const [pontos, setPontos] = useState<Ponto[] | null>(null);
  const [soma, setSoma] = useState<number | null>(null);
  const [result, setResult] = useState<{ criadas: number; ignoradas: number } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) return void router.replace("/login");
    setToken(t);
    // todas as métricas visíveis (org + catálogo) para mapear o código do modelo
    apiFetch(API_BASE + "/api/v1/metrics/").then(r => r.json())
      .then(d => setMetrics(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch(API_BASE + "/api/v1/goal-templates/").then(r => r.json())
      .then(d => setTemplates(Array.isArray(d) ? d : [])).catch(() => {});
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    setPontos(null);
    setResult(null);
  };

  // Pré-preenche o form a partir de um modelo do catálogo (#143).
  const usarModelo = (t: Template) => {
    const m = metrics.find(x => x.codigo === t.metric_codigo);
    setForm(p => ({ ...p, metric_id: m ? String(m.id) : "", alvo_total: t.alvo_sugerido, estrategia: t.estrategia }));
    setPontos(null);
    setResult(null);
    setError(m ? "" : `A métrica ${t.metric_codigo} não está disponível — assine-a no catálogo.`);
  };

  async function chamar(dry_run: boolean) {
    setError("");
    setLoading(true);
    try {
      const resp = await apiFetch(API_BASE + "/api/v1/goals/import", {
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
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">{t("goalsImport.title")}</h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-2">{t("goalsImport.subtitle")}</p>
        <p className="text-zinc-500 text-xs mb-8">{t("goalsImport.haveSpreadsheet")} <Link href="/logs/import" className="text-blue-400 hover:text-blue-300">{t("goalsImport.importCsvLink")}</Link></p>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">{error}</div>}
        {result && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm">
            {t("goalsImport.imported", { criadas: result.criadas, ignoradas: result.ignoradas })}
          </div>
        )}

        {templates.length > 0 && (
          <div className="mb-6">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{t("goalsImport.startFromTemplate")}</p>
            <div className="flex flex-wrap gap-2">
              {templates.map(t => (
                <button key={t.id} type="button" onClick={() => usarModelo(t)} title={t.metric_codigo}
                  className="text-xs px-3 py-1.5 rounded-full bg-white border border-zinc-300 dark:bg-white/5 dark:border-white/10 hover:bg-zinc-200 dark:bg-white/10 transition">
                  {t.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handlePreview} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("goalsImport.metricLabel")}</label>
            <select name="metric_id" value={form.metric_id} onChange={handleChange} required
              className="w-full px-5 py-3 bg-zinc-100 dark:bg-[#111] border border-zinc-200 dark:border-white/10 rounded-xl">
              <option value="">{t("goalsImport.selectMetric")}</option>
              {metrics.map(m => <option key={m.id} value={m.id}>{m.nome || m.codigo} ({m.periodo})</option>)}
            </select>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("goalsImport.totalTarget")}</label>
              <input name="alvo_total" type="number" step="any" value={form.alvo_total} onChange={handleChange} required
                className="w-full px-4 py-3 bg-white border border-zinc-300 dark:bg-white/5 dark:border-white/10 rounded-xl" placeholder={t("goalsImport.totalTargetPlaceholder")} />
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

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("goalsImport.curveLabel")}</label>
            <select name="estrategia" value={form.estrategia} onChange={handleChange}
              className="w-full px-5 py-3 bg-zinc-100 dark:bg-[#111] border border-zinc-200 dark:border-white/10 rounded-xl">
              {ESTRATEGIAS.map(e => <option key={e.value} value={e.value}>{t(e.labelKey)}</option>)}
            </select>
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
              <span className="text-zinc-600 dark:text-zinc-400 text-sm">{t("goalsImport.sum")} <strong className="text-zinc-900 dark:text-white">{soma}</strong></span>
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
