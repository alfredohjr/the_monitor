"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    const storedName = localStorage.getItem("username");
    setLoggedIn(!!storedToken);
    setUsername(storedToken ? storedName : null);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("username");
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
            <Link href="/dashboard" className="text-zinc-300 hover:text-white transition">Dashboard</Link>
            <Link href="/simulacao" className="text-zinc-300 hover:text-blue-400 transition ml-2">Simulação</Link>
            <Link href="/logs" className="text-zinc-300 hover:text-white transition">Lançamentos</Link>
            <Link href="/goals" className="text-zinc-300 hover:text-white transition">Metas</Link>
            <Link href="/metrics" className="text-zinc-300 hover:text-white transition">Métricas</Link>
          </>
        )}
        <div className="hidden sm:block h-4 w-[1px] bg-white/20 self-center mx-2"></div>

        {loggedIn ? (
          <div className="flex items-center gap-4">
            <NotificationBell />
            <span className="text-emerald-400 font-bold">Olá, {username || "usuário"}</span>
            <button onClick={handleLogout} className="text-zinc-400 hover:text-red-400 transition text-xs">Sair</button>
          </div>
        ) : (
          <Link href="/login" className="text-blue-400 hover:text-blue-300 font-bold transition">Entrar</Link>
        )}
      </div>
    </nav>
  );
}
