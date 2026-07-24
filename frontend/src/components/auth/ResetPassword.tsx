"use client";
import { API_BASE, mensagemDeErro } from "@/lib/api";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

export default function ResetPassword() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const token = searchParams.get("token");
    if (!token) return setError("Link inválido: token ausente.");
    if (password.length < 6) return setError("A senha deve ter ao menos 6 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    setLoading(true);
    try {
      const r = await fetch(API_BASE + "/api/v1/password-reset/confirm/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(mensagemDeErro(d.detail, "Não foi possível redefinir a senha. O link pode ter expirado."));
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 1800);
    } catch {
      setError("Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center px-6 pt-28 pb-20 bg-zinc-50 dark:bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-md bg-white border border-zinc-200 dark:bg-white/[0.03] dark:glass dark:border-white/5 p-10 rounded-3xl">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6 text-center">Redefinir senha</h1>
        {done ? (
          <p className="text-emerald-400 text-sm text-center">Senha redefinida! Redirecionando para o login…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Nova senha"
                className="w-full px-5 py-4 pr-12 bg-white border border-zinc-300 rounded-xl text-zinc-900 placeholder-zinc-400 dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={show}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-400 hover:text-zinc-200 transition"
              >
                {show ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <input
              type={show ? "text" : "password"}
              name="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="Confirmar nova senha"
              className="w-full px-5 py-4 bg-white border border-zinc-300 rounded-xl text-zinc-900 placeholder-zinc-400 dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl transition disabled:opacity-50 text-white"
            >
              {loading ? "Redefinindo..." : "Redefinir senha"}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/login" className="text-blue-400 hover:text-blue-300">Voltar para o login</Link>
        </p>
      </div>
    </div>
  );
}
