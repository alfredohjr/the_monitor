"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, mensagemDeErro } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) return router.push("/login");
    setToken(t);
    apiFetch("/api/v1/me/")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setUsername(d.username ?? "");
        setEmail(d.email ?? null);
        setDisplayName(d.display_name ?? "");
      })
      .catch(() => {});
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setOk(false);
    const nome = displayName.trim();
    if (!nome) {
      setErro("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const r = await apiFetch("/api/v1/me/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: nome }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setErro(mensagemDeErro(d?.detail, "Não foi possível salvar."));
        return;
      }
      setDisplayName(d?.display_name ?? nome);
      setOk(true);
      // Reflete o novo nome no Navbar (que lê de localStorage).
      if (typeof window !== "undefined") localStorage.setItem("username", d?.display_name ?? nome);
    } catch {
      setErro("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (!token) return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6 bg-[#0a0a0a] text-white">
      <div className="relative z-10 w-full max-w-md glass p-8 rounded-3xl border border-white/5">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Meu perfil</h1>
        <p className="text-zinc-400 text-sm mb-6">Edite como seu nome aparece no sistema.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="display_name" className="block text-sm text-zinc-300 mb-1">Nome de exibição</label>
            <input
              id="display_name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Como você quer ser chamado"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="text-sm text-zinc-500 space-y-1">
            {email && <p>E-mail: <span className="text-zinc-300">{email}</span></p>}
            <p>Usuário: <span className="text-zinc-300">{username}</span></p>
          </div>

          {erro && <p role="alert" className="text-sm text-red-400">{erro}</p>}
          {ok && <p className="text-sm text-emerald-400">Nome atualizado!</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl transition disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </div>
    </div>
  );
}
