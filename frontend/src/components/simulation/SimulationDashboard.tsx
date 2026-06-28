"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { replicateForward } from "@/lib/simulation";

interface MetricConfig {
  periodo: string;
  valor_padrao?: string;
  tipo?: string;
  nome?: string;
  codigo?: string;
  id?: number;
}

interface GoalRecord {
  id: number;
  metric: number;
  alvo: string;
  periodo_referencia: string;
  [key: string]: unknown;
}

interface LogRecord {
  goal: number;
  valor_logado: string;
}

interface SliceData {
  isNew: boolean;
  goalId: string | number;
  periodRef: string;
  alvo: number;
  realizado: number;
  isLockedRegion: boolean;
  goalOriginal?: GoalRecord;
  alvoOriginalValue?: number;
}

interface DraggableBarProps {
  data: SliceData;
  maxVal: number;
  onChange: (val: number) => void;
  prefix?: string;
  isLocked?: boolean;
}

function getWeekPattern(d: Date) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const week = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${date.getFullYear()}-W${week.toString().padStart(2, '0')}`;
}

function generateSlices(metricConfig: MetricConfig, startDateStr: string, endDateStr: string) {
  const slices: string[] = [];
  if (!startDateStr || !endDateStr || !metricConfig) return [];
  const [sy, sm, sd] = startDateStr.split("-").map(Number);
  const [ey, em, ed] = endDateStr.split("-").map(Number);
  const curr = new Date(sy, sm - 1, sd, 0, 0, 0);
  const end = new Date(ey, em - 1, ed, 23, 59, 59);
  let safety = 0;
  while (curr <= end && safety < 365) {
    if (metricConfig.periodo === 'daily') {
      const yy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, '0');
      const dd = String(curr.getDate()).padStart(2, '0');
      slices.push(`${yy}-${mm}-${dd}`);
      curr.setDate(curr.getDate() + 1);
    } else if (metricConfig.periodo === 'weekly') {
      slices.push(getWeekPattern(curr));
      curr.setDate(curr.getDate() + 7);
    } else if (metricConfig.periodo === 'monthly') {
      const yy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, '0');
      slices.push(`${yy}-${mm}`);
      curr.setMonth(curr.getMonth() + 1);
    } else if (metricConfig.periodo === 'yearly') {
      slices.push(curr.getFullYear().toString());
      curr.setFullYear(curr.getFullYear() + 1);
    }
    safety++;
  }
  return Array.from(new Set(slices));
}

function formatNumber(val: number) {
  if (isNaN(val) || val === null || val === undefined) return "0,00";
  return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const DraggableBar = ({ data, maxVal, onChange, prefix = "", isLocked = false }: DraggableBarProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState("");
  const barRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientY: number) => {
    if (isLocked) return;
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const height = rect.height;
    const yClick = clientY - rect.top;
    const percentage = Math.max(0, Math.min(100, ((height - yClick) / height) * 100));
    let newVal = (percentage / 100) * maxVal;
    newVal = Math.round(newVal * 2) / 2;
    onChange(newVal);
  }, [isLocked, maxVal, onChange]);

  useEffect(() => {
    const handleMouseUpGlobal = () => setIsDragging(false);
    const handleMouseMoveGlobal = (e: MouseEvent) => { if (isDragging) handleMove(e.clientY); };
    if (isDragging) {
      window.addEventListener('mouseup', handleMouseUpGlobal);
      window.addEventListener('mousemove', handleMouseMoveGlobal);
    }
    return () => {
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
    };
  }, [isDragging, handleMove]);

  const handleStartEdit = () => {
    if (isLocked) return;
    setTempValue(data.alvo.toString());
    setIsEditing(true);
  };

  const handleEndEdit = () => {
    setIsEditing(false);
    let parsedVal = 0;
    if (tempValue.includes(',') && tempValue.includes('.')) {
      parsedVal = parseFloat(tempValue.replace(/\./g, '').replace(',', '.'));
    } else if (tempValue.includes(',')) {
      parsedVal = parseFloat(tempValue.replace(',', '.'));
    } else {
      parsedVal = parseFloat(tempValue);
    }
    if (!isNaN(parsedVal) && parsedVal >= 0) onChange(parsedVal);
  };

  const cBar = data.isNew ? 'bg-amber-500/10 border-amber-400 border-dotted' : 'bg-blue-500/10 border-blue-400/50 border-dashed';
  const cHoverBar = data.isNew ? 'group-hover:bg-amber-500/20 group-hover:border-amber-400' : 'group-hover:bg-blue-500/20 group-hover:border-blue-400';
  const cShadow = data.isNew ? 'shadow-[0_0_15px_-5px_#f59e0b]' : 'shadow-[0_0_15px_-5px_#3b82f6]';
  const cHandle = data.isNew ? 'bg-amber-400/80 shadow-[0_0_8px_#f59e0b] group-hover:bg-amber-400' : 'bg-blue-400/80 shadow-[0_0_8px_#3b82f6] group-hover:bg-blue-400';
  const cTooltip = data.isNew ? 'text-amber-300' : 'text-blue-300';
  const cTooltipActive = data.isNew ? 'bg-amber-500 text-[#0a0a0a]' : 'bg-blue-600 text-white';

  return (
    <div className="relative flex flex-col items-center h-[100%] w-16 shrink-0 group hover:bg-white/[0.02] rounded-xl transition-colors">
      <div className="absolute top-0 w-full h-8 flex items-center justify-center z-40">
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={tempValue}
            onChange={e => setTempValue(e.target.value)}
            onBlur={handleEndEdit}
            onKeyDown={e => e.key === 'Enter' && handleEndEdit()}
            className="w-14 bg-blue-900/80 text-white text-[10px] font-bold text-center border border-blue-400 rounded outline-none"
          />
        ) : (
          <div
            onClick={() => !isLocked && handleStartEdit()}
            className={`text-[9px] font-bold px-1 py-1 rounded w-full text-center truncate select-none ${isLocked ? 'text-zinc-600' : 'text-blue-300 hover:bg-blue-500/20 cursor-text'}`}
          >
            {prefix}{formatNumber(data.alvo)}
          </div>
        )}
      </div>

      <div
        ref={barRef}
        className={`absolute bottom-8 w-12 h-[calc(100%-64px)] flex justify-center z-20 ${isLocked ? 'cursor-not-allowed opacity-50 grayscale' : 'cursor-ns-resize'}`}
        onMouseDown={(e) => { if (!isLocked) { setIsDragging(true); handleMove(e.clientY); } }}
      >
        <div
          className={`absolute bottom-0 w-8 border-2 rounded-t-lg transition-all duration-75 ${cBar} ${!isLocked && cHoverBar} ${!isLocked && cShadow}`}
          style={{ height: `${(data.alvo / maxVal) * 100}%` }}
        >
          {!isLocked && <div className={`absolute -top-1 w-full h-2 rounded-full pointer-events-none ${cHandle}`}></div>}
          <div className={`absolute -top-12 left-1/2 -translate-x-1/2 text-xs font-bold px-2 py-1 rounded transition-opacity pointer-events-none select-none z-50 whitespace-nowrap ${isDragging ? `opacity-100 ${cTooltipActive}` : `opacity-0 group-hover:opacity-100 ${cTooltip} bg-black/80`}`}>
            {isLocked && "🔒 "}{data.isNew && "Nov"} {prefix}{formatNumber(data.alvo)}
          </div>
        </div>
        <div
          className="absolute bottom-0 w-8 bg-emerald-500 rounded-t-lg z-10 transition-all pointer-events-none border border-emerald-400/50"
          style={{ height: `${Math.min(100, (data.realizado / maxVal) * 100)}%` }}
        >
          <div className="absolute bottom-1 w-full text-center text-[10px] font-bold text-emerald-900 select-none">
            {data.realizado > 0 ? `${prefix}${formatNumber(data.realizado)}` : ""}
          </div>
        </div>
      </div>

      <div className={`absolute bottom-0 text-[10px] font-bold whitespace-nowrap truncate w-full text-center px-1 ${data.isNew ? 'text-amber-500' : 'text-zinc-500'}`}>
        {data.periodRef}
      </div>
    </div>
  );
};

export default function SimulationDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<MetricConfig[]>([]);
  const [allGoals, setAllGoals] = useState<GoalRecord[]>([]);
  const [allLogs, setAllLogs] = useState<LogRecord[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [lockHistorical, setLockHistorical] = useState(true);
  const [simData, setSimData] = useState<SliceData[]>([]);
  const [lastEditedId, setLastEditedId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");

  const fetchData = useCallback(async (t: string) => {
    try {
      const [mRes, gRes, lRes] = await Promise.all([
        fetch("http://localhost:8000/api/v1/metrics/", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("http://localhost:8000/api/v1/goals/", { headers: { Authorization: `Bearer ${t}` } }),
        fetch("http://localhost:8000/api/v1/logs/", { headers: { Authorization: `Bearer ${t}` } })
      ]);
      const m = await mRes.json();
      const g = await gRes.json();
      const l = await lRes.json();
      const metricsArr = Array.isArray(m) ? m : m.results || [];
      setMetrics(metricsArr);
      if (metricsArr.length === 1) setSelectedMetric(String(metricsArr[0].id));
      setAllGoals(Array.isArray(g) ? g : g.results || []);
      setAllLogs(Array.isArray(l) ? l : l.results || []);
    } catch {
      // silently fail — user will see empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) return router.push("/login");
    setToken(t);
    fetchData(t);
  }, [router, fetchData]);

  useEffect(() => {
    if (!selectedMetric || !startDate || !endDate) { setSimData([]); return; }
    const mObj = metrics.find(m => String(m.id) === selectedMetric);
    if (!mObj) return;

    const today = new Date();
    let currentRef = "";
    if (mObj.periodo === 'daily') currentRef = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    else if (mObj.periodo === 'monthly') currentRef = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    else if (mObj.periodo === 'yearly') currentRef = `${today.getFullYear()}`;
    else if (mObj.periodo === 'weekly') currentRef = getWeekPattern(today);

    const refs = generateSlices(mObj, startDate, endDate);
    const data: SliceData[] = refs.map(ref => {
      const isLockedRegion = ref <= currentRef;
      const existingGoal = allGoals.find(g => String(g.metric) === selectedMetric && g.periodo_referencia === ref);
      if (existingGoal) {
        const gLogs = allLogs.filter(l => l.goal === existingGoal.id);
        const sumRealizado = gLogs.reduce((acc, l) => acc + (parseFloat(l.valor_logado) || 0), 0);
        return { isNew: false, goalId: existingGoal.id, goalOriginal: existingGoal, periodRef: ref, alvo: parseFloat(existingGoal.alvo) || 0, realizado: sumRealizado, isLockedRegion };
      } else {
        let fallbackPadrao = parseFloat(mObj.valor_padrao ?? '');
        if (isNaN(fallbackPadrao)) fallbackPadrao = 10;
        return { isNew: true, goalId: `mock_${ref}`, periodRef: ref, alvo: fallbackPadrao, alvoOriginalValue: fallbackPadrao, realizado: 0, isLockedRegion };
      }
    });
    setSimData(data);
    setLastEditedId(null);
  }, [selectedMetric, startDate, endDate, allGoals, allLogs, metrics]);

  const handleDragChange = (goalId: string | number, val: number) => {
    setLastEditedId(goalId);
    setSimData(prev => prev.map(d => d.goalId === goalId ? { ...d, alvo: val } : d));
  };

  const handleReplicate = () => {
    if (lastEditedId === null) return;
    const idx = simData.findIndex(d => d.goalId === lastEditedId);
    if (idx < 0) return;
    const newVals = replicateForward(
      simData.map(d => ({ alvo: d.alvo, isLockedRegion: d.isLockedRegion })),
      idx,
      lockHistorical,
    );
    setSimData(prev => prev.map((d, i) => ({ ...d, alvo: newVals[i] })));
  };

  const pendingPosts = simData.filter(d => d.isNew);
  const pendingPuts = simData.filter(d => !d.isNew && d.alvo !== parseFloat(d.goalOriginal?.alvo ?? ''));
  const hasChanges = pendingPosts.length > 0 || pendingPuts.length > 0;

  const saveSimulation = async () => {
    setSaving(true);
    try {
      const postPromises = pendingPosts.map(d =>
        fetch(`http://localhost:8000/api/v1/goals/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ metric: selectedMetric, alvo: d.alvo.toString(), periodo_referencia: d.periodRef })
        })
      );
      const putPromises = pendingPuts.map(d =>
        fetch(`http://localhost:8000/api/v1/goals/${d.goalId}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ ...d.goalOriginal, alvo: d.alvo.toString() })
        })
      );
      await Promise.all([...postPromises, ...putPromises]);
      alert("Simulação injetada no Banco Físico.");
      await fetchData(token);
    } catch {
      alert("Erro ao comitar a simulação.");
    } finally {
      setSaving(false);
    }
  };

  const maxVal = simData.length > 0 ? Math.max(10, ...simData.map(d => d.alvo), ...simData.map(d => d.realizado)) * 1.3 : 100;
  const sumBaseline = simData.reduce((acc, d) => {
    const base = d.goalOriginal ? parseFloat(d.goalOriginal.alvo) : (d.alvoOriginalValue ?? 0);
    return acc + (isNaN(base) ? 0 : base);
  }, 0);
  const sumAdjusted = simData.reduce((acc, d) => acc + (isNaN(d.alvo) ? 0 : d.alvo), 0);
  const percentage = sumBaseline > 0 ? ((sumAdjusted / sumBaseline) * 100).toFixed(1) : "0.0";
  const selectedMetricObj = metrics.find(m => String(m.id) === selectedMetric);
  const prefix = selectedMetricObj?.tipo === 'decimal' ? "R$ " : "";

  return (
    <div className="flex flex-col min-h-screen p-6 sm:p-24 relative bg-[#0a0a0a] text-white overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 mt-8">
          <div>
            <div className="inline-flex items-center space-x-2 text-blue-400 mb-2 font-mono text-sm tracking-widest">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span>GERADOR AUTOMÁTICO</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">Simulador Universal</h1>
            <p className="text-zinc-400">Crie metas para o futuro antecipadamente ou reajuste o passado.</p>
          </div>
        </div>

        <div className="flex flex-col gap-6 mb-8 w-full glass p-6 rounded-2xl border border-white/5">
          <div className="flex flex-col md:flex-row items-end gap-4 w-full">
            <div className="flex-1 w-full">
              <label className="text-sm font-medium text-zinc-300 block mb-2">1. Métrica a trabalhar:</label>
              <select value={selectedMetric} onChange={e => setSelectedMetric(e.target.value)} className="bg-[#111] border border-white/10 px-5 py-4 rounded-xl w-full outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                <option value="">Selecione...</option>
                {metrics.map(m => <option key={m.id} value={m.id}>{m.nome || m.codigo} ({m.periodo})</option>)}
              </select>
            </div>

            <div className="flex-1 w-full">
              <label className="text-sm font-medium text-zinc-300 block mb-2">2. Extensão do Gráfico (Início e Fim)</label>
              <div className="flex gap-2">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-[#111] border border-white/10 px-5 py-4 rounded-xl w-full outline-none" style={{ colorScheme: 'dark' }} />
                <span className="self-center hidden sm:inline">-</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-[#111] border border-white/10 px-5 py-4 rounded-xl w-full outline-none" style={{ colorScheme: 'dark' }} />
              </div>
            </div>

            <div className="w-full md:w-auto">
              <button
                onClick={saveSimulation}
                disabled={saving || !hasChanges}
                className={`px-8 py-4 w-full md:w-auto mt-6 md:mt-0 rounded-xl font-bold transition whitespace-nowrap ${hasChanges ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse' : 'bg-transparent border border-white/10 text-zinc-500 opacity-50 cursor-not-allowed'}`}
              >
                {saving ? "Registrando..." : "Efetivar Geração / Edição"}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-white/5 w-full">
            <div className="flex items-center gap-3">
              <input type="checkbox" id="lockHist" checked={lockHistorical} onChange={(e) => setLockHistorical(e.target.checked)} className="w-5 h-5 rounded cursor-pointer accent-blue-500" />
              <label htmlFor="lockHist" className="text-sm text-zinc-400 cursor-pointer select-none font-medium hover:text-zinc-200 transition">Bloquear edição de metas vigentes e/ou do passado.</label>
            </div>
            <button
              type="button"
              onClick={handleReplicate}
              disabled={lastEditedId === null}
              title="Replica o último valor editado para todas as barras à direita"
              className={`px-5 py-3 rounded-xl font-semibold text-sm whitespace-nowrap transition ${lastEditedId === null ? 'bg-transparent border border-white/10 text-zinc-500 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
            >
              Replicar último valor →
            </button>
          </div>
        </div>

        {selectedMetric && simData.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full mb-8 animate-fade-in-up">
            <div className="glass p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col justify-center">
              <span className="text-zinc-400 text-sm font-medium mb-1">Linha Base (Padrão)</span>
              <span className="text-3xl font-bold text-zinc-300">{prefix}{formatNumber(sumBaseline)}</span>
            </div>
            <div className="glass p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col justify-center">
              <span className="text-zinc-400 text-sm font-medium mb-1">Projeção Desenhada</span>
              <span className="text-3xl font-bold text-blue-400">{prefix}{formatNumber(sumAdjusted)}</span>
            </div>
            <div className="glass p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col justify-center relative overflow-hidden">
              <span className="text-zinc-400 text-sm font-medium mb-1">Excedente em Relação à Origem (%)</span>
              <span className={`text-3xl font-bold z-10 ${sumAdjusted > sumBaseline ? 'text-emerald-400' : sumAdjusted < sumBaseline ? 'text-amber-400' : 'text-zinc-400'}`}>
                {formatNumber(Number(percentage))}%
              </span>
            </div>
          </div>
        )}

        {selectedMetric && (
          <div className="w-full h-[500px] glass p-8 rounded-3xl border border-white/5 relative flex animate-fade-in-up shadow-2xl">
            <div className="absolute left-4 py-8 h-full flex flex-col justify-between text-[10px] font-mono text-zinc-600 pr-4 pb-12 select-none border-r border-zinc-900 pointer-events-none">
              <span>{prefix}{formatNumber(maxVal)}</span>
              <span>{prefix}{formatNumber(maxVal * 0.75)}</span>
              <span>{prefix}{formatNumber(maxVal * 0.5)}</span>
              <span>{prefix}{formatNumber(maxVal * 0.25)}</span>
              <span>{prefix}0,00</span>
            </div>

            <div className="absolute inset-0 pt-8 pb-12 pl-16 pr-8 flex flex-col justify-between pointer-events-none opacity-20 z-0">
              <div className="w-full border-b border-dashed border-zinc-500"></div>
              <div className="w-full border-b border-dashed border-zinc-500"></div>
              <div className="w-full border-b border-dashed border-zinc-500"></div>
              <div className="w-full border-b border-dashed border-zinc-500"></div>
              <div className="w-full border-b border-solid border-zinc-500"></div>
            </div>

            <div className="ml-12 flex-1 h-full pl-6 flex items-end gap-3 overflow-x-auto overflow-y-hidden pb-4">
              {simData.map(d => (
                <DraggableBar
                  key={d.goalId}
                  data={d}
                  maxVal={maxVal}
                  prefix={prefix}
                  isLocked={lockHistorical && d.isLockedRegion}
                  onChange={(nv: number) => handleDragChange(d.goalId, nv)}
                />
              ))}
            </div>

            <div className="absolute top-4 right-8 flex gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 block border-2 border-dashed border-amber-500 bg-amber-500/20 rounded-full"></span>
                <span className="text-amber-400">Meta Virtual Inédita</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 block border border-blue-400 bg-blue-500/20 rounded-full"></span>
                <span className="text-blue-300">Meta Já Oficial</span>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center text-zinc-400 mt-12">
            <span className="animate-pulse">Carregando dados...</span>
          </div>
        )}
      </div>
    </div>
  );
}
