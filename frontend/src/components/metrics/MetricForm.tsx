"use client";
import React, { useState, useEffect } from "react";
import { apiFetch, API_BASE } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function MetricForm({ id }: { id?: string }) {
  const router = useRouter();
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
        }).catch(() => setMessage({ text: "Não foi possível carregar métrica.", type: "error" }));
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
      if (!response.ok) throw new Error(id ? "Erro ao atualizar." : "Erro ao criar. Código pode já existir.");
      setMessage({ text: id ? "Métrica atualizada!" : "Métrica criada com sucesso!", type: "success" });
      if (!id) setFormData({ codigo: "", nome: "", descricao: "", valor_padrao: "", tipo: "number", periodo: "daily", is_default: false });
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : "Erro desconhecido", type: "error" });
    } finally { setLoading(false); }
  };

  if (!token) return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6 bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-xl glass p-8 sm:p-12 rounded-3xl mt-16 text-white border border-white/5">
        <div className="mb-8">
          <Link href="/metrics" className="text-sm text-zinc-400 hover:text-white mb-2 inline-block">← Voltar pra Lista</Link>
          <h1 className="text-3xl font-extrabold tracking-tight">{id ? "Editando Métrica" : "Nova Métrica"}</h1>
        </div>
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl text-center text-sm ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-zinc-300">Código</label>
              <input type="text" name="codigo" value={formData.codigo} onChange={handleChange} required className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-xl" />
            </div>
            <div className="flex-[2] space-y-2">
              <label className="text-sm font-medium text-zinc-300">Nome Amigável</label>
              <input type="text" name="nome" value={formData.nome} onChange={handleChange} required className="w-full px-5 py-3 bg-[#111] border border-blue-500/30 rounded-xl focus:border-blue-500" placeholder="Ex: Páginas Lidas" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Descrição</label>
            <textarea name="descricao" value={formData.descricao} onChange={handleChange} required className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-xl resize-none" rows={3} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Valor Padrão</label>
            <input type="text" name="valor_padrao" value={formData.valor_padrao} onChange={handleChange} className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Tipo</label>
              <select name="tipo" value={formData.tipo} onChange={handleChange} className="w-full px-5 py-3 bg-[#111] border border-white/10 rounded-xl">
                <option value="number">Número Inteiro</option>
                <option value="decimal">Número Decimal</option>
                <option value="currency">Monetário (R$)</option>
                <option value="percent">Percentual (%)</option>
                <option value="string">Texto</option>
                <option value="boolean">Booleano</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Frequência</label>
              <select name="periodo" value={formData.periodo} onChange={handleChange} className="w-full px-5 py-3 bg-[#111] border border-white/10 rounded-xl">
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" name="is_default" checked={formData.is_default} onChange={handleChange} aria-label="Métrica padrão" className="w-4 h-4 accent-blue-500" />
            <span className="text-sm font-medium text-zinc-300">Definir como métrica padrão</span>
          </label>
          <button type="submit" disabled={loading} className="w-full mt-4 bg-blue-600 font-bold py-4 rounded-xl hover:bg-blue-500 transition">
            {loading ? 'Salvando...' : (id ? 'Atualizar Métrica' : 'Salvar Nova Métrica')}
          </button>
        </form>
      </div>
    </div>
  );
}
