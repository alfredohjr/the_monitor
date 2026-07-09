"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface OrgUser {
  id: number;
  username: string;
  email: string | null;
  role: string;
}

export default function AdminUsers() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState<number | null>(null);
  const [orgNome, setOrgNome] = useState("");
  const [meId, setMeId] = useState<number | null>(null);
  const [notAdmin, setNotAdmin] = useState(false);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [form, setForm] = useState({ username: "", password: "", email: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) return void router.push("/login");
    setToken(t);
    fetch("http://localhost:8000/api/v1/me/", { headers: { Authorization: `Bearer ${t}` } })
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
  }, [orgId, token]);

  function loadUsers(id: number, t: string) {
    fetch(`http://localhost:8000/api/v1/organizations/${id}/users/`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => setUsers(Array.isArray(d) ? d : []));
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    const resp = await fetch(`http://localhost:8000/api/v1/organizations/${orgId}/users/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}));
      setError(d.detail ?? "Não foi possível criar o usuário");
      return;
    }
    setForm({ username: "", password: "", email: "" });
    setMessage("Usuário criado.");
    if (orgId) loadUsers(orgId, token);
  };

  const handleRemove = async (userId: number) => {
    const resp = await fetch(`http://localhost:8000/api/v1/organizations/${orgId}/users/${userId}/`, {
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

        <form onSubmit={handleCreate} className="grid sm:grid-cols-4 gap-3 mb-8">
          <input name="username" value={form.username} onChange={handleChange} required placeholder="Usuário"
            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl" />
          <input name="password" type="password" value={form.password} onChange={handleChange} required placeholder="Senha"
            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl" />
          <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="E-mail (opcional)"
            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl" />
          <button type="submit" className="bg-blue-600 font-bold py-3 rounded-xl hover:bg-blue-500 transition">Adicionar</button>
        </form>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-400 text-left border-b border-white/10">
              <th className="py-2">Usuário</th><th>E-mail</th><th>Papel</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-white/5">
                <td className="py-3">{u.username}</td>
                <td className="text-zinc-400">{u.email || "—"}</td>
                <td>{u.role}</td>
                <td className="text-right">
                  {u.id !== meId && (
                    <button onClick={() => handleRemove(u.id)} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
