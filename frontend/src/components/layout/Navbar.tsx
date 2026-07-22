"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import NotificationBell from "./NotificationBell";
import { getActiveOrg, setActiveOrg, clearActiveOrg, API_BASE } from "@/lib/api";

interface Org { id: number; nome: string; role: string }

export default function Navbar() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  // null = papel ainda desconhecido (otimista: mostra tudo até /me resolver).
  const [role, setRole] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrg, setActiveOrgState] = useState<number | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    const storedName = localStorage.getItem("username");
    setLoggedIn(!!storedToken);
    setUsername(storedToken ? storedName : null);
    if (!storedToken) { setRole(null); setOrgs([]); return; }
    fetch(API_BASE + "/api/v1/me/", { headers: { Authorization: `Bearer ${storedToken}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        setRole(d?.role ?? null);
        // Prefere o nome de exibição (#206); cai no username quando não definido.
        if (d?.display_name) { setUsername(d.display_name); localStorage.setItem("username", d.display_name); }
        const list: Org[] = d?.organizations ?? [];
        setOrgs(list);
        // Garante que a org ativa é uma que o usuário realmente participa.
        let cur = getActiveOrg();
        if (!list.some(o => o.id === cur)) {
          cur = list[0]?.id ?? null;
          if (cur != null) setActiveOrg(cur);
        }
        setActiveOrgState(cur);
      })
      .catch(() => { setRole(null); setOrgs([]); });
  }, [pathname]);

  const handleOrgChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    setActiveOrg(id);
    setActiveOrgState(id);
    // Recarrega para que todas as telas refaçam as buscas com a nova org.
    if (typeof window !== "undefined") window.location.reload();
  };

  // Usuário de papel "user" só faz lançamento; some com as telas de gestão.
  const isUser = role === "user";
  const isAdmin = role === "admin";

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("username");
    clearActiveOrg();
    setLoggedIn(false);
    setUsername(null);
    router.push("/login");
  };

  return (
    <nav className="w-full flex justify-center pt-6 absolute top-0 z-50 px-4">
      <div className="glass px-6 py-3 rounded-full flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium border border-white/10 shadow-lg items-center">
        <Link href="/" className="text-zinc-300 hover:text-white transition">Início</Link>
        {loggedIn && (
          <>
            {!isUser && <Link href="/dashboard" className="text-zinc-300 hover:text-white transition">Dashboard</Link>}
            {!isUser && <Link href="/simulacao" className="text-zinc-300 hover:text-blue-400 transition ml-2">Simulação</Link>}
            <Link href="/logs" className="text-zinc-300 hover:text-white transition">Lançamentos</Link>
            {!isUser && <Link href="/goals" className="text-zinc-300 hover:text-white transition">Metas</Link>}
            {!isUser && <Link href="/metrics" className="text-zinc-300 hover:text-white transition">Métricas</Link>}
            {!isUser && <Link href="/metas/importar" className="text-zinc-300 hover:text-white transition">Importar</Link>}
            {isAdmin && <Link href="/admin" className="text-amber-300 hover:text-amber-200 transition">Admin</Link>}
          </>
        )}
        <div className="hidden sm:block h-4 w-[1px] bg-white/20 self-center mx-2"></div>

        {loggedIn ? (
          <div className="flex items-center gap-4">
            <NotificationBell />
            <Link href="/perfil" className="text-emerald-400 font-bold hover:text-emerald-300 transition" title="Meu perfil">Olá, {username || "usuário"}</Link>
            {orgs.length > 0 && (
              <select
                aria-label="Organização"
                value={activeOrg ?? ""}
                onChange={handleOrgChange}
                className="bg-white/5 border border-white/10 rounded-lg text-zinc-200 text-xs px-2 py-1 focus:outline-none"
              >
                {orgs.map(o => (
                  <option key={o.id} value={o.id} className="bg-zinc-900">{o.nome}</option>
                ))}
              </select>
            )}
            <button onClick={handleLogout} className="text-zinc-400 hover:text-red-400 transition text-xs">Sair</button>
          </div>
        ) : (
          <Link href="/login" className="text-blue-400 hover:text-blue-300 font-bold transition">Entrar</Link>
        )}
      </div>
    </nav>
  );
}
