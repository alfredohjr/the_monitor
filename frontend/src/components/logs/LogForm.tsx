"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { placeholderValor } from "@/lib/formatValor";

export default function LogForm({ id }: { id?: string }) {
  const router = useRouter();
  const hoje = new Date().toISOString().split("T")[0];
  const [logData, setLogData] = useState({ goal: "", data: hoje, valor_logado: "" });
  const [metricId, setMetricId] = useState("");
  const [goals, setGoals] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [token, setToken] = useState("");

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    if (!storedToken) return router.push("/login");
    setToken(storedToken);

    fetch("http://localhost:8000/api/v1/goals/", { headers: { Authorization: `Bearer ${storedToken}` } })
      .then(r => r.json()).then(d => setGoals(Array.isArray(d) ? d : d.results || []));
    fetch("http://localhost:8000/api/v1/metrics/", { headers: { Authorization: `Bearer ${storedToken}` } })
      .then(r => r.json()).then(d => setMetrics(Array.isArray(d) ? d : d.results || []));

    if (id) {
      fetch(`http://localhost:8000/api/v1/logs/${id}/`, { headers: { Authorization: `Bearer ${storedToken}` } })
        .then(r => r.json()).then(d => setLogData({ goal: String(d.goal), data: d.data, valor_logado: d.valor_logado }));
    }
  }, [id, router]);

  // Na edição, pré-seleciona a métrica a partir da meta do log carregado.
  useEffect(() => {
    if (metricId || !logData.goal) return;
    const g = goals.find(x => String(x.id) === String(logData.goal));
    if (g) setMetricId(String(g.metric));
  }, [goals, logData.goal, metricId]);

  // Métricas que têm ao menos uma meta, ordenadas por nome.
  const goalMetricIds = new Set(goals.map(g => String(g.metric)));
  const metricsComMeta = metrics
    .filter(m => goalMetricIds.has(String(m.id)))
    .sort((a, b) => String(a.nome || a.codigo).localeCompare(String(b.nome || b.codigo)));

  // Metas da métrica selecionada, ordenadas por período (mais recente primeiro).
  const goalsDaMetrica = goals
    .filter(g => String(g.metric) === String(metricId))
    .sort((a, b) => String(b.periodo_referencia).localeCompare(String(a.periodo_referencia)));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setLogData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleMetricChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMetricId(e.target.value);
    setLogData(p => ({ ...p, goal: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMessage({ text: "", type: "" });
    try {
      const url = id ? `http://localhost:8000/api/v1/logs/${id}/` : `http://localhost:8000/api/v1/logs/`;
      const method = id ? "PUT" : "POST";
      const payload = id ? logData : { ...logData, data: new Date().toISOString().split("T")[0] };
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("Atenção na digitação do seu lançamento.");
      setMessage({ text: id ? "Alteração feita." : "Registro enviado com sucesso!", type: "success" });
      if (!id) setLogData(p => ({ ...p, valor_logado: "" }));
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : "Erro desconhecido", type: "error" });
    } finally { setLoading(false); }
  };

  if (!token) return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] items-center justify-center p-6 bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-xl glass p-8 sm:p-12 rounded-3xl mt-16 text-white border border-white/5">
        <div className="mb-8">
          <Link href="/logs" className="text-sm text-zinc-400 hover:text-white mb-2 inline-block">← Voltar ao Resumo</Link>
          <h1 className="text-3xl font-extrabold tracking-tight">{id ? "Corrigir Valor" : "Fazer Check-in"}</h1>
        </div>
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl text-center text-sm ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Métrica</label>
            <select name="metric" value={metricId} onChange={handleMetricChange} required className="w-full px-5 py-3 bg-[#111] border border-white/10 rounded-xl">
              <option value="">Selecione a Métrica</option>
              {metricsComMeta.map(m => (
                <option key={m.id} value={m.id}>{m.nome || m.codigo}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Desafio Ativado</label>
            <select name="goal" value={logData.goal} onChange={handleChange} required disabled={!metricId} className="w-full px-5 py-3 bg-[#111] border border-white/10 rounded-xl disabled:opacity-50">
              <option value="">{metricId ? "Selecione o período" : "Escolha a métrica primeiro"}</option>
              {goalsDaMetrica.map(g => (
                <option key={g.id} value={g.id}>{g.periodo_referencia || "Sem período"}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Quanto atingiu?</label>
            <input type="text" name="valor_logado" value={logData.valor_logado} onChange={handleChange} required className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500" placeholder={placeholderValor(metrics.find(m => String(m.id) === String(metricId))?.tipo ?? 'number')} />
          </div>
          <button type="submit" disabled={loading} className="w-full mt-4 bg-green-600 font-bold py-4 rounded-xl hover:bg-green-500 transition">
            {loading ? 'Salvando...' : (id ? 'Corrigir Passado' : 'Carimbar Ponto Diário!')}
          </button>
        </form>
      </div>
    </div>
  );
}
