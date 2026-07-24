"use client";
import { API_BASE } from "@/lib/api";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(API_BASE + "/api/v1/password-reset/request/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
    } catch {
      // resposta é sempre genérica; mesmo em falha mostramos a confirmação
    } finally {
      // Sempre confirma (não revela se o e-mail existe).
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center px-6 pt-28 pb-20 bg-zinc-50 dark:bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-md bg-white border border-zinc-200 dark:bg-white/[0.03] dark:glass dark:border-white/5 p-10 rounded-3xl">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2 text-center">Esqueci minha senha</h1>
        {sent ? (
          <div className="text-center">
            <p className="text-emerald-400 text-sm mb-6">
              Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha. Confira sua caixa de entrada.
            </p>
            <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm">Voltar para o login</Link>
          </div>
        ) : (
          <>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6 text-center">Informe seu e-mail para receber o link de redefinição.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                className="w-full px-5 py-4 bg-white border border-zinc-300 rounded-xl text-zinc-900 placeholder-zinc-400 dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl transition disabled:opacity-50 text-white"
              >
                {loading ? "Enviando..." : "Enviar link"}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-zinc-500">
              <Link href="/login" className="text-blue-400 hover:text-blue-300">Voltar para o login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
