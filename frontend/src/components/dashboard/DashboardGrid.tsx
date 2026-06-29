"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Y_AXIS_WIDTH, Y_AXIS_TICK_DX } from "@/lib/chart";

export default function DashboardGrid() {
  const router = useRouter();
  const [goals, setGoals] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [selectedMetric, setSelectedMetric] = useState("all");

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    if (!storedToken) {
      router.push("/login");
      return;
    }
    setToken(storedToken);

    const fetchData = async () => {
      try {
        const headers = { "Authorization": `Bearer ${storedToken}` };
        const [gRes, lRes, mRes] = await Promise.all([
          fetch("http://localhost:8000/api/v1/goals/", { headers }),
          fetch("http://localhost:8000/api/v1/logs/", { headers }),
          fetch("http://localhost:8000/api/v1/metrics/", { headers })
        ]);

        if (gRes.status === 401 || lRes.status === 401 || mRes.status === 401) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }

        const [gData, lData, mData] = await Promise.all([gRes.json(), lRes.json(), mRes.json()]);
        setGoals(Array.isArray(gData) ? gData : gData.results || []);
        setLogs(Array.isArray(lData) ? lData : lData.results || []);
        const metricsArr = Array.isArray(mData) ? mData : mData.results || [];
        setMetrics(metricsArr);
        const defaultMetric = metricsArr.find((m: any) => m.is_default);
        if (defaultMetric) setSelectedMetric(String(defaultMetric.id));
        else if (metricsArr.length === 1) setSelectedMetric(String(metricsArr[0].id));
      } catch (err) {
        console.error("Dashboard fetch error", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const filteredLogs = selectedMetric === "all" ? logs : logs.filter(l => {
    const goal = goals.find(g => g.id === l.goal);
    return goal && String(goal.metric) === selectedMetric;
  });

  const filteredGoals = selectedMetric === "all" ? goals : goals.filter(g => String(g.metric) === selectedMetric);
  const activeGoalsCount = filteredGoals.length;

  const sortedLogs = [...filteredLogs].sort((a, b) => new Date(b.created_at || b.data).getTime() - new Date(a.created_at || a.data).getTime());
  const lastLog = sortedLogs[0];
  let lastLogText = "Nenhum";
  if (lastLog) {
    const goal = goals.find(g => g.id === lastLog.goal);
    if (goal) {
      const metric = metrics.find(m => m.id === goal.metric);
      lastLogText = metric ? `${metric.nome || metric.codigo} (v: ${lastLog.valor_logado})` : `Meta #${lastLog.goal}`;
    }
  }

  const rateProxy = filteredGoals.length > 0 ? Math.min(100, Math.round((filteredLogs.length / (filteredGoals.length * 2)) * 100)) : 0;

  const chartDataRaw = filteredLogs.reduce((acc, log) => {
    const d = log.data;
    if (!acc[d]) acc[d] = { dataPoint: d, quantidade: 0, somaValores: 0 };
    acc[d].quantidade += 1;
    const val = parseFloat(log.valor_logado);
    if (!isNaN(val)) acc[d].somaValores += val;
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.values(chartDataRaw).sort((a: any, b: any) => new Date(a.dataPoint).getTime() - new Date(b.dataPoint).getTime());
  const isSelectedMetricNumeric = selectedMetric !== "all" && metrics.find(m => String(m.id) === selectedMetric)?.tipo.match(/number|decimal|currency|percent/);
  const dataKeyToPlot = isSelectedMetricNumeric ? "somaValores" : "quantidade";

  if (loading || !token) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-zinc-400">
        <span className="animate-pulse">Sincronizando estatísticas com o Banco...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen items-center p-6 sm:p-24 relative overflow-hidden bg-[#0a0a0a] text-white">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4 mt-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">Painel de Evolução</h1>
            <p className="text-zinc-400">Acompanhe seus dados reais, volume de lançamentos e cadência de progresso.</p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <select value={selectedMetric} onChange={e => setSelectedMetric(e.target.value)} className="bg-[#111] border border-white/10 px-4 py-3 rounded-full text-sm outline-none w-40 sm:w-auto">
              <option value="all">Todas as Métricas</option>
              {metrics.map(m => <option key={m.id} value={m.id}>{m.nome || m.codigo}</option>)}
            </select>
            <Link href="/logs/new" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-full font-medium transition text-sm text-center">
              + Check-in Hoje
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl glass border border-white/5 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
            <h3 className="text-zinc-400 text-sm font-medium mb-1">Metas Ativas</h3>
            <p className="text-4xl font-bold">{activeGoalsCount}</p>
          </div>
          <div className="p-6 rounded-3xl glass border border-white/5 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <h3 className="text-zinc-400 text-sm font-medium mb-1">Taxa de Esforço (Estimada)</h3>
            <p className={`text-4xl font-bold ${rateProxy > 50 ? 'text-green-400' : 'text-orange-400'}`}>{rateProxy}%</p>
          </div>
          <div className="p-6 rounded-3xl glass border border-white/5 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <h3 className="text-zinc-400 text-sm font-medium mb-1">Último Registo Feito</h3>
            <p className="text-lg font-bold mt-2 truncate text-blue-300">{lastLogText}</p>
          </div>
        </div>

        <div className="mt-8 p-6 sm:p-8 rounded-3xl glass border border-white/5 h-[400px] flex flex-col animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <h3 className="text-xl font-bold mb-6">
            {selectedMetric === "all" ? "Frequência de Check-ins (Histórico Geral)" : "Evolução Cumulativa dos Valores"}
          </h3>
          {chartData.length > 0 ? (
            <div className="flex-1 w-full min-h-[0]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="dataPoint" stroke="#888" tick={{ fill: '#888' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke="#888" tick={{ fill: '#888' }} axisLine={false} tickLine={false} dx={Y_AXIS_TICK_DX} width={Y_AXIS_WIDTH} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '12px' }}
                    itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                    formatter={(value: any) => [value, selectedMetric === "all" ? "Registos:" : "Realizado:"]}
                    labelFormatter={(label) => `Data: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey={dataKeyToPlot}
                    stroke="#3b82f6"
                    strokeWidth={4}
                    dot={{ r: 5, fill: '#0a0a0a', stroke: '#3b82f6', strokeWidth: 2 }}
                    activeDot={{ r: 8, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <svg className="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p>Nenhum lançamento efetuado ou pertencente a esse filtro.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
