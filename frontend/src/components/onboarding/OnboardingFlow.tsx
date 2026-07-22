"use client";
import { API_BASE, setActiveOrg } from "@/lib/api";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingFlow() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  // Passo 1: criar a organização (só quem entrou sem nenhuma — típico do Google).
  const [needsOrg, setNeedsOrg] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [erroOrg, setErroOrg] = useState("");
  // Carrega o /me uma única vez: re-buscá-lo a cada render resetaria o passo
  // atual (needsOrg) logo após o usuário criar a org.
  const carregou = useRef(false);

  const loadMetrics = (t: string) => {
    fetch(API_BASE + "/api/v1/metrics/", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        const all = Array.isArray(d) ? d : d.results || [];
        setMetrics(all.filter((m: any) => m.is_default));
      });
  };

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) return router.push("/login");
    setToken(t);
    if (carregou.current) return;
    carregou.current = true;
    fetch(API_BASE + "/api/v1/me/", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const orgs = d?.organizations ?? [];
        if (orgs.length === 0) {
          setNeedsOrg(true);
          setDisplayName(d?.display_name ?? "");
        } else {
          setNeedsOrg(false);
          loadMetrics(t);
        }
      })
      .catch(() => {});
  }, [router]);

  const toggle = (id: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const handleCriarOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroOrg("");
    const nome = orgName.trim();
    if (!nome) { setErroOrg("Dê um nome à sua organização"); return; }
    setLoading(true);
    try {
      const r = await fetch(API_BASE + "/api/v1/onboarding/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ organizacao: nome, display_name: displayName.trim() || null }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setErroOrg(typeof d?.detail === "string" ? d.detail : "Não foi possível criar a organização.");
        return;
      }
      if (d?.id) setActiveOrg(d.id);
      if (d?.display_name) localStorage.setItem("username", d.display_name);
      setNeedsOrg(false);
      loadMetrics(token);
    } catch {
      setErroOrg("Não foi possível criar a organização.");
    } finally {
      setLoading(false);
    }
  };

  const handleComecar = async () => {
    setLoading(true);
    for (const id of selected) {
      await fetch(API_BASE + "/api/v1/subscriptions/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ metric_id: id }),
      });
    }
    router.push("/dashboard");
  };

  if (!token) return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6 bg-[#0a0a0a] text-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>
      <div className="relative z-10 w-full max-w-2xl glass p-8 sm:p-12 rounded-3xl border border-white/5">
        {needsOrg ? (
          <>
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-extrabold tracking-tight mb-2">Bem-vindo! Vamos começar</h1>
              <p className="text-zinc-400">Crie sua organização para começar a acompanhar suas métricas.</p>
            </div>
            <form onSubmit={handleCriarOrg} className="space-y-5">
              <div>
                <label htmlFor="display_name" className="block text-sm text-zinc-300 mb-1">Seu nome</label>
                <input
                  id="display_name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Como você quer ser chamado"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label htmlFor="org_name" className="block text-sm text-zinc-300 mb-1">Nome da organização</label>
                <input
                  id="org_name"
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Ex: Minha Loja"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              {erroOrg && <p role="alert" className="text-sm text-red-400">{erroOrg}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl transition disabled:opacity-50"
              >
                {loading ? "Criando..." : "Criar organização"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-extrabold tracking-tight mb-2">Primeiros passos</h1>
              <p className="text-zinc-400">Selecione as métricas que quer acompanhar. Você pode mudar isso depois.</p>
            </div>

            <div className="space-y-3 mb-8">
              {metrics.map(m => (
                <label key={m.id} className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-colors ${selected.has(m.id) ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 hover:border-white/20'}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                    className="mt-1 w-4 h-4 accent-blue-500 shrink-0"
                  />
                  <div>
                    <p className="font-semibold text-white">{m.nome}</p>
                    <p className="text-sm text-zinc-400">{m.descricao}</p>
                  </div>
                </label>
              ))}
              {metrics.length === 0 && (
                <p className="text-center text-zinc-500 py-4">Nenhuma métrica padrão disponível.</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleComecar}
                disabled={loading}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl transition disabled:opacity-50"
              >
                {loading ? "Configurando..." : "Começar"}
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 font-medium rounded-xl transition text-zinc-300"
              >
                Pular
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
