"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function getWeekPattern(d: Date) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const week = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${date.getFullYear()}-W${week.toString().padStart(2, '0')}`;
}

export default function GoalForm({ id }: { id?: string }) {
  const router = useRouter();
  const [goalData, setGoalData] = useState({ metric: "", alvo: "", periodo_referencia: "" });
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [token, setToken] = useState("");
  const [selectedMetricObj, setSelectedMetricObj] = useState<any>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    if (!storedToken) return router.push("/login");
    setToken(storedToken);

    fetch("http://localhost:8000/api/v1/metrics/", { headers: { Authorization: `Bearer ${storedToken}` } })
      .then(r => r.json()).then(d => setMetrics(Array.isArray(d) ? d : d.results || []));

    if (id) {
      fetch(`http://localhost:8000/api/v1/goals/${id}/`, { headers: { Authorization: `Bearer ${storedToken}` } })
        .then(r => r.json()).then(d => setGoalData({ metric: d.metric, alvo: d.alvo, periodo_referencia: d.periodo_referencia || "" }));
    }
  }, [id, router]);

  useEffect(() => {
    if (goalData.metric && metrics.length > 0) {
      const metric = metrics.find(m => String(m.id) === String(goalData.metric));
      setSelectedMetricObj(metric);

      if (!id && metric && !goalData.periodo_referencia) {
        const today = new Date();
        const daily = today.toISOString().split("T")[0];
        if (metric.periodo === "daily") setGoalData(p => ({ ...p, periodo_referencia: daily }));
        else if (metric.periodo === "monthly") setGoalData(p => ({ ...p, periodo_referencia: daily.substring(0, 7) }));
        else if (metric.periodo === "yearly") setGoalData(p => ({ ...p, periodo_referencia: today.getFullYear().toString() }));
        else if (metric.periodo === "weekly") setGoalData(p => ({ ...p, periodo_referencia: getWeekPattern(today) }));
      }
    } else {
      setSelectedMetricObj(null);
    }
  }, [goalData.metric, metrics, id, goalData.periodo_referencia]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setGoalData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMessage({ text: "", type: "" });
    try {
      const url = id ? `http://localhost:8000/api/v1/goals/${id}/` : `http://localhost:8000/api/v1/goals/`;
      const method = id ? "PUT" : "POST";
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(goalData) });
      if (!response.ok) throw new Error("Erro ao gravar. Todos os dados preenchidos?");
      setMessage({ text: id ? "Desafio regravado!" : "Meta estabelecida!", type: "success" });
      if (!id) setGoalData({ metric: "", alvo: "", periodo_referencia: "" });
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : "Erro desconhecido", type: "error" });
    } finally { setLoading(false); }
  };

  if (!token) return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] items-center justify-center p-6 bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-xl glass p-8 sm:p-12 rounded-3xl mt-16 text-white border border-white/5">
        <div className="mb-8">
          <Link href="/goals" className="text-sm text-zinc-400 hover:text-white mb-2 inline-block">← Voltar pra Lista</Link>
          <h1 className="text-3xl font-extrabold tracking-tight">{id ? "Configurar Desafio" : "Lançar Desafio"}</h1>
        </div>
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl text-center text-sm ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Base Atrelada</label>
            <select name="metric" value={goalData.metric} onChange={handleChange} required className="w-full px-5 py-3 bg-[#111] border border-white/10 rounded-xl">
              <option value="">Selecione a Métrica Primária</option>
              {metrics.map(m => <option key={m.id} value={m.id}>{m.nome || m.codigo} ({m.periodo})</option>)}
            </select>
          </div>

          {selectedMetricObj && (
            <div className="space-y-2 animate-fade-in-up transition-all">
              <label className="text-sm font-medium text-zinc-300 flex justify-between">
                <span>Qual {
                  selectedMetricObj.periodo === 'daily' ? 'Dia' :
                  selectedMetricObj.periodo === 'weekly' ? 'Semana' :
                  selectedMetricObj.periodo === 'monthly' ? 'Mês' : 'Ano'
                } exato você irá mensurar?</span>
                <span className="text-zinc-600 text-xs">(Período)</span>
              </label>
              <input
                type={
                  selectedMetricObj.periodo === 'daily' ? 'date' :
                  selectedMetricObj.periodo === 'weekly' ? 'week' :
                  selectedMetricObj.periodo === 'monthly' ? 'month' : 'number'
                }
                name="periodo_referencia"
                value={goalData.periodo_referencia}
                onChange={handleChange}
                required
                style={{ colorScheme: 'dark' }}
                className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Alvo Requisitado</label>
            <input type="text" name="alvo" value={goalData.alvo} onChange={handleChange} required className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-xl" />
          </div>
          <button type="submit" disabled={loading} className="w-full mt-4 bg-blue-600 font-bold py-4 rounded-xl hover:bg-blue-500 transition">
            {loading ? 'Computando...' : (id ? 'Atualizar Desafio' : 'Gravar Desafio')}
          </button>
        </form>
      </div>
    </div>
  );
}
