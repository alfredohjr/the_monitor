"use client";
import { API_BASE } from "@/lib/api";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { exchangeGoogleCredential } from "@/lib/googleAuth";
import { nextRouteAfterLogin } from "@/lib/postLogin";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleAccounts {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}

export default function LoginPage() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setError("");
    try {
      const tokens = await exchangeGoogleCredential(credential);
      localStorage.setItem("access_token", tokens.access);
      localStorage.setItem("refresh_token", tokens.refresh);
      localStorage.setItem("username", tokens.username);
      router.push(await nextRouteAfterLogin(tokens.access));
    } catch {
      setError("Não foi possível entrar com o Google");
    }
  }, [router]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      const g = (window as unknown as { google?: GoogleAccounts }).google;
      if (!g || !googleBtnRef.current) return;
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => handleGoogleCredential(resp.credential),
      });
      g.accounts.id.renderButton(googleBtnRef.current, { theme: "outline", size: "large", width: 320 });
    };
    document.body.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [handleGoogleCredential]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_BASE + "/api/v1/token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) throw new Error("Credenciais inválidas ou erro no servidor");

      const data = await response.json();
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);
      localStorage.setItem("username", credentials.username);
      router.push(await nextRouteAfterLogin(data.access));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Não foi possível realizar o login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center px-6 pt-28 pb-20 relative overflow-hidden bg-[#0a0a0a]">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md glass p-10 rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border border-white/5">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block mb-4">
            <span className="text-2xl font-extrabold tracking-tight text-white mb-2 block">Quantified Self</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Acesso Restrito</h1>
          <p className="text-zinc-400 text-sm">Insira suas credenciais para continuar.</p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2 group">
            <label className="block text-sm font-medium text-zinc-300 transition-colors group-focus-within:text-blue-400">
              Usuário
            </label>
            <input
              type="text"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              required
              className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
              placeholder="Ex: alfredo"
            />
          </div>

          <div className="space-y-2 group">
            <label className="block text-sm font-medium text-zinc-300 transition-colors group-focus-within:text-blue-400">
              Senha
            </label>
            <input
              type="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              required
              className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center px-8 py-4 text-base font-semibold text-white rounded-xl transition-all duration-300 ${
              loading ? "bg-blue-600/50 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 hover:-translate-y-0.5"
            }`}
          >
            {loading ? "Entrando..." : "Entrar no Sistema"}
          </button>
        </form>

        <div className="mt-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">ou</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <div ref={googleBtnRef} className="flex justify-center" />
          {!GOOGLE_CLIENT_ID && (
            <p className="text-center text-xs text-zinc-600 mt-2">
              Login com Google indisponível (configure NEXT_PUBLIC_GOOGLE_CLIENT_ID)
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Não tem conta?{" "}
          <Link href="/register" className="text-blue-400 hover:text-blue-300 transition-colors">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
