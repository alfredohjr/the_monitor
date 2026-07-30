"use client";
import { API_BASE, mensagemDeErro } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";
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
  const { t } = useT();
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState<number | null>(null);
  const [orgNome, setOrgNome] = useState("");
  const [orgIsPaid, setOrgIsPaid] = useState(false);
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
    if (!t) return void router.replace("/login");
    setToken(t);
    fetch(API_BASE + "/api/v1/me/", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        setMeId(d?.id ?? null);
        const adminOrg = (d?.organizations ?? []).find((o: { role: string }) => o.role === "admin");
        if (!adminOrg) return setNotAdmin(true);
        setOrgId(adminOrg.id);
        setOrgNome(adminOrg.nome);
        setOrgIsPaid(!!adminOrg.is_paid);
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
        setError(mensagemDeErro(d.detail, t("admin.saveMetricsFailed")));
        return;
      }
      setMessage(t("admin.metricsUpdated"));
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
      setError(mensagemDeErro(d.detail, t("admin.addUserFailed")));
      return;
    }
    setEmail("");
    setMessage(t("admin.userAdded"));
    if (orgId) loadUsers(orgId, token);
  };

  const handleRemove = async (userId: number) => {
    const resp = await fetch(`${API_BASE}/api/v1/organizations/${orgId}/users/${userId}/`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok && orgId) loadUsers(orgId, token);
  };

  if (!token) return <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a]" />;

  if (notAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-zinc-50 dark:bg-[#0a0a0a] text-center">
        <div className="bg-white border border-zinc-200 dark:bg-white/[0.03] dark:backdrop-blur-xl dark:border-white/5 p-10 rounded-3xl text-zinc-900 dark:text-white">
          <h1 className="text-2xl font-bold mb-3">{t("admin.restrictedTitle")}</h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">{t("admin.restrictedText")}</p>
          <Link href="/logs" className="text-blue-400 hover:text-blue-300">{t("admin.goToLogs")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] items-center p-6 bg-zinc-50 dark:bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-2xl bg-white border border-zinc-200 dark:bg-white/[0.03] dark:backdrop-blur-xl dark:border-white/5 p-8 sm:p-12 rounded-3xl mt-16 text-zinc-900 dark:text-white">
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">{t("admin.title")}</h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-8">{t("admin.usersOf")} <strong>{orgNome}</strong></p>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">{error}</div>}
        {message && <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm">{message}</div>}

        {orgIsPaid ? (
          <>
            <form onSubmit={handleCreate} className="grid sm:grid-cols-[1fr_auto] gap-3 mb-2">
              <input name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder={t("admin.emailPlaceholder")}
                className="px-4 py-3 bg-white border border-zinc-300 dark:bg-white/5 dark:border-white/10 rounded-xl" />
              <button type="submit" className="bg-blue-600 font-bold py-3 px-6 rounded-xl hover:bg-blue-500 transition">{t("admin.add")}</button>
            </form>
            <p className="text-zinc-500 text-xs mb-8">
              {t("admin.inviteHint")}
            </p>
          </>
        ) : (
          <div data-testid="plano-free-aviso" className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-black dark:text-amber-200 text-sm">
            {t("admin.freePlanWarning")}
          </div>
        )}

        <div data-testid="admin-tabela-scroll" className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-600 dark:text-zinc-400 text-left border-b border-zinc-200 dark:border-white/10">
              <th className="py-2">{t("admin.colUser")}</th><th>{t("admin.colEmail")}</th><th>{t("admin.colRole")}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <React.Fragment key={u.id}>
                <tr className="border-b border-zinc-200 dark:border-white/5">
                  <td className="py-3 break-all">{u.username}</td>
                  <td className="text-zinc-600 dark:text-zinc-400 break-all">{u.email || "—"}</td>
                  <td>{u.role === "admin" ? t("admin.roleAdmin") : u.role === "user" ? t("admin.roleUser") : u.role}</td>
                  <td className="text-right whitespace-nowrap">
                    {u.role !== "admin" && (
                      <button onClick={() => toggleMetricsPanel(u.id)} className="text-blue-400 hover:text-blue-300 text-xs mr-3">
                        {expandedUser === u.id ? t("admin.close") : t("admin.metrics")}
                      </button>
                    )}
                    {u.id !== meId && (
                      <button onClick={() => handleRemove(u.id)} className="text-red-400 hover:text-red-300 text-xs">{t("admin.remove")}</button>
                    )}
                  </td>
                </tr>
                {expandedUser === u.id && (
                  <tr className="border-b border-zinc-200 dark:border-white/5 bg-zinc-100 dark:bg-white/5">
                    <td colSpan={4} className="p-4">
                      <p className="text-zinc-600 dark:text-zinc-400 text-xs mb-3">{t("admin.assignHint", { usuario: u.username })}</p>
                      {metrics.length === 0 ? (
                        <p className="text-zinc-500 text-xs">{t("admin.noMetrics")}</p>
                      ) : (
                        <div className="flex flex-col gap-2 mb-3">
                          {metrics.map(m => (
                            <div key={m.id} className="flex items-center gap-4 text-xs">
                              <label className="flex items-center gap-2 min-w-[160px] cursor-pointer">
                                <input type="checkbox" checked={assigned.has(m.id)} onChange={() => toggleMetric(m.id)} />
                                {m.nome || m.codigo}
                              </label>
                              {assigned.has(m.id) && (
                                <div className="flex items-center gap-4 text-zinc-600 dark:text-zinc-400">
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="checkbox" aria-label={t("admin.canEditAria", { codigo: m.codigo })} checked={canEdit.has(m.id)} onChange={() => toggleInSet(setCanEdit, m.id)} />
                                    {t("admin.canEdit")}
                                  </label>
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="checkbox" aria-label={t("admin.canDeleteAria", { codigo: m.codigo })} checked={canDelete.has(m.id)} onChange={() => toggleInSet(setCanDelete, m.id)} />
                                    {t("admin.canDelete")}
                                  </label>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <button onClick={() => saveMetrics(u.id)} disabled={savingMetrics}
                        className="text-xs bg-blue-600 font-bold py-2 px-4 rounded-lg hover:bg-blue-500 transition">
                        {savingMetrics ? t("admin.savingMetrics") : t("admin.saveMetrics")}
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
    </div>
  );
}
