"use client";
import React, { useState, useEffect } from "react";
import { apiFetch, API_BASE } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/useT";

export default function MetricForm({ id }: { id?: string }) {
  const router = useRouter();
  const { t } = useT();
  const [formData, setFormData] = useState({ codigo: "", nome: "", descricao: "", valor_padrao: "", tipo: "number", periodo: "daily", is_default: false });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [token, setToken] = useState("");

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    if (!storedToken) return router.replace("/login");
    setToken(storedToken);

    if (id && id !== 'new') {
      apiFetch(`${API_BASE}/api/v1/metrics/${id}/`, { headers: { Authorization: `Bearer ${storedToken}` } })
        .then(r => r.json()).then(d => {
          setFormData({ codigo: d.codigo, nome: d.nome || "", descricao: d.descricao, valor_padrao: d.valor_padrao || "", tipo: d.tipo, periodo: d.periodo, is_default: d.is_default ?? false });
        }).catch(() => setMessage({ text: t("metrics.loadError"), type: "error" }));
    }
  }, [id, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMessage({ text: "", type: "" });
    try {
      const url = id ? `${API_BASE}/api/v1/metrics/${id}/` : `${API_BASE}/api/v1/metrics/`;
      const method = id ? "PUT" : "POST";
      const response = await apiFetch(url, { method, headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(formData) });
      if (!response.ok) throw new Error(id ? t("metrics.updateError") : t("metrics.createError"));
      setMessage({ text: id ? t("metrics.updatedOk") : t("metrics.createdOk"), type: "success" });
      if (!id) setFormData({ codigo: "", nome: "", descricao: "", valor_padrao: "", tipo: "number", periodo: "daily", is_default: false });
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : t("metrics.unknownError"), type: "error" });
    } finally { setLoading(false); }
  };

  if (!token) return <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a]" />;

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6 bg-zinc-50 dark:bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-xl bg-white border border-zinc-200 dark:bg-white/[0.03] dark:backdrop-blur-xl dark:border-white/5 p-8 sm:p-12 rounded-3xl mt-16 text-zinc-900 dark:text-white">
        <div className="mb-8">
          <Link href="/metrics" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-white mb-2 inline-block">{t("metrics.backToList")}</Link>
          <h1 className="text-3xl font-extrabold tracking-tight">{id ? t("metrics.formEditTitle") : t("metrics.formNewTitle")}</h1>
        </div>
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl text-center text-sm ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("metrics.formCode")}</label>
              <input type="text" name="codigo" value={formData.codigo} onChange={handleChange} required className="w-full px-5 py-3 bg-white border border-zinc-300 dark:bg-white/5 dark:border-white/10 rounded-xl" />
            </div>
            <div className="flex-[2] space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("metrics.formFriendlyName")}</label>
              <input type="text" name="nome" value={formData.nome} onChange={handleChange} required className="w-full px-5 py-3 bg-zinc-100 dark:bg-[#111] border border-blue-500/30 rounded-xl focus:border-blue-500" placeholder={t("metrics.formFriendlyNamePlaceholder")} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("metrics.formDescription")}</label>
            <textarea name="descricao" value={formData.descricao} onChange={handleChange} required className="w-full px-5 py-3 bg-white border border-zinc-300 dark:bg-white/5 dark:border-white/10 rounded-xl resize-none" rows={3} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("metrics.formDefaultValue")}</label>
            <input type="text" name="valor_padrao" value={formData.valor_padrao} onChange={handleChange} className="w-full px-5 py-3 bg-white border border-zinc-300 dark:bg-white/5 dark:border-white/10 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("metrics.formType")}</label>
              <select name="tipo" value={formData.tipo} onChange={handleChange} className="w-full px-5 py-3 bg-zinc-100 dark:bg-[#111] border border-zinc-200 dark:border-white/10 rounded-xl">
                <option value="number">{t("metrics.typeNumber")}</option>
                <option value="decimal">{t("metrics.typeDecimal")}</option>
                <option value="currency">{t("metrics.typeCurrency")}</option>
                <option value="percent">{t("metrics.typePercent")}</option>
                <option value="string">{t("metrics.typeString")}</option>
                <option value="boolean">{t("metrics.typeBoolean")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("metrics.formFrequency")}</label>
              <select name="periodo" value={formData.periodo} onChange={handleChange} className="w-full px-5 py-3 bg-zinc-100 dark:bg-[#111] border border-zinc-200 dark:border-white/10 rounded-xl">
                <option value="daily">{t("metrics.freqDaily")}</option>
                <option value="weekly">{t("metrics.freqWeekly")}</option>
                <option value="monthly">{t("metrics.freqMonthly")}</option>
                <option value="yearly">{t("metrics.freqYearly")}</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" name="is_default" checked={formData.is_default} onChange={handleChange} aria-label={t("metrics.isDefaultAria")} className="w-4 h-4 accent-blue-500" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("metrics.isDefaultLabel")}</span>
          </label>
          <button type="submit" disabled={loading} className="w-full mt-4 bg-blue-600 font-bold py-4 rounded-xl hover:bg-blue-500 transition">
            {loading ? t("metrics.saving") : (id ? t("metrics.updateMetric") : t("metrics.saveNewMetric"))}
          </button>
        </form>
      </div>
    </div>
  );
}
