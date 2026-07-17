"use client";
import { API_BASE, mensagemDeErro } from "@/lib/api";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface OrgUser {
  id: number;
  username: string;
  email: string | null;
  role: string;
}

interface Metric {
  id: number;
  codigo: string;
  nome?: string;
}

export default function AdminUsers() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState<number | null>(null);
  const [orgNome, setOrgNome] = useState("");
  const [meId, setMeId] = useState<number | null>(null);
  const [notAdmin, setNotAdmin] = useState(false);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [assigned, setAssigned] = useState<Set<number>>(new Set());
  const [canEdit, setCanEdit] = useState<Set<number>>(new Set());
  const [canDelete, setCanDelete] = useState<Set<number>>(new Set());
  const [savingMetrics, setSavingMetrics] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) return void router.push("/login");
    setToken(t);
    fetch(API_BASE + "/api/v1/me/", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        setMeId(d?.id ?? null);
        const adminOrg = (d?.organizations ?? []).find((o: { role: string }) => o.role === "admin");
        if (!adminOrg) return setNotAdmin(true);
        setOrgId(adminOrg.id);
        setOrgNome(adminOrg.nome);
      })
      .catch(() => setNotAdmin(true));
  }, [router]);

  useEffect(() => {
    if (!orgId || !token) return;
    loadUsers(orgId, token);
    fetch(API_BASE + "/api/v1/metrics/", { headers: { Authorization: `Bearer ${token}`, "X-Org-Id": String(orgId) } })
      .then(r => r.json())
      .then(d => setMetrics(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [orgId, token]);

  function loadUsers(id: number, t: string) {
    fetch(`${API_BASE}/api/v1/organizations/${id}/users/`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => setUsers(Array.isArray(d) ? d : []));
  }

  async function toggleMetricsPanel(userId: number) {
    if (expandedUser === userId) return setExpandedUser(null);
    setExpandedUser(userId);
    setAssigned(new Set()); setCanEdit(new Set()); setCanDelete(new Set());
    const resp = await fetch(`${API_BASE}/api/v1/organizations/${orgId}/users/${userId}/metrics/`,
      { headers: { Authorization: `Bearer ${token}` } });
    const d = await resp.json().catch(() => ({ assignments: [] }));
    const items: { metric_id: number; can_edit: boolean; can_delete: boolean }[] = Array.isArray(d.assignments) ? d.assignments : [];
    setAssigned(new Set(items.map(a => a.metric_id)));
    setCanEdit(new Set(items.filter(a => a.can_edit).map(a => a.metric_id)));
    setCanDelete(new Set(items.filter(a => a.can_delete).map(a => a.metric_id)));
  }

  function toggleInSet(setFn: React.Dispatch<React.SetStateAction<Set<number>>>, metricId: number) {
    setFn(prev => {
      const next = new Set(prev);
      if (next.has(metricId)) next.delete(metricId); else next.add(metricId);
      return next;
    });
  }

  function toggleMetric(metricId: number) {
    setAssigned(prev => {
      const next = new Set(prev);
      if (next.has(metricId)) { next.delete(metricId); toggleOff(metricId); } else next.add(metricId);
      return next;
    });
  }

  // Ao desmarcar a métrica, também limpa as flags dela.
  function toggleOff(metricId: number) {
    setCanEdit(prev => { const n = new Set(prev); n.delete(metricId); return n; });
    setCanDelete(prev => { const n = new Set(prev); n.delete(metricId); return n; });
  }

  async function saveMetrics(userId: number) {
    setSavingMetrics(true);
    setError("");
    setMessage("");
    try {
      const assignments = [...assigned].map(mid => ({
        metric_id: mid,
        can_edit: canEdit.has(mid),
        can_delete: canDelete.has(mid),
      }));
      const resp = await fetch(`${API_BASE}/api/v1/organizations/${orgId}/users/${userId}/metrics/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assignments }),
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        setError(mensagemDeErro(d.detail, "Não foi possível salvar as métricas"));
        return;
      }
      setMessage("Métricas atribuídas atualizadas.");
      setExpandedUser(null);
    } finally {
      setSavingMetrics(false);
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    const resp = await fetch(`${API_BASE}/api/v1/organizations/${orgId}/users/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email }),
    });
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}));
      setError(mensagemDeErro(d.detail, "Não foi possível adicionar o usuário"));
      return;
    }
    setEmail("");
    setMessage("Usuário adicionado. Ele entra pelo login com Google usando esse e-mail.");
    if (orgId) loadUsers(orgId, token);
  };

  const handleRemove = async (userId: number) => {
    const resp = await fetch(`${API_BASE}/api/v1/organizations/${orgId}/users/${userId}/`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok && orgId) loadUsers(orgId, token);
  };

  if (!token) return <div className="min-h-screen bg-[#0a0a0a]" />;

  if (notAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-[#0a0a0a] text-center">
        <div className="glass p-10 rounded-3xl border border-white/5 text-white">
          <h1 className="text-2xl font-bold mb-3">Acesso restrito</h1>
          <p className="text-zinc-400 text-sm mb-6">Esta área é exclusiva de administradores de organização.</p>
          <Link href="/logs" className="text-blue-400 hover:text-blue-300">Ir para Lançamentos</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] items-center p-6 bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-2xl glass p-8 sm:p-12 rounded-3xl mt-16 text-white border border-white/5">
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Administração</h1>
        <p className="text-zinc-400 text-sm mb-8">Usuários de <strong>{orgNome}</strong></p>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">{error}</div>}
        {message && <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm">{message}</div>}

        <form onSubmit={handleCreate} className="grid sm:grid-cols-[1fr_auto] gap-3 mb-2">
          <input name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required
            placeholder="E-mail do novo membro"
            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl" />
          <button type="submit" className="bg-blue-600 font-bold py-3 px-6 rounded-xl hover:bg-blue-500 transition">Adicionar</button>
        </form>
        <p className="text-zinc-500 text-xs mb-8">
          Se o e-mail já tiver conta, ele é vinculado a esta organização. Se não, criamos a conta e a pessoa
          entra pelo <strong>login com Google</strong> usando o mesmo e-mail.
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-400 text-left border-b border-white/10">
              <th className="py-2">Usuário</th><th>E-mail</th><th>Papel</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <React.Fragment key={u.id}>
                <tr className="border-b border-white/5">
                  <td className="py-3">{u.username}</td>
                  <td className="text-zinc-400">{u.email || "—"}</td>
                  <td>{u.role}</td>
                  <td className="text-right whitespace-nowrap">
                    {u.role !== "admin" && (
                      <button onClick={() => toggleMetricsPanel(u.id)} className="text-blue-400 hover:text-blue-300 text-xs mr-3">
                        {expandedUser === u.id ? "Fechar" : "Métricas"}
                      </button>
                    )}
                    {u.id !== meId && (
                      <button onClick={() => handleRemove(u.id)} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
                    )}
                  </td>
                </tr>
                {expandedUser === u.id && (
                  <tr className="border-b border-white/5 bg-white/5">
                    <td colSpan={4} className="p-4">
                      <p className="text-zinc-400 text-xs mb-3">Selecione as métricas que <strong>{u.username}</strong> pode ver e lançar:</p>
                      {metrics.length === 0 ? (
                        <p className="text-zinc-500 text-xs">Nenhuma métrica nesta organização.</p>
                      ) : (
                        <div className="flex flex-col gap-2 mb-3">
                          {metrics.map(m => (
                            <div key={m.id} className="flex items-center gap-4 text-xs">
                              <label className="flex items-center gap-2 min-w-[160px] cursor-pointer">
                                <input type="checkbox" checked={assigned.has(m.id)} onChange={() => toggleMetric(m.id)} />
                                {m.nome || m.codigo}
                              </label>
                              {assigned.has(m.id) && (
                                <div className="flex items-center gap-4 text-zinc-400">
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="checkbox" aria-label={`Editar ${m.codigo}`} checked={canEdit.has(m.id)} onChange={() => toggleInSet(setCanEdit, m.id)} />
                                    pode editar
                                  </label>
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="checkbox" aria-label={`Excluir ${m.codigo}`} checked={canDelete.has(m.id)} onChange={() => toggleInSet(setCanDelete, m.id)} />
                                    pode excluir
                                  </label>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <button onClick={() => saveMetrics(u.id)} disabled={savingMetrics}
                        className="text-xs bg-blue-600 font-bold py-2 px-4 rounded-lg hover:bg-blue-500 transition">
                        {savingMetrics ? "Salvando..." : "Salvar métricas"}
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
